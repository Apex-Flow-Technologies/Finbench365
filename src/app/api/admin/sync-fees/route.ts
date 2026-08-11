import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/api/requireAdmin';
import { rateLimit } from '@/lib/api/rateLimit';

/**
 * Records what Razorpay actually charged for each paid order.
 *
 * "Net after fees" was computed from a single blended rate (2% + GST on the
 * fee), which is only ever approximately right: Razorpay prices UPI, domestic
 * cards, international cards, net banking and wallets differently, so the real
 * deduction on any given order can be well above or below the blend. That
 * figure could say what was probably taken, never where it went.
 *
 * The payment entity carries `fee` and `tax` in paise — the authoritative
 * amounts. Razorpay documents `fee` as "Fee (including GST) charged by
 * Razorpay" and `tax` as "GST charged for the payment", so `fee` is the total
 * and `tax` is the part of it that is GST. They are split apart below rather
 * than added together.
 *
 * ---------------------------------------------------------------------------
 * DO NOT switch this to the payment LIST endpoint (`GET /v1/payments`).
 *
 * That endpoint returns `fee: 0` and `tax: 0` for every payment, whatever was
 * actually charged. Verified 11 Aug 2026 on one netbanking payment:
 *
 *     GET /v1/payments/pay_TK4c5uEJSWXh6H        fee=1390  tax=212
 *     GET /v1/orders/order_TK4byDzwnYK188/payments  fee=1390  tax=212
 *     GET /v1/payments  (same payment in the list)  fee=0     tax=0
 *
 * Reading fees from the list would silently report every order as costing
 * nothing, and the "net after fees" figure would quietly overstate profit.
 * Fetch per order, as below, or per payment id.
 * ---------------------------------------------------------------------------
 *
 * Read-only against the gateway, and it only ever fills in fees. It cannot
 * move money, change an order's status, or touch anyone's access.
 */

interface FeeRow {
  orderId: string;
  paymentId: string;
  method: string;
  amountPaid: number;
  fee: number;
  tax: number;
}

/** Paise to rupees. Razorpay reports every amount in the minor unit. */
const toRupees = (paise: unknown): number =>
  typeof paise === 'number' ? Math.round(paise) / 100 : 0;

export async function POST(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const limited = await rateLimit({
    scope: 'admin-sync-fees', identifier: check.uid, limit: 10, windowMs: 60 * 60 * 1000,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many sync runs. Please wait.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Razorpay keys are not configured.' }, { status: 500 });
  }
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const body = await req.json().catch(() => ({}));
  // Dry run by default, matching the other admin tools: the caller sees what
  // would be written before anything is.
  const dryRun = body?.dryRun !== false;
  // Re-reading orders already synced is wasted gateway calls, so they are
  // skipped unless the caller explicitly asks for a full refresh.
  const refreshAll = body?.refreshAll === true;

  try {
    const snap = await adminDb.collection('orders').where('status', '==', 'success').get();

    const rows: FeeRow[] = [];
    const unresolved: string[] = [];
    let skipped = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      const orderId = String(data.orderId || '');

      // Comped enrolments never reached the gateway, so there is no fee.
      if (!orderId.startsWith('order_')) { skipped++; continue; }
      if (!refreshAll && typeof data.gatewayFee === 'number') { skipped++; continue; }

      let payments: any[] = [];
      try {
        const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
          headers: { Authorization: `Basic ${auth}` },
        });
        if (!res.ok) { unresolved.push(orderId); continue; }
        payments = (await res.json())?.items ?? [];
      } catch {
        unresolved.push(orderId);
        continue;
      }

      const captured = payments.find((p: any) => p.status === 'captured');
      // A fee of 0 is a real answer; a missing one is not. Only `fee` being
      // absent entirely means the gateway could not tell us.
      if (!captured || typeof captured.fee !== 'number') {
        unresolved.push(orderId);
        continue;
      }

      const row: FeeRow = {
        orderId,
        paymentId: captured.id,
        method: captured.method ?? 'unknown',
        amountPaid: toRupees(captured.amount),
        // Razorpay's `fee` is inclusive of `tax`; splitting them out is what
        // lets the export show the fee and its GST as separate lines.
        fee: toRupees(captured.fee - (captured.tax ?? 0)),
        tax: toRupees(captured.tax),
      };
      rows.push(row);

      if (!dryRun) {
        await doc.ref.set({
          gatewayFee: row.fee,
          gatewayFeeTax: row.tax,
          paymentMethod: row.method,
        }, { merge: true });
      }
    }

    const totalFee = rows.reduce((a, r) => a + r.fee + r.tax, 0);

    return NextResponse.json({
      dryRun,
      ordersScanned: snap.size,
      skipped,
      synced: rows.length,
      totalFeeCharged: Math.round(totalFee * 100) / 100,
      // Surfaced rather than silently treated as zero-fee: an order the gateway
      // cannot account for must not quietly improve the net figure.
      unresolved,
      rows: rows.slice(0, 200),
    });
  } catch (error: any) {
    console.error('sync-fees error:', error);
    return NextResponse.json({ error: 'Fee sync failed' }, { status: 500 });
  }
}
