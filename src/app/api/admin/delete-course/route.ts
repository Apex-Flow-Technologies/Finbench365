import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/api/requireAdmin';

/**
 * Deletes a course and everything that points at it.
 *
 * Deleting used to remove the course document and nothing else, which left:
 *
 *   - every enrolled candidate still holding `enrolledCourses[courseId]`, so
 *     their dashboard kept showing the course as a card reading "Course no
 *     longer available" — the reported complaint;
 *   - the course's mock tests orphaned, along with their questions and answer
 *     keys, invisible to the admin panel but still in the database;
 *   - `orders` referencing a course that no longer exists.
 *
 * Two-step by design. `dryRun` reports what would be destroyed — above all how
 * many candidates still have live, paid access — so nobody deletes a course out
 * from under people who paid for it without seeing that first.
 */
export async function POST(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    const { courseId, dryRun = true } = await req.json() as { courseId?: string; dryRun?: boolean };
    if (!courseId) {
      return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
    }

    const courseRef = adminDb.collection('courses').doc(courseId);
    const courseSnap = await courseRef.get();

    // Whole-collection scan. Firestore cannot filter on a map key without an
    // index per course, and at this scale reading users is cheaper than
    // maintaining one index for every course that has ever existed.
    const usersSnap = await adminDb.collection('users').get();
    const now = Date.now();

    const holders: { id: string; email: string; active: boolean }[] = [];
    usersSnap.forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => {
      const ent = d.data()?.enrolledCourses?.[courseId];
      if (!ent) return;
      const expiresMs = ent.expiresAt?.toMillis?.() ?? 0;
      holders.push({ id: d.id, email: d.data()?.email ?? '', active: expiresMs > now });
    });

    const testsSnap = await adminDb.collection('mock_tests').where('courseId', '==', courseId).get();
    const activeHolders = holders.filter((h) => h.active);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        exists: courseSnap.exists,
        title: courseSnap.data()?.title ?? null,
        enrolledTotal: holders.length,
        enrolledActive: activeHolders.length,
        mockTests: testsSnap.size,
        // Named so an admin can warn them, or refund, before pulling the course.
        activeEmails: activeHolders.map((h) => h.email).filter(Boolean).slice(0, 25),
      });
    }

    // ---- entitlements ------------------------------------------------------
    // Done first: a candidate must never be left holding access to something
    // that no longer exists, which is exactly the state that produced the
    // "Course no longer available" card.
    let usersUpdated = 0;
    for (let i = 0; i < holders.length; i += 400) {
      const batch = adminDb.batch();
      holders.slice(i, i + 400).forEach((h) => {
        batch.update(adminDb.collection('users').doc(h.id), {
          [`enrolledCourses.${courseId}`]: FieldValue.delete(),
        });
      });
      await batch.commit();
      usersUpdated += Math.min(400, holders.length - i);
    }

    // ---- tests, questions and answer keys ---------------------------------
    let questionsDeleted = 0;
    for (const testDoc of testsSnap.docs) {
      for (const sub of ['questions', 'solutions']) {
        const subSnap = await testDoc.ref.collection(sub).get();
        for (let i = 0; i < subSnap.size; i += 400) {
          const batch = adminDb.batch();
          subSnap.docs.slice(i, i + 400).forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => batch.delete(d.ref));
          await batch.commit();
        }
        if (sub === 'questions') questionsDeleted += subSnap.size;
      }
      await testDoc.ref.delete();
    }

    // ---- chapters ----------------------------------------------------------
    const chaptersSnap = await adminDb.collection('chapters').where('courseId', '==', courseId).get();
    if (!chaptersSnap.empty) {
      const batch = adminDb.batch();
      chaptersSnap.forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => batch.delete(d.ref));
      await batch.commit();
    }

    // Orders are deliberately kept. They are the financial record of a real
    // payment and must survive the product being withdrawn.
    await courseRef.delete();

    console.log(
      `Course ${courseId} deleted by ${check.uid}: ${usersUpdated} entitlements removed, ` +
      `${testsSnap.size} tests, ${questionsDeleted} questions, ${chaptersSnap.size} chapters.`,
    );

    return NextResponse.json({
      success: true,
      entitlementsRemoved: usersUpdated,
      testsDeleted: testsSnap.size,
      questionsDeleted,
      chaptersDeleted: chaptersSnap.size,
      ordersKept: true,
    });
  } catch (error: any) {
    console.error('Delete course error:', error);
    return NextResponse.json({ error: 'Could not delete the course.' }, { status: 500 });
  }
}
