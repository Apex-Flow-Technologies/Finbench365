import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

/**
 * READ-ONLY. Asks Razorpay what actually happened to the orders Firestore
 * still has sitting in 'created'.
 *
 * Fetches order + payment status and prints it. It captures nothing, refunds
 * nothing, grants nothing and writes nothing — to anywhere. Healing a genuinely
 * paid order is the admin panel's "Reconcile Stuck Orders" button, which is
 * authenticated and audited; this only tells you whether pressing it matters.
 */
async function main() {
  const { adminDb } = await import('../src/lib/firebase/admin');

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) { console.log('Razorpay keys not configured'); process.exit(1); }
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  console.log(`using key ${keyId.slice(0, 12)}…  (live keys start rzp_live_)\n`);

  const snap = await adminDb.collection('orders').where('status', '==', 'created').get();
  const ms = (v: any) => v?.toMillis?.() ?? (v ? new Date(v).getTime() : 0);

  const rows = snap.docs
    .map((d: any) => d.data())
    .filter((o: any) => String(o.orderId || '').startsWith('order_'))
    .sort((a: any, b: any) => ms(b.createdAt) - ms(a.createdAt));

  console.log(`checking ${rows.length} stuck order(s) against Razorpay…\n`);

  const paid: any[] = [];
  for (const o of rows) {
    const when = ms(o.createdAt) ? new Date(ms(o.createdAt)).toISOString().slice(0, 10) : '??';
    try {
      const r = await fetch(`https://api.razorpay.com/v1/orders/${o.orderId}`,
                            { headers: { Authorization: `Basic ${auth}` } });
      if (!r.ok) {
        console.log(`  ${when}  ${o.orderId.padEnd(22)} gateway says: HTTP ${r.status}`
                  + (r.status === 400 ? '  (unknown to this key — created under the old test key)' : ''));
        continue;
      }
      const od: any = await r.json();

      let captured: any = null;
      if (od.status !== 'created') {
        const pr = await fetch(`https://api.razorpay.com/v1/orders/${o.orderId}/payments`,
                               { headers: { Authorization: `Basic ${auth}` } });
        if (pr.ok) captured = ((await pr.json()).items || []).find((p: any) => p.status === 'captured');
      }

      const flag = captured ? '  <<< MONEY TAKEN, ACCESS NEVER GRANTED' : '';
      console.log(`  ${when}  ${o.orderId.padEnd(22)} razorpay=${String(od.status).padEnd(9)}`
                + ` amt_due=${(od.amount ?? 0) / 100} captured=${captured ? captured.amount / 100 : '-'}${flag}`);
      if (captured) paid.push({ ...o, captured });
    } catch (e: any) {
      console.log(`  ${when}  ${o.orderId.padEnd(22)} lookup failed: ${e.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  if (paid.length === 0) {
    console.log('NONE of the stuck orders were actually paid.');
    console.log('They are abandoned checkouts — someone opened the payment sheet and left.');
    console.log('No customer is owed anything. Nothing to do.');
  } else {
    console.log(`${paid.length} STUCK ORDER(S) WERE ACTUALLY PAID — customers are owed access:`);
    paid.forEach((p) => console.log(`  ${p.userEmail || p.userId}  Rs.${p.captured.amount / 100}  ${p.orderId}`));
    console.log('\nFix: admin panel -> Orders -> "Reconcile Stuck Orders". It re-checks');
    console.log('each one against Razorpay and grants access, idempotently.');
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
