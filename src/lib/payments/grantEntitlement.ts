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
  source: 'verify' | 'webhook' | 'reconcile';
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

  const orderRef = adminDb.collection('orders').doc(orderId);
  const userRef = adminDb.collection('users').doc(userId);

  const alreadyProcessed = await adminDb.runTransaction(async (tx: Transaction) => {
    const existing = await tx.get(orderRef);
    if (existing.exists && existing.data()?.status === 'success') {
      return true;
    }

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
          paymentId,
        },
      },
      totalSpent: FieldValue.increment(amountPaid),
      lastPaymentAt: FieldValue.serverTimestamp(),
      // Clear any dangling create-order dedup pointer for this course now that it's resolved
      pendingOrder: FieldValue.delete(),
    }, { merge: true });

    tx.set(orderRef, {
      userId,
      courseId,
      planId,
      paymentId,
      orderId,
      amount: planData.price,
      status: 'success',
      grantedVia: source,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return false;
  });

  if (alreadyProcessed) {
    return { granted: false, alreadyProcessed: true };
  }

  // Side effects that must run exactly once — outside the transaction since
  // they're network calls, not Firestore writes.
  try {
    const userRecord = await adminAuth.getUser(userId);
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
