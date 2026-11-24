import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Admin SDK imported dynamically: a static import is hoisted above
// dotenv.config() and would initialise before the credentials exist.

/**
 * Firebase health check after the Spark downgrade.
 *
 * Spark does not disable Firestore — it caps it (50k reads / 20k writes a day).
 * Past the cap, operations are REJECTED, so the failure looks like an outage
 * that heals at midnight Pacific and returns the next day. That means two
 * separate questions:
 *   1. Does it work right now?  (reads AND writes — writes fail first)
 *   2. What broke while it was capped? (payments that never became access)
 */
const DAY = 86400000;

async function main() {
  const { adminDb, adminAuth } = await import('../src/lib/firebase/admin');

  let ok = true;
  const fail = (m: string) => { ok = false; console.log('  FAIL  ' + m); };
  const pass = (m: string) => console.log('  PASS  ' + m);

  // ---------------------------------------------------------------- 1. READ
  console.log('\n=== 1. CAN IT READ? ===');
  let users: any, orders: any, courses: any, tests: any;
  try {
    [users, orders, courses, tests] = await Promise.all([
      adminDb.collection('users').get(),
      adminDb.collection('orders').get(),
      adminDb.collection('courses').get(),
      adminDb.collection('mock_tests').get(),
    ]);
    pass(`read ok — ${users.size} users, ${orders.size} orders, ${courses.size} courses, ${tests.size} tests`);
  } catch (e: any) {
    fail('READ BLOCKED: ' + e.message);
    console.log('\nFirestore is still rejecting reads. Stop here.');
    process.exit(1);
  }

  // --------------------------------------------------------------- 2. WRITE
  // The real test. Reads are cheap and rarely hit the cap; writes are what
  // actually stopped working, and what a purchase needs.
  console.log('\n=== 2. CAN IT WRITE? (what a purchase actually needs) ===');
  const probe = adminDb.collection('_healthcheck').doc('probe');
  try {
    await probe.set({ at: new Date().toISOString(), by: 'fbcheck' });
    const back = await probe.get();
    if (back.exists) pass('write + read-back ok'); else fail('wrote but could not read back');
    await probe.delete();
    pass('delete ok — probe cleaned up');
  } catch (e: any) {
    fail('WRITE BLOCKED: ' + e.message);
  }

  // ---------------------------------------------------------------- 3. AUTH
  console.log('\n=== 3. AUTH ===');
  try {
    const list = await adminAuth.listUsers(5);
    pass(`auth ok — ${list.users.length} accounts readable`);
  } catch (e: any) {
    fail('AUTH BLOCKED: ' + e.message);
  }

  // -------------------------------------------------------- 4. DAMAGE SCAN
  console.log('\n=== 4. DID ANYTHING BREAK WHILE IT WAS CAPPED? ===');

  const ms = (v: any) => v?.toMillis?.() ?? (v ? new Date(v).getTime() : 0);
  const ordersByUser = new Map<string, any[]>();
  const stuck: any[] = [];

  orders.docs.forEach((d: any) => {
    const o = d.data();
    const age = Date.now() - ms(o.createdAt);
    if (o.status === 'created' && age > 15 * 60 * 1000) {
      stuck.push({ id: o.orderId || d.id, days: Math.round(age / DAY), amt: o.amountPaid ?? o.amount });
    }
    if (o.userId) {
      if (!ordersByUser.has(o.userId)) ordersByUser.set(o.userId, []);
      ordersByUser.get(o.userId)!.push(o);
    }
  });

  // Paid but no access — the one failure that costs a real customer.
  const paidNoAccess: string[] = [];
  users.docs.forEach((d: any) => {
    const u = d.data();
    const enrolled = Object.keys(u.enrolledCourses || {});
    const paid = (ordersByUser.get(d.id) || []).filter((o) => o.status === 'success');
    paid.forEach((o) => {
      if (o.courseId && !enrolled.includes(o.courseId)) {
        paidNoAccess.push(`${u.email || d.id} paid for ${o.courseId} (${o.orderId}) but has NO entitlement`);
      }
    });
  });

  if (paidNoAccess.length === 0) pass('every successful order has a matching entitlement');
  else { console.log('  !! PAID WITHOUT ACCESS:'); paidNoAccess.forEach((l) => console.log('     ' + l)); ok = false; }

  if (stuck.length === 0) {
    pass('no orders stuck in "created"');
  } else {
    console.log(`  ?? ${stuck.length} order(s) stuck in "created" — may be abandoned checkouts, or real payments that never landed:`);
    stuck.sort((a, b) => a.days - b.days)
         .forEach((s) => console.log(`     ${s.id}  ${s.days}d old  amt=${s.amt ?? '-'}`));
  }

  // Most recent activity tells us whether anything has happened since the cap.
  const newest = Math.max(...orders.docs.map((d: any) => ms(d.data().createdAt)), 0);
  const newestUser = Math.max(...users.docs.map((d: any) => ms(d.data().createdAt)), 0);
  console.log(`\n  last order:  ${newest ? new Date(newest).toISOString().slice(0, 16).replace('T', ' ') : 'none'}`
            + `  (${newest ? Math.round((Date.now() - newest) / DAY) : '-'} days ago)`);
  console.log(`  last signup: ${newestUser ? new Date(newestUser).toISOString().slice(0, 16).replace('T', ' ') : 'none'}`
            + `  (${newestUser ? Math.round((Date.now() - newestUser) / DAY) : '-'} days ago)`);

  console.log('\n' + (ok ? '=== ALL GREEN — Firebase is serving reads and writes ==='
                         : '=== SOMETHING NEEDS ATTENTION — see FAIL / !! lines above ==='));
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
