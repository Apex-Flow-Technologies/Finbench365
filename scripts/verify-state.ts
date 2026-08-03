import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Imported dynamically below: static imports are hoisted above dotenv.config(),
// so the Admin SDK would initialise before the credentials exist.

/**
 * Read-only snapshot of the things that cost money or block a launch.
 * Writes nothing. Safe to run against production at any time.
 */
async function main() {
  const { adminDb } = await import('../src/lib/firebase/admin');

  const [users, orders, coupons, tests, courses, attempts] = await Promise.all([
    adminDb.collection('users').get(),
    adminDb.collection('orders').get(),
    adminDb.collection('coupons').get(),
    adminDb.collection('mock_tests').get(),
    adminDb.collection('courses').get(),
    adminDb.collection('test_attempts').get(),
  ]);

  console.log(`\n=== USERS (${users.size}) ===`);
  users.docs.forEach((d) => {
    const u = d.data();
    const ents = Object.entries<any>(u.enrolledCourses || {}).map(([cid, e]) => {
      const ms = e?.expiresAt?.toMillis?.() ?? 0;
      const days = ms ? Math.ceil((ms - Date.now()) / 86400000) : '?';
      return `${cid.slice(0, 10)}(${days}d)`;
    });
    console.log(
      `  ${(u.email || '(no email)').padEnd(32)} role=${(u.role || '?').padEnd(7)} ` +
      `spent=${String(u.totalSpent ?? 0).padStart(8)} ${u.suspended ? 'SUSPENDED ' : ''}${ents.join(' ') || '-'}`,
    );
  });

  console.log(`\n=== ORDERS (${orders.size}) ===`);
  orders.docs.forEach((d) => {
    const o = d.data();
    console.log(
      `  ${String(o.orderId || d.id).padEnd(24)} ${String(o.status).padEnd(9)} ` +
      `paid=${String(o.amountPaid ?? '—').padStart(8)} base=${String(o.amountBase ?? '—').padStart(8)} ` +
      `coupon=${o.couponCode || '-'} via=${o.grantedVia || '-'} ${o.createdAt ? '' : 'NO-CREATEDAT'}`,
    );
  });

  console.log(`\n=== COUPONS (${coupons.size}) ===`);
  coupons.docs.forEach((d) => {
    const c = d.data();
    console.log(
      `  ${d.id.padEnd(14)} ${c.discountPercent}% active=${c.isActive} ` +
      `used=${c.usedCount ?? 0}/${c.maxUses ?? '∞'}`,
    );
  });

  console.log(`\n=== COURSES (${courses.size}) ===`);
  courses.docs.forEach((d) => {
    const c = d.data();
    const mine = tests.docs.filter((t) => t.data().courseId === d.id);
    const pub = mine.filter((t) => t.data().isPublished).length;
    const flag = c.isPublished && pub === 0 ? '  <-- LIVE WITH NOTHING TO SIT' : '';
    console.log(
      `  ${String(c.title || 'Untitled').slice(0, 34).padEnd(36)} ` +
      `${c.isPublished ? 'PUBLISHED' : 'draft    '} tests=${mine.length} published=${pub} ` +
      `materials=${(c.materials || []).length}${flag}`,
    );
  });

  const orphans = tests.docs.filter((t) => {
    const cid = t.data().courseId;
    return !cid || !courses.docs.some((c) => c.id === cid);
  });
  console.log(`\n=== TESTS (${tests.size}), orphaned: ${orphans.length} ===`);
  tests.docs.forEach((d) => {
    const t = d.data();
    console.log(
      `  ${String(t.title || 'Untitled').slice(0, 30).padEnd(32)} ${String(t.type || '?').padEnd(8)} ` +
      `${t.isPublished ? 'PUBLISHED' : 'draft    '} qs=${t.totalQuestions ?? '?'} ${t.durationMinutes ?? '?'}min` +
      `${orphans.some((o) => o.id === d.id) ? '  <-- ORPHANED' : ''}`,
    );
  });

  const noStart = attempts.docs.filter((d) => !d.data().startedAt && !d.data().startTime).length;
  console.log(
    `\n=== ATTEMPTS (${attempts.size}) === completed=${attempts.docs.filter((d) => d.data().status === 'completed').length} ` +
    `missing-start=${noStart}`,
  );

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
