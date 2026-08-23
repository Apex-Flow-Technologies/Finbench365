import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { PLAN_PRICING, GST_RATE } from '@/constants/pricing';
import { Timestamp, FieldValue, Transaction } from 'firebase-admin/firestore';
import { sendInvoiceEmail } from '@/lib/email';
import { couponRedemptionKey } from '@/lib/payments/coupons';

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

  // The candidate's address, resolved before the transaction for two reasons:
  // the redemption ledger written inside it is keyed on the address, and a
  // transaction callback can be retried, so a network call in there would be
  // repeated. The invoice below reuses this same record, so it costs nothing.
  //
  // Falls back to the copy create-order denormalises onto the user document.
  // Neither lookup may fail the grant: by the time this runs the money has
  // already moved, and withholding access over an email lookup would be worse
  // than not recording the redemption.
  let userRecord: any = null;
  let candidateEmail: string | null = null;
  try {
    userRecord = await adminAuth.getUser(userId);
    candidateEmail = userRecord?.email ?? null;
  } catch (err) {
    console.error(`Could not load the auth record for ${userId}:`, err);
  }
  if (!candidateEmail) {
    try {
      candidateEmail = (await userRef.get()).data()?.email ?? null;
    } catch (err) {
      console.error(`Could not read an email off users/${userId}:`, err);
    }
  }
  const redemptionKey = couponRedemptionKey(candidateEmail);

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

    // The ledger that makes a coupon spendable once per candidate, for good.
    //
    // Read inside the transaction rather than before it: this read is what
    // serialises two checkouts racing with the same code and address, because
    // a transaction locks the documents it reads. The loser sees it already
    // there. The pre-checks in create-order and validate-coupon are plain
    // reads and cannot do that on their own.
    //
    // It sits next to the coupon read because a Firestore transaction requires
    // every read to happen before any write, not next to the increment below
    // that it actually guards.
    const redemptionRef: FirebaseFirestore.DocumentReference | null =
      couponRef && redemptionKey
        ? couponRef.collection('redemptions').doc(redemptionKey)
        : null;
    const redemptionSnap = redemptionRef ? await tx.get(redemptionRef) : null;

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
      if (redemptionSnap?.exists) {
        // Already spent by this candidate. The grant still goes through — the
        // money has moved and the access is paid for — but the code must not
        // count a second use, or a candidate renewing every month would burn
        // a launch coupon's whole allowance on their own.
        console.warn(
          `Coupon ${code} re-presented on order ${orderId} by an address that has already redeemed it — not counted again.`,
        );
      } else {
        tx.update(couponRef, { usedCount: FieldValue.increment(1) });

        if (redemptionRef) {
          // tx.set, not tx.create: create throws on a conflict, and a throw in
          // here fails the whole transaction — which would withhold access
          // someone has already paid for.
          tx.set(redemptionRef, {
            email: candidateEmail,
            userId,
            orderId,
            courseId,
            redeemedAt: FieldValue.serverTimestamp(),
          });
        } else {
          // No address to key on, so this redemption cannot be held against a
          // future one. The use is still counted; the gap is worth knowing.
          console.warn(
            `Coupon ${code} redeemed on order ${orderId} with no resolvable email — not recorded against a candidate.`,
          );
        }

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
    }

    return false;
  });

  if (alreadyProcessed) {
    return { granted: false, alreadyProcessed: true };
  }

  // Side effects that must run exactly once — outside the transaction since
  // they're network calls, not Firestore writes.
  try {
    // Denormalise the email onto the order so the admin list never needs a
    // per-row lookup. Best-effort and outside the transaction: a failure here
    // must not undo a granted entitlement.
    if (candidateEmail) {
      orderRef.set({ userEmail: candidateEmail }, { merge: true })
        .catch((e) => console.error('Could not denormalise userEmail on order:', e));
    }

    if (candidateEmail) {
      const courseDoc = await adminDb.collection('courses').doc(courseId).get();
      const courseTitle = courseDoc.exists ? courseDoc.data()?.title : 'Certification Track';

      const basePrice = planData.price;
      const gstAmount = basePrice * GST_RATE;

      await sendInvoiceEmail({
        email: candidateEmail,
        name: userRecord?.displayName || 'Candidate',
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
