import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp, FieldPath } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/api/requireAdmin';
import { rateLimit } from '@/lib/api/rateLimit';
import { PLAN_PRICING, GST_RATE } from '@/constants/pricing';

/**
 * Repairs documents written before the Phase 0 fixes.
 *
 * Three classes of damage:
 *  1. "Skeleton" user documents created by the old session ping, missing
 *     email/name/role/createdAt — invisible to any ordered admin query.
 *  2. Orders with no createdAt (invisible to the orders list), no denormalised
 *     userEmail (rendered as "Unknown User"), and no explicit money fields.
 *  3. users.totalSpent drifted out of sync with the orders that produced it.
 *
 * Deliberately conservative:
 *  - only ever fills fields that are ABSENT; never overwrites existing values
 *    (except totalSpent, which is recomputed from orders — the authoritative
 *    source — and only when it actually differs)
 *  - never touches enrolledCourses, which is what grants access
 *  - dryRun is the default, so the destructive path requires an explicit opt-in
 *  - each run is bounded and resumable; see the note on PAGE_SIZE below
 */

/**
 * A run walks every user and every order, calling Firebase Auth per user and
 * Razorpay per order. Unbounded, that eventually exceeds the function timeout
 * and dies mid-pass — having already written some documents, with nothing to
 * say where it stopped. So each invocation processes at most a page, stops
 * early if it approaches the deadline, and returns cursors to continue from.
 *
 * Re-running is always safe: every write only fills fields that are absent.
 */
const PAGE_SIZE = 200;
const TIME_BUDGET_MS = 45_000;
/**
 * What the gateway actually captured for an order, in rupees. Returns null if
 * it cannot be determined — the caller must not fall back to a guess.
 */
async function fetchCapturedAmount(orderId: string, auth: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) return null;
    const items = (await res.json())?.items ?? [];
    const captured = items.find((p: any) => p.status === 'captured');
    if (!captured || typeof captured.amount !== 'number') return null;
    return Math.round(captured.amount) / 100; // paise -> rupees
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const limited = await rateLimit({
    scope: 'admin-backfill', identifier: check.uid, limit: 10, windowMs: 60 * 60 * 1000,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many backfill runs. Please wait.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  // Default to a dry run: the caller must ask explicitly to write.
  const dryRun = body?.dryRun !== false;

  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS;

  // Cursors from a previous truncated run, so a large tenant can be completed
  // across several invocations instead of failing forever on the first.
  const afterUser: string | null = typeof body?.afterUser === 'string' ? body.afterUser : null;
  const afterOrder: string | null = typeof body?.afterOrder === 'string' ? body.afterOrder : null;

  try {
    const changes: any[] = [];
    let truncated = false;
    let lastUserId: string | null = null;
    let lastOrderId: string | null = null;

    // ---------------------------------------------------------------- users
    let usersQuery = adminDb.collection('users')
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (afterUser) usersQuery = usersQuery.startAfter(afterUser);
    const usersSnap = await usersQuery.get();
    const userEmailById = new Map<string, string>();

    for (const doc of usersSnap.docs) {
      if (outOfTime()) { truncated = true; break; }
      lastUserId = doc.id;
      const data = doc.data();
      const patch: Record<string, any> = {};

      // Firebase Auth is the source of truth for identity and signup time.
      let authRecord: any = null;
      if (!data.email || !data.name || !data.createdAt) {
        authRecord = await adminAuth.getUser(doc.id).catch(() => null);
      }

      if (!data.email && authRecord?.email) patch.email = authRecord.email;
      if (!data.name && authRecord?.displayName) patch.name = authRecord.displayName;
      if (!data.role) patch.role = 'student';
      if (!data.createdAt) {
        const created = authRecord?.metadata?.creationTime;
        patch.createdAt = created
          ? Timestamp.fromMillis(new Date(created).getTime())
          : FieldValue.serverTimestamp();
      }

      const email = data.email || patch.email;
      if (email) userEmailById.set(doc.id, email);

      if (Object.keys(patch).length > 0) {
        changes.push({ type: 'user', id: doc.id, fields: Object.keys(patch) });
        if (!dryRun) await doc.ref.set(patch, { merge: true });
      }
    }

    // --------------------------------------------------------------- orders
    let ordersQuery = adminDb.collection('orders')
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (afterOrder) ordersQuery = ordersQuery.startAfter(afterOrder);
    const ordersSnap = await ordersQuery.get();
    // userId -> total actually paid, recomputed from orders
    const spendByUser = new Map<string, number>();
    // Orders whose captured amount could not be established. Reported rather
    // than guessed, so revenue is never silently wrong.
    const unresolvedAmounts: string[] = [];
    // Orders referencing a user document that no longer exists.
    const orphanedOrders: string[] = [];

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const razorpayAuth = keyId && keySecret
      ? Buffer.from(`${keyId}:${keySecret}`).toString('base64')
      : null;

    for (const doc of ordersSnap.docs) {
      if (outOfTime()) { truncated = true; break; }
      lastOrderId = doc.id;

      const data = doc.data();
      const patch: Record<string, any> = {};
      const plan = PLAN_PRICING[data.planId];

      if (!data.userEmail) {
        const email = userEmailById.get(data.userId);
        if (email) patch.userEmail = email;
      }

      // Reconstruct the money breakdown. Legacy `amount` held the ex-GST
      // price, so it maps to amountBase.
      //
      // amountPaid must NOT be derived from the plan catalogue: a discounted
      // order charged less than list price, and inferring it would silently
      // overstate revenue (a real case here — a coupon order that charged Rs 10
      // would have been recorded as Rs 706.82). The only authoritative source
      // for what was actually captured is the gateway.
      const comped = data.status === 'bypassed' || String(data.orderId || '').startsWith('BYPASS-');

      if (plan) {
        const base = typeof data.amount === 'number' ? data.amount : plan.price;
        if (data.amountBase === undefined) patch.amountBase = base;
        if (data.gstAmount === undefined) patch.gstAmount = Math.round(base * GST_RATE * 100) / 100;
      }

      if (data.amountPaid === undefined) {
        if (comped) {
          patch.amountPaid = 0; // no money moved, regardless of list price
        } else if (razorpayAuth && String(data.orderId || '').startsWith('order_')) {
          const captured = await fetchCapturedAmount(data.orderId, razorpayAuth);
          // Left absent when the gateway can't tell us — an unknown amount is
          // reported in the response rather than guessed at.
          if (captured !== null) patch.amountPaid = captured;
          else unresolvedAmounts.push(data.orderId);
        } else {
          unresolvedAmounts.push(data.orderId || doc.id);
        }
      }

      // Without createdAt the document is invisible to the orders list.
      // updatedAt is the best available proxy for when it happened.
      if (!data.createdAt) {
        patch.createdAt = data.updatedAt ?? FieldValue.serverTimestamp();
      }

      if (data.status === 'success') {
        const paid = data.amountPaid ?? patch.amountPaid ?? 0;
        spendByUser.set(data.userId, (spendByUser.get(data.userId) || 0) + paid);
      }

      if (Object.keys(patch).length > 0) {
        changes.push({ type: 'order', id: doc.id, fields: Object.keys(patch) });
        if (!dryRun) await doc.ref.set(patch, { merge: true });
      }
    }

    // ----------------------------------------------------------- totalSpent
    // Only safe on a complete pass. totalSpent is a SUM over every one of a
    // user's orders, so recomputing it from a partial scan would write a
    // number that is simply too low — turning a paging artefact into wrong
    // revenue on the student's record.
    const fullPass = !truncated
      && !afterUser && !afterOrder
      && usersSnap.size < PAGE_SIZE && ordersSnap.size < PAGE_SIZE;

    if (fullPass) {
      // Indexed rather than re-scanned per user: the previous .find() inside
      // this loop was quadratic.
      const usersById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>(
        usersSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => [d.id, d]),
      );
      for (const [userId, total] of spendByUser) {
        const userDoc = usersById.get(userId);
        if (!userDoc) { orphanedOrders.push(userId); continue; }
        const current = userDoc.data().totalSpent ?? 0;
        const rounded = Math.round(total * 100) / 100;
        if (Math.abs(current - rounded) > 0.01) {
          changes.push({ type: 'totalSpent', id: userId, from: current, to: rounded });
          if (!dryRun) await userDoc.ref.set({ totalSpent: rounded }, { merge: true });
        }
      }
    }

    // More to do if we stopped early, or if either page came back full.
    const moreUsers = truncated || usersSnap.size === PAGE_SIZE;
    const moreOrders = truncated || ordersSnap.size === PAGE_SIZE;

    return NextResponse.json({
      dryRun,
      usersScanned: usersSnap.size,
      ordersScanned: ordersSnap.size,
      // When these are present the pass is INCOMPLETE — send them back as
      // afterUser/afterOrder to continue. totalSpent is skipped on a partial
      // pass and is only recomputed once everything fits in one run.
      ...(moreUsers && lastUserId ? { afterUser: lastUserId } : {}),
      ...(moreOrders && lastOrderId ? { afterOrder: lastOrderId } : {}),
      complete: !moreUsers && !moreOrders,
      totalSpentRecomputed: fullPass,
      changeCount: changes.length,
      // Surfaced, not silently ignored: these need a human decision.
      unresolvedAmounts,
      orphanedOrders,
      changes: changes.slice(0, 200),
    });
  } catch (error: any) {
    console.error('Backfill error:', error);
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}
