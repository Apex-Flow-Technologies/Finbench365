import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireEntitlement } from '@/lib/api/requireEntitlement';
import { resolveMaxAttempts } from '@/lib/exams/attempts';

/**
 * Opens an attempt at a test.
 *
 * Attempts were previously created straight from the browser with the client
 * SDK, which meant the cap could only be applied when the paper was handed in:
 * a candidate could sit a full timed exam and be refused at submit, losing every
 * answer. Firestore rules cannot count documents, so no rule could have closed
 * that — it needs a server route, which is this one.
 *
 * Pressing Start is what spends an attempt. Running out of time and pressing
 * submit both merely close the attempt that was already spent.
 */
export async function POST(req: Request) {
  try {
    const { testId } = await req.json().catch(() => ({ testId: null }));

    if (!testId || typeof testId !== 'string') {
      return NextResponse.json({ error: 'Missing testId' }, { status: 400 });
    }

    // Authenticates, rejects suspended accounts, and confirms a live
    // entitlement for the course owning this test. Also hands back the test
    // document, so the cap costs no extra read.
    const check = await requireEntitlement(req, testId);
    if (!check.ok) {
      return NextResponse.json({ error: check.error, reason: check.reason }, { status: check.status });
    }
    const { uid, testData, isStaff } = check;

    const attempts = await adminDb.collection('test_attempts')
      .where('userId', '==', uid)
      .where('testId', '==', testId)
      .get();

    // An attempt already open is resumed, never replaced.
    //
    // This is what keeps "pressing Start spends an attempt" from being brutal
    // at a cap of three: a browser crash, a closed tab or a flat battery lands
    // back on the same paper rather than costing a sitting. An attempt is only
    // truly spent once it closes — by submit, by the timer, or by the existing
    // fifteen-minute disconnect sweep. It also holds stale in-progress
    // documents to one per candidate per test.
    const open = attempts.docs.find(
      (d: FirebaseFirestore.QueryDocumentSnapshot) => d.data()?.status === 'in_progress',
    );
    if (open) {
      return NextResponse.json({
        attemptId: open.id,
        attemptNumber: open.data()?.attemptNumber ?? null,
        resumed: true,
      });
    }

    const max = resolveMaxAttempts(testData);
    // Every attempt counts, not only the completed ones — starting is what
    // spends one, and the in-progress case has already returned above.
    const used = attempts.size;

    // Staff bypass the cap for the same reason they bypass entitlement: they
    // are previewing the paper, not sitting it. Without this, authoring a test
    // dies on the fourth preview.
    if (!isStaff && used >= max) {
      return NextResponse.json({
        error: `You have used all ${max} attempts for this test.`,
        reason: 'attempts-exhausted',
        max,
        used,
      }, { status: 403 });
    }

    const attemptNumber = used + 1;

    // A derived id rather than an auto id, so two Start presses in the same
    // instant collide in the database instead of opening two attempts against
    // one allowance. create() rather than set() for the same reason: losing
    // that race must fail rather than overwrite the winner's paper.
    const attemptId = `${uid}_${testId}_${attemptNumber}`;
    const attemptRef = adminDb.collection('test_attempts').doc(attemptId);

    try {
      await attemptRef.create({
        userId: uid,
        testId,
        startedAt: FieldValue.serverTimestamp(),
        status: 'in_progress',
        answers: {},
        // Recorded so an attempt can say which one it is — "attempt 2 of 3" —
        // and so the sequence is auditable. Nothing depends on it being unique:
        // it is derived from a plain count, not a transaction.
        attemptNumber,
      });
    } catch (err: any) {
      if (err?.code === 6 || String(err?.message).includes('ALREADY_EXISTS')) {
        // The other press won. Hand back the same attempt rather than an error
        // the candidate can do nothing about.
        console.warn(`Concurrent start for ${attemptId} — returning the existing attempt.`);
        return NextResponse.json({ attemptId, attemptNumber, resumed: true });
      }
      throw err;
    }

    console.log(`Attempt ${attemptNumber}/${max} started by ${uid} on ${testId}`);
    return NextResponse.json({ attemptId, attemptNumber, resumed: false });

  } catch (error: any) {
    console.error('Start attempt error:', error);
    return NextResponse.json({ error: 'Could not start the exam.' }, { status: 500 });
  }
}
