import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/api/requireAdmin';
import { rateLimit } from '@/lib/api/rateLimit';
import { recordAudit } from '@/lib/api/auditLog';

/**
 * Coupon management.
 *
 * The `coupons` collection has no rule in firestore.rules, so it is
 * default-denied to every client — deliberately. All access goes through here,
 * behind requireAdmin. Do not add a client-side rule: a readable coupon
 * collection hands every visitor a list of working discount codes.
 *
 * Until now these could only be created or disabled by running a script.
 */

const CODE_RE = /^[A-Z0-9_-]{3,32}$/;

export async function GET(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  try {
    const snap = await adminDb.collection('coupons').get();
    const now = Date.now();

    const coupons = snap.docs.map((d) => {
      const c = d.data();
      const expiresAtMs = c.expiresAt?.toMillis?.() ?? null;
      const exhausted = Boolean(c.maxUses) && (c.usedCount ?? 0) >= c.maxUses;
      const expired = expiresAtMs !== null && expiresAtMs <= now;
      return {
        code: d.id,
        discountPercent: c.discountPercent ?? 0,
        isActive: Boolean(c.isActive),
        usedCount: c.usedCount ?? 0,
        maxUses: c.maxUses ?? null,
        expiresAt: expiresAtMs,
        description: c.description ?? '',
        // What actually happens at checkout, rather than just the raw flag —
        // a coupon can be "active" yet exhausted or expired.
        usable: Boolean(c.isActive) && !exhausted && !expired,
        exhausted,
        expired,
      };
    });

    coupons.sort((a, b) => Number(b.usable) - Number(a.usable) || a.code.localeCompare(b.code));
    return NextResponse.json({ coupons });
  } catch (error) {
    console.error('coupons GET error:', error);
    return NextResponse.json({ error: 'Could not load coupons.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const limited = await rateLimit({
    scope: 'admin-coupon', identifier: check.uid, limit: 30, windowMs: 60 * 60 * 1000,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Too many coupon changes. Please wait.' }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body.code ?? '').trim().toUpperCase();
    const discountPercent = Number(body.discountPercent);
    const maxUses = body.maxUses === null || body.maxUses === undefined || body.maxUses === ''
      ? null : Number(body.maxUses);
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    if (!CODE_RE.test(code)) {
      return NextResponse.json(
        { error: 'Code must be 3–32 characters, using A–Z, 0–9, hyphen or underscore.' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      return NextResponse.json({ error: 'Discount must be between 1 and 100.' }, { status: 400 });
    }
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
      return NextResponse.json({ error: 'Usage limit must be a whole number of 1 or more.' }, { status: 400 });
    }
    if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())) {
      return NextResponse.json({ error: 'Expiry must be in the future.' }, { status: 400 });
    }

    // The document id IS the code, matching how create-order looks it up.
    const ref = adminDb.collection('coupons').doc(code);
    if ((await ref.get()).exists) {
      return NextResponse.json(
        { error: `Coupon "${code}" already exists. Edit it instead of recreating it.` },
        { status: 409 },
      );
    }

    await ref.set({
      code,
      discountPercent,
      isActive: true,
      usedCount: 0,
      maxUses,
      expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
      description: String(body.description ?? '').slice(0, 200),
      createdAt: FieldValue.serverTimestamp(),
      createdBy: check.uid,
    });

    await recordAudit({
      action: 'create-coupon',
      actorUid: check.uid,
      details: { code, discountPercent, maxUses, expiresAt: expiresAt?.toISOString() ?? null },
    });

    return NextResponse.json({ success: true, code });
  } catch (error) {
    console.error('coupons POST error:', error);
    return NextResponse.json({ error: 'Could not create the coupon.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body.code ?? '').trim().toUpperCase();
    if (!code) return NextResponse.json({ error: 'Missing coupon code.' }, { status: 400 });

    const ref = adminDb.collection('coupons').doc(code);
    if (!(await ref.get()).exists) {
      return NextResponse.json({ error: 'That coupon does not exist.' }, { status: 404 });
    }

    const patch: Record<string, any> = { updatedAt: FieldValue.serverTimestamp(), updatedBy: check.uid };

    if (typeof body.isActive === 'boolean') patch.isActive = body.isActive;

    if (body.maxUses !== undefined) {
      const maxUses = body.maxUses === null || body.maxUses === '' ? null : Number(body.maxUses);
      if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 0)) {
        return NextResponse.json({ error: 'Usage limit must be a whole number.' }, { status: 400 });
      }
      patch.maxUses = maxUses;
    }

    if (body.expiresAt !== undefined) {
      if (body.expiresAt === null) patch.expiresAt = null;
      else {
        const d = new Date(body.expiresAt);
        if (!Number.isFinite(d.getTime())) {
          return NextResponse.json({ error: 'Invalid expiry date.' }, { status: 400 });
        }
        patch.expiresAt = Timestamp.fromDate(d);
      }
    }

    // usedCount is never editable: it is the audit trail of real redemptions,
    // and resetting it would silently re-open an exhausted coupon.
    await ref.set(patch, { merge: true });

    await recordAudit({
      action: 'update-coupon',
      actorUid: check.uid,
      details: { code, changed: Object.keys(patch).filter((k) => !['updatedAt', 'updatedBy'].includes(k)) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('coupons PATCH error:', error);
    return NextResponse.json({ error: 'Could not update the coupon.' }, { status: 500 });
  }
}
