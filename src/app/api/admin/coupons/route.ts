import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/api/requireAdmin';
import { rateLimit } from '@/lib/api/rateLimit';
import { normaliseCouponCode, evaluateCoupon, couponCourseIds } from '@/lib/payments/coupons';

/**
 * Creating and managing discount codes.
 *
 * Coupons used to be created by running a committed script — which is how
 * TESTER100, a live 100%-off code with no expiry, ended up in version control.
 * A discount is a commercial decision, so it belongs behind the admin login
 * where it can be seen, limited and switched off.
 *
 * Every route here uses the Admin SDK deliberately. `coupons` has no Firestore
 * rule at all, so a browser cannot read or write one: a client-readable coupon
 * collection would let anyone enumerate every code on the site, including a
 * 100%-off one.
 */

/** Codes are the document id, so they must be safe to put in a path. */
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

/**
 * An upper bound on how many exams one code may be scoped to, so a malformed
 * or hostile request cannot turn one coupon into a getAll() of arbitrary size.
 * The catalogue is far smaller than this; scoping to more exams than the
 * catalogue holds is the same as scoping to none, which is already a choice.
 */
const MAX_SCOPED_EXAMS = 50;

function serialise(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  const d = doc.data() ?? {};
  const evaluation = evaluateCoupon(d);  // no courseId: not a purchase
  return {
    code: doc.id,
    discountPercent: d.discountPercent ?? 0,
    isActive: d.isActive ?? false,
    maxUses: d.maxUses ?? null,
    usedCount: d.usedCount ?? 0,
    expiresAt: d.expiresAt?.toDate?.()?.toISOString() ?? null,
    createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
    description: d.description ?? null,
    // Empty means every exam, which is how coupons behaved before scoping.
    // Read through the shared helper so codes still carrying the original
    // single `courseId` report their scope the same way as newer ones.
    courseIds: couponCourseIds(d),
    // The same judgement a candidate's checkout would make, so the admin list
    // cannot say "Active" about a code that is exhausted or out of date.
    usable: evaluation.valid,
    unusableReason: evaluation.reason ?? null,
  };
}

export async function GET(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const snap = await adminDb.collection('coupons').get();
  const coupons = snap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => serialise(d))
    .sort((a: { createdAt: string | null }, b: { createdAt: string | null }) =>
      (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return NextResponse.json({ coupons });
}

export async function POST(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const limited = await rateLimit({
    scope: 'admin-coupons', identifier: check.uid, limit: 60, windowMs: 60 * 60 * 1000,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Too many changes. Please wait.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const code = normaliseCouponCode(String(body?.code ?? ''));
  const discountPercent = Number(body?.discountPercent);

  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json({
      error: 'Use 3–32 characters: letters, numbers, hyphen or underscore, starting with a letter or number.',
    }, { status: 400 });
  }
  if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 100) {
    return NextResponse.json({ error: 'Discount must be between 1 and 100 percent.' }, { status: 400 });
  }

  // maxUses absent means unlimited, which is a real choice — but it has to be
  // the explicit one, not the result of leaving a field blank by accident.
  const maxUsesRaw = body?.maxUses;
  const maxUses = maxUsesRaw === null || maxUsesRaw === undefined || maxUsesRaw === ''
    ? null
    : Number(maxUsesRaw);
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
    return NextResponse.json({ error: 'Usage limit must be a whole number of 1 or more.' }, { status: 400 });
  }

  let expiresAt: Timestamp | null = null;
  if (body?.expiresAt) {
    const when = new Date(body.expiresAt);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: 'Expiry date is not a valid date.' }, { status: 400 });
    }
    if (when.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Expiry date is in the past.' }, { status: 400 });
    }
    expiresAt = Timestamp.fromDate(when);
  }

  // Restricting a code to a set of exams is what stops a discount meant for a
  // few exams being spent across the whole catalogue. An empty list means every
  // exam, which is how every coupon created before scoping behaved.
  //
  // The singular `courseId` is still accepted because the first version of this
  // endpoint took it, and an older client posting one should keep working.
  const rawIds: unknown[] = Array.isArray(body?.courseIds)
    ? body.courseIds
    : (body?.courseId ? [body.courseId] : []);

  // Deduplicated: the same exam twice would double the existence check and read
  // back as a scope wider than it is.
  const courseIds = Array.from(new Set(
    rawIds
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.trim())
      .filter(Boolean),
  ));

  if (courseIds.length > MAX_SCOPED_EXAMS) {
    return NextResponse.json({
      error: `A code can be limited to at most ${MAX_SCOPED_EXAMS} exams. Leave it unrestricted instead.`,
    }, { status: 400 });
  }

  if (courseIds.length > 0) {
    // One round trip for the whole set — a getAll rather than a get per id, so
    // scoping to ten exams is not ten sequential reads.
    const snaps = await adminDb.getAll(
      ...courseIds.map((id) => adminDb.collection('courses').doc(id)),
    );
    const missing = snaps
      .filter((snap: FirebaseFirestore.DocumentSnapshot) => !snap.exists)
      .map((snap: FirebaseFirestore.DocumentSnapshot) => snap.id);
    if (missing.length > 0) {
      return NextResponse.json({
        error: missing.length === 1
          ? 'That exam does not exist.'
          : `These exams do not exist: ${missing.join(', ')}.`,
      }, { status: 400 });
    }
  }

  const ref = adminDb.collection('coupons').doc(code);

  try {
    // create() rather than set(): overwriting an existing code would silently
    // reset its usage count, quietly handing out a spent discount again.
    await ref.create({
      discountPercent,
      isActive: body?.isActive === false ? false : true,
      maxUses,
      // Always an array, even when empty. Codes predating this still carry the
      // singular `courseId`; couponCourseIds() reads either shape, so there is
      // no migration to run and no half-migrated state to reason about.
      courseIds,
      usedCount: 0,
      expiresAt,
      description: typeof body?.description === 'string' && body.description.trim()
        ? body.description.trim().slice(0, 140)
        : null,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: check.uid,
    });
  } catch (err: any) {
    if (err?.code === 6 || String(err?.message).includes('ALREADY_EXISTS')) {
      return NextResponse.json({ error: `The code ${code} already exists.` }, { status: 409 });
    }
    console.error('Coupon create failed:', err);
    return NextResponse.json({ error: 'Could not create the coupon.' }, { status: 500 });
  }

  console.log(`Coupon ${code} created by ${check.uid}: ${discountPercent}% off`);
  return NextResponse.json({ coupon: serialise(await ref.get()) }, { status: 201 });
}

/**
 * Switches a coupon on or off, or changes its usage limit.
 *
 * The discount percentage is deliberately NOT editable. Changing it would
 * rewrite the terms of a code that may already be circulating, and anyone
 * holding the old figure would be charged something different from what they
 * were promised. Switch it off and make a new one instead.
 */
export async function PATCH(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await req.json().catch(() => ({}));
  const code = normaliseCouponCode(String(body?.code ?? ''));
  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: 'Unknown coupon code.' }, { status: 400 });
  }

  const ref = adminDb.collection('coupons').doc(code);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Unknown coupon code.' }, { status: 404 });

  const patch: Record<string, any> = {};
  if (typeof body?.isActive === 'boolean') patch.isActive = body.isActive;

  if (body?.maxUses !== undefined) {
    const n = body.maxUses === null || body.maxUses === '' ? null : Number(body.maxUses);
    if (n !== null && (!Number.isInteger(n) || n < 1)) {
      return NextResponse.json({ error: 'Usage limit must be a whole number of 1 or more.' }, { status: 400 });
    }
    patch.maxUses = n;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  }

  await ref.update(patch);
  console.log(`Coupon ${code} updated by ${check.uid}: ${JSON.stringify(patch)}`);
  return NextResponse.json({ coupon: serialise(await ref.get()) });
}
