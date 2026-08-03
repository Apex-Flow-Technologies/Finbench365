import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { PLAN_PRICING, GST_RATE } from '@/constants/pricing';
import { Timestamp, FieldValue, Transaction } from 'firebase-admin/firestore';
import { sendInvoiceEmail } from '@/lib/email';

interface GrantParams {
  userId: string;
  planId: string;
  courseId: string;
  paymentId: string;
  orderId: string;
  amountPaid: number; // rupees, final amount actually paid (incl. GST)
  source: 'verify' | 'webhook' | 'reconcile' | 'coupon' | 'admin';
  /**
   * 'grant' (default) sets access to now + the plan's duration.
   * 'extend' adds the duration on top of any remaining access instead.
   *
   * This distinction matters: a plain grant on a student who still has 40 days
   * left would SHORTEN their access to the plan length. Extending must only
   * ever move the expiry forward.
   */
  mode?: 'grant' | 'extend';
  /** Suppresses the invoice email — an admin grant is not a purchase. */
  skipInvoiceEmail?: boolean;
  /**
   * Coupon that produced this sale, if any. Falls back to the code stored on
   * the order, so verify/webhook/reconcile do not need to know about coupons.
   * Its usedCount is incremented here — see the note in the transaction.
   */
  couponCode?: string | null;
}

interface GrantResult {
  granted: boolean;
  alreadyProcessed: boolean;
}

/**
 * Single source of truth for turning a confirmed Razorpay payment into course
 * access. Idempotent on orderId: safe to call multiple times (client verify,
 * webhook, and reconciliation can all race for the same order) because the
 * grant + order-status write happen in one transaction keyed off orders/{orderId}.
 * Side effects that must only ever fire once (billing total, invoice email)
 * are only run when this call is the one that actually transitioned the order.
 */
export async function grantEntitlementIdempotent(params: GrantParams): Promise<GrantResult> {
  const { userId, planId, courseId, paymentId, orderId, amountPaid, source,
          mode = 'grant', skipInvoiceEmail = false, couponCode = null } = params;

  const planData = PLAN_PRICING[planId];
  if (!planData) {
    throw new Error(`Invalid planId: ${planId}`);
  }
  if (!userId || !courseId || !orderId || !paymentId) {
    throw new Error('Missing required fields for entitlement grant');
  }

  const orderRef = adminDb.collection('orders').doc(orderId);
  const userRef = adminDb.collection('users').doc(userId);

  const alreadyProcessed = await adminDb.runTransaction(async (tx: Transaction) => {
    // Firestore requires every read in a transaction to happen before any
    // write, so both reads are issued up front even though the user document
    // is only needed for 'extend'.
    // Cast because tx.get() resolves to its Query overload against a plain
    // DocumentReference under these firebase-admin typings, which made every
    // .exists/.data() in this transaction a type error and buried real ones.
    const [existing, userSnap] = await Promise.all([
      tx.get(orderRef), tx.get(userRef),
    ]) as unknown as [FirebaseFirestore.DocumentSnapshot, FirebaseFirestore.DocumentSnapshot];

    if (existing.exists && existing.data()?.status === 'success') {
      return true;
    }

    // A coupon use is consumed when a sale completes, not when a checkout is
    // opened. create-order used to increment on order creation, so every
    // abandoned checkout permanently burned a use — a 50-use code could be
    // exhausted without a single sale. Counting here means the number in the
    // admin panel is the number of redemptions that actually happened.
    //
    // An admin grant is not a redemption, so it never touches the count.
    const effectiveCoupon = source === 'admin'
      ? null
      : (couponCode ?? (existing.exists ? existing.data()?.couponCode : null) ?? null);
    const couponRef = effectiveCoupon
      ? adminDb.collection('coupons').doc(String(effectiveCoupon).toUpperCase())
      : null;
    // Still a read, and still before any write below.
    const couponSnap = couponRef
      ? (await tx.get(couponRef)) as unknown as FirebaseFirestore.DocumentSnapshot
      : null;

    const days = planData.durationDays;

    // Extending measures from whatever access remains, never from today —
    // otherwise topping up a student with 40 days left would cut them back to
    // the plan length. A lapsed entitlement restarts from now.
    let base = Date.now();
    if (mode === 'extend') {
      const current = userSnap.exists
        ? (userSnap.data()?.enrolledCourses ?? {})[courseId]
        : null;
      const currentMs = current?.expiresAt?.toMillis?.()
        ?? (current?.expiresAt ? new Date(current.expiresAt).getTime() : 0);
      if (Number.isFinite(currentMs) && currentMs > base) base = currentMs;
    }

    const expiresAt = new Date(base);
    expiresAt.setDate(expiresAt.getDate() + days);

    tx.set(userRef, {
      enrolledCourses: {
        [courseId]: {
          expiresAt: Timestamp.fromDate(expiresAt),
          enrolledAt: FieldValue.serverTimestamp(),
          durationDays: days,
          planId,
          paymentId,
        },
      },
      totalSpent: FieldValue.increment(amountPaid),
      lastPaymentAt: FieldValue.serverTimestamp(),
      // Clear any dangling create-order dedup pointer for this course now that it's resolved
      pendingOrder: FieldValue.delete(),
    }, { merge: true });

    // create-order already stored the DISCOUNTED base and GST for this order.
    // Recomputing them from the plan catalogue here would overwrite a coupon
    // order's real figures with list price and overstate revenue, so only fall
    // back to the catalogue when the order carries no breakdown of its own.
    const prior = existing.exists ? existing.data()! : {};
    const amountBase = prior.amountBase ?? planData.price;
    const gstAmount = prior.gstAmount ?? Math.round((planData.price * GST_RATE) * 100) / 100;

    tx.set(orderRef, {
      userId,
      courseId,
      planId,
      paymentId,
      orderId,
      amount: planData.price,
      // Explicit money fields, so admin revenue never has to infer whether a
      // stored figure includes GST. amountPaid is what actually changed hands
      // (0 for a comped/coupon grant), amountBase/gstAmount describe the sale.
      amountBase,
      gstAmount,
      amountPaid,
      status: 'success',
      grantedVia: source,
      // Only on first creation. Without this, orders born here (coupon grants
      // and webhook-first payments) carried no createdAt and were silently
      // dropped from any admin query ordered by that field.
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
      ...(effectiveCoupon ? { couponCode: effectiveCoupon } : {}),
    }, { merge: true });

    if (couponRef && couponSnap?.exists) {
      tx.update(couponRef, {
        usedCount: FieldValue.increment(1),
        lastRedeemedAt: FieldValue.serverTimestamp(),
      });
    }

    return false;
  });

  if (alreadyProcessed) {
    return { granted: false, alreadyProcessed: true };
  }

  // Side effects that must run exactly once — outside the transaction since
  // they're network calls, not Firestore writes.
  try {
    const userRecord = await adminAuth.getUser(userId);

    // Denormalise the email onto the order so the admin list never needs a
    // per-row lookup. Best-effort and outside the transaction: a failure here
    // must not undo a granted entitlement.
    if (userRecord.email) {
      orderRef.set({ userEmail: userRecord.email }, { merge: true })
        .catch((e: any) => console.error('Could not denormalise userEmail on order:', e));
    }

    if (userRecord.email && !skipInvoiceEmail) {
      const courseDoc = await adminDb.collection('courses').doc(courseId).get();
      const courseTitle = courseDoc.exists ? courseDoc.data()?.title : 'Certification Track';

      const basePrice = planData.price;
      const gstAmount = basePrice * GST_RATE;

      await sendInvoiceEmail({
        email: userRecord.email,
        name: userRecord.displayName || 'Candidate',
        courseTitle,
        planName: planData.name,
        orderId,
        amount: basePrice,
        gstAmount,
        total: amountPaid,
      });
    }
  } catch (emailErr) {
    console.error(`Failed to send invoice email (source=${source}, orderId=${orderId}):`, emailErr);
  }

  return { granted: true, alreadyProcessed: false };
}
