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
  source: 'verify' | 'webhook' | 'reconcile' | 'coupon';
  /**
   * Only needed for grants where no order document exists yet — i.e. a fully
   * discounted enrolment, which never round-trips through the gateway. For every
   * paid order the code is read back off the order written by create-order.
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
  const { userId, planId, courseId, paymentId, orderId, amountPaid, source } = params;

  const planData = PLAN_PRICING[planId];
  if (!planData) {
    throw new Error(`Invalid planId: ${planId}`);
  }
  if (!userId || !courseId || !orderId || !paymentId) {
    throw new Error('Missing required fields for entitlement grant');
  }

  // Explicitly typed. `adminDb` is `any` (see lib/firebase/admin.ts), so an
  // untyped ref makes tx.get() resolve to the Query overload and every
  // `.exists` / `.data()` below becomes a type error.
  const orderRef: FirebaseFirestore.DocumentReference =
    adminDb.collection('orders').doc(orderId);
  const userRef: FirebaseFirestore.DocumentReference =
    adminDb.collection('users').doc(userId);

  const alreadyProcessed = await adminDb.runTransaction(async (tx: Transaction) => {
    const existing = await tx.get(orderRef);
    if (existing.exists && existing.data()?.status === 'success') {
      return true;
    }

    // A coupon is spent when an order is actually paid for, not when a checkout
    // is opened. create-order used to increment `usedCount` during validation,
    // before Razorpay was even called, so every abandoned checkout permanently
    // consumed a use — a launch coupon could be exhausted entirely by people who
    // never paid. Doing it here ties the increment to the same transaction that
    // transitions the order, so it happens exactly once per real redemption.
    //
    // Both reads must happen before any write in a Firestore transaction, so
    // this is resolved up front.
    const code: string | null =
      params.couponCode ?? existing.data()?.couponCode ?? null;
    const couponRef: FirebaseFirestore.DocumentReference | null =
      code ? adminDb.collection('coupons').doc(code) : null;
    const couponSnap = couponRef ? await tx.get(couponRef) : null;

    const days = planData.durationDays;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    tx.set(userRef, {
      enrolledCourses: {
        [courseId]: {
          expiresAt: Timestamp.fromDate(expiresAt),
          enrolledAt: FieldValue.serverTimestamp(),
          durationDays: days,
          planId,
          // Written alongside planId because Firestore rules cannot look a plan
          // up in a table — gating a study note on "60-day plan only" comes down
          // to comparing this number against the note's minimum tier.
          planTier: planData.tier,
          paymentId,
        },
      },
      totalSpent: FieldValue.increment(amountPaid),
      lastPaymentAt: FieldValue.serverTimestamp(),
      // Clear any dangling create-order dedup pointer for this course now that it's resolved
      pendingOrder: FieldValue.delete(),
    }, { merge: true });

    const gstAmount = Math.round((planData.price * GST_RATE) * 100) / 100;

    tx.set(orderRef, {
      userId,
      courseId,
      planId,
      paymentId,
      orderId,
      amount: planData.price,
      // Explicit money fields, so admin revenue never has to infer whether a
      // stored figure includes GST. amountPaid is what actually changed hands
      // (0 for a comped/coupon grant), amountBase/gstAmount describe the plan.
      amountBase: planData.price,
      gstAmount,
      amountPaid,
      status: 'success',
      grantedVia: source,
      // Only on first creation. Without this, orders born here (coupon grants
      // and webhook-first payments) carried no createdAt and were silently
      // dropped from any admin query ordered by that field.
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    if (couponRef && couponSnap?.exists) {
      tx.update(couponRef, { usedCount: FieldValue.increment(1) });

      // The money has already changed hands by the time we get here, so an
      // over-limit redemption is reported rather than refused — refusing would
      // mean taking payment and withholding access. This can only happen when
      // several candidates pass validation and pay in the same instant, and it
      // is worth knowing about.
      const data = couponSnap.data()!;
      if (data.maxUses && (data.usedCount ?? 0) >= data.maxUses) {
        console.warn(
          `Coupon ${code} redeemed beyond maxUses (${data.usedCount}/${data.maxUses}) on order ${orderId} — concurrent checkouts.`,
        );
      }
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
        .catch((e) => console.error('Could not denormalise userEmail on order:', e));
    }

    if (userRecord.email) {
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
