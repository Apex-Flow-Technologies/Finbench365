import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Transaction } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/api/requireAdmin';

/**
 * Refunds a paid order through Razorpay and withdraws the access it bought.
 *
 * Until now "refunding" a candidate marked the order `refunded` in Firestore
 * and revoked their access — but never contacted Razorpay, so no money ever
 * moved. The ledger said the customer had been repaid while their card had not
 * been touched. This endpoint is the missing half.
 *
 * Order of operations matters. The gateway is called FIRST and access is
 * withdrawn only once it confirms. Revoking first would, on a gateway failure,
 * leave a candidate who has paid with neither their money nor their course.
 */

const RAZORPAY_API = 'https://api.razorpay.com/v1';

export async function POST(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Payment gateway is not configured.' }, { status: 503 });
  }

  try {
    const { orderId, revokeAccess = true } = await req.json() as {
      orderId?: string;
      revokeAccess?: boolean;
    };
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    // Typed explicitly — `adminDb` is `any`, so an untyped ref makes tx.get()
    // resolve to the Query overload and `.exists` stops type-checking.
    const orderRef: FirebaseFirestore.DocumentReference =
      adminDb.collection('orders').doc(orderId);

    /**
     * Claim the order before touching the gateway.
     *
     * Code Red Payments #9 — "a refund can be processed twice for the same
     * order" — is a real risk here: two quick clicks are two requests, and
     * Razorpay will happily issue a second refund against a payment that still
     * has balance. Marking the order `refund_pending` inside a transaction means
     * only one request can ever reach the gateway.
     */
    const claim = await adminDb.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) return { ok: false as const, status: 404, error: 'Order not found.' };

      const data = snap.data()!;
      if (data.status === 'refunded') {
        return { ok: false as const, status: 409, error: 'This order has already been refunded.' };
      }
      if (data.status === 'refund_pending') {
        return { ok: false as const, status: 409, error: 'A refund for this order is already in progress.' };
      }
      if (data.status !== 'success') {
        return { ok: false as const, status: 400, error: `Only a paid order can be refunded (this one is "${data.status}").` };
      }
      if (!data.paymentId || String(data.orderId ?? '').startsWith('BYPASS-')) {
        return {
          ok: false as const, status: 400,
          error: 'This enrolment was comped, not paid for — there is nothing to refund. Revoke access instead.',
        };
      }

      tx.update(orderRef, {
        status: 'refund_pending',
        refundRequestedAt: FieldValue.serverTimestamp(),
        refundRequestedBy: check.uid,
      });
      return {
        ok: true as const,
        paymentId: data.paymentId as string,
        userId: data.userId as string,
        courseId: data.courseId as string,
        amountPaid: data.amountPaid as number | undefined,
      };
    });

    if (!claim.ok) {
      return NextResponse.json({ error: claim.error }, { status: claim.status });
    }

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    let refund: any;

    try {
      const res = await fetch(`${RAZORPAY_API}/payments/${claim.paymentId}/refund`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
          // Razorpay de-duplicates on this key, so a retried request cannot
          // become a second refund even if our own guard were bypassed.
          'X-Razorpay-Idempotency': `refund_${orderId}`,
        },
        // No amount: a full refund of whatever was captured. Deriving it from
        // our stored figure risks refunding more than was actually taken.
        body: JSON.stringify({ speed: 'normal', notes: { orderId, refundedBy: check.uid } }),
      });
      refund = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Put the order back so it can be retried or handled by hand.
        await orderRef.update({
          status: 'success',
          refundFailedAt: FieldValue.serverTimestamp(),
          refundError: refund?.error?.description ?? `HTTP ${res.status}`,
        });
        console.error('Razorpay refund rejected:', orderId, refund?.error);
        return NextResponse.json(
          { error: refund?.error?.description || 'Razorpay rejected the refund.' },
          { status: 502 },
        );
      }
    } catch (err: any) {
      // Network failure — we cannot tell whether Razorpay processed it. Leave
      // the order in refund_pending so nobody issues a second one blindly.
      console.error('Refund call threw for', orderId, err);
      await orderRef.update({
        refundError: `Network failure: ${err?.message ?? 'unknown'}. Check the Razorpay dashboard before retrying.`,
      });
      return NextResponse.json(
        { error: 'Could not reach Razorpay. Check the dashboard before retrying — the refund may have gone through.' },
        { status: 504 },
      );
    }

    // Gateway confirmed. Now it is safe to withdraw access.
    await orderRef.update({
      status: 'refunded',
      refundId: refund?.id ?? null,
      refundAmount: typeof refund?.amount === 'number' ? refund.amount / 100 : null,
      refundStatus: refund?.status ?? null,
      refundedAt: FieldValue.serverTimestamp(),
      refundedBy: check.uid,
      refundError: FieldValue.delete(),
    });

    if (revokeAccess && claim.userId && claim.courseId) {
      await adminDb.collection('users').doc(claim.userId).update({
        [`enrolledCourses.${claim.courseId}`]: FieldValue.delete(),
      }).catch((e: any) => console.error('Refunded but could not revoke access:', orderId, e));
    }

    // totalSpent is a running total of what a candidate has actually paid, so a
    // refund has to come back off it or lifetime value stays overstated forever.
    if (claim.userId && typeof claim.amountPaid === 'number' && claim.amountPaid > 0) {
      await adminDb.collection('users').doc(claim.userId).update({
        totalSpent: FieldValue.increment(-claim.amountPaid),
      }).catch(() => {});
    }

    console.log(`Refund issued: order=${orderId} refund=${refund?.id} by=${check.uid}`);
    return NextResponse.json({
      success: true,
      refundId: refund?.id ?? null,
      amount: typeof refund?.amount === 'number' ? refund.amount / 100 : null,
      status: refund?.status ?? null,
      accessRevoked: Boolean(revokeAccess),
    });

  } catch (error: any) {
    console.error('Refund endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
