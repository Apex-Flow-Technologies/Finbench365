import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

/**
 * Follow-up on the "paid without access" hits.
 *
 * The first pass only compared order.courseId against the keys of
 * user.enrolledCourses. That is not conclusive on its own: an entitlement can
 * be absent because it was never granted, because an admin revoked it, or
 * because the course it pointed at no longer exists. Each needs a different
 * response, so establish which before telling anyone customers are locked out.
 */
async function main() {
  const { adminDb } = await import('../src/lib/firebase/admin');

  const [users, orders, courses] = await Promise.all([
    adminDb.collection('users').get(),
    adminDb.collection('orders').get(),
    adminDb.collection('courses').get(),
  ]);

  const courseIds = new Set(courses.docs.map((d: any) => d.id));
  const courseTitle = new Map(courses.docs.map((d: any) => [d.id, d.data().title || 'Untitled']));
  const userById = new Map(users.docs.map((d: any) => [d.id, d.data()]));
  const ms = (v: any) => v?.toMillis?.() ?? (v ? new Date(v).getTime() : 0);

  const rows: any[] = [];
  orders.docs.forEach((d: any) => {
    const o = d.data();
    if (o.status !== 'success' || !o.userId || !o.courseId) return;
    const u: any = userById.get(o.userId);
    if (!u) { rows.push({ cls: 'NO USER DOC', o, u: null }); return; }
    const ent = (u.enrolledCourses || {})[o.courseId];
    if (ent) return;                                   // has access, fine

    const cls = !courseIds.has(o.courseId) ? 'COURSE DELETED'
              : u.suspended               ? 'USER SUSPENDED'
              : o.refundedAt || o.revokedAt ? 'REVOKED BY ADMIN'
              : 'GENUINELY MISSING';
    rows.push({ cls, o, u });
  });

  const by: Record<string, any[]> = {};
  rows.forEach((r) => { (by[r.cls] ||= []).push(r); });

  for (const [cls, list] of Object.entries(by)) {
    console.log(`\n=== ${cls}  (${list.length}) ===`);
    list.forEach((r) => {
      const o = r.o, u = r.u;
      const paid = o.amountPaid ?? o.amount ?? 0;
      const when = ms(o.createdAt) ? new Date(ms(o.createdAt)).toISOString().slice(0, 10) : '????-??-??';
      const other = u ? Object.keys(u.enrolledCourses || {}).length : 0;
      console.log(`  ${when}  ${String(u?.email || o.userId).padEnd(32)} paid=${String(paid).padStart(7)}`
                + `  via=${String(o.grantedVia || '-').padEnd(9)} otherCourses=${other}`
                + `  course=${courseTitle.get(o.courseId) || o.courseId}`);
    });
  }

  // How much real money is actually implicated, vs comped coupon enrolments?
  const genuine = by['GENUINELY MISSING'] || [];
  const realMoney = genuine.filter((r) => (r.o.amountPaid ?? r.o.amount ?? 0) > 0);
  console.log(`\n--- genuinely missing: ${genuine.length}, of which PAID REAL MONEY: ${realMoney.length} ---`);
  realMoney.forEach((r) => console.log(`  ${r.u?.email}  Rs.${r.o.amountPaid ?? r.o.amount}  ${r.o.orderId}`));

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
