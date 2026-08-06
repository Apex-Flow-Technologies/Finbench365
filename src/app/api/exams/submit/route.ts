import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireEntitlement } from '@/lib/api/requireEntitlement';
import { gradeAttempt, resolveExamPattern } from '@/lib/exams/scoring';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { attemptId, testId, answers } = body;

    if (!attemptId || !testId || !answers) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Authenticates, rejects suspended accounts, and confirms a live
    // entitlement for the course owning this test before anything is graded.
    const check = await requireEntitlement(req, testId);
    if (!check.ok) {
      return NextResponse.json({ error: check.error, reason: check.reason }, { status: check.status });
    }
    const uid = check.uid;

    // 1. Verify Attempt limits (Server-side enforcement)
    const attemptsSnapshot = await adminDb.collection('test_attempts')
      .where('userId', '==', uid)
      .where('testId', '==', testId)
      .get();
      
    // Exclude the current attempt being submitted from the count
    const completedAttempts = attemptsSnapshot.docs.filter(
      (doc: FirebaseFirestore.QueryDocumentSnapshot) =>
        doc.data().status === 'completed' && doc.id !== attemptId
    );

    if (completedAttempts.length >= 10) {
      return NextResponse.json({ error: 'Maximum attempts reached' }, { status: 403 });
    }

    // 2. Fetch correct answers from the protected solutions subcollection
    const solutionsSnapshot = await adminDb.collection(`mock_tests/${testId}/solutions`).get();
    
    if (solutionsSnapshot.empty) {
      return NextResponse.json({ error: 'Test solutions not found' }, { status: 404 });
    }

    const solutions = new Map<string, number>();
    solutionsSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      solutions.set(doc.id, doc.data().correctOptionIndex);
    });

    // 3. Grade, applying this test's marking scheme.
    //
    // The scheme lives on the mock_tests document so an admin can set it per
    // test; a test with nothing configured grades with no negative marking
    // rather than guessing at one. gradeAttempt is pure and unit-tested —
    // negative-marking arithmetic is not something to verify by hand.
    const config = resolveExamPattern(check.testData);
    const result = gradeAttempt(solutions, answers, config);

    // 4. Validate Timer constraints
    const attemptRef = adminDb.collection('test_attempts').doc(attemptId);
    const attemptDoc = await attemptRef.get();
    
    if (!attemptDoc.exists || attemptDoc.data()?.userId !== uid) {
      return NextResponse.json({ error: 'Attempt not found or unauthorized' }, { status: 404 });
    }
    
    if (attemptDoc.data()?.status === 'completed') {
      return NextResponse.json({ error: 'Attempt already submitted' }, { status: 400 });
    }

    // `startedAt` with a fallback to the legacy `startTime`. Attempts written
    // before the field rename carry the old name, and reading only the new one
    // would silently skip the check for them.
    const attemptData = attemptDoc.data();
    const startedAt = (attemptData?.startedAt ?? attemptData?.startTime)?.toDate?.();

    // Only timed certification exams have a duration to exceed. A practice test
    // is deliberately open-ended — a candidate may leave one open for days — so
    // flagging it for "overrunning" would be meaningless.
    let overTime: { elapsedMs: number; allowedMs: number } | null = null;
    if (startedAt && check.testData.type === 'exam') {
      const durationMinutes = check.testData.durationMinutes || 60;
      // 5 minutes of grace for submission latency and clock skew.
      const allowedMs = (durationMinutes + 5) * 60 * 1000;
      const elapsedMs = Date.now() - startedAt.getTime();
      if (elapsedMs > allowedMs) {
        overTime = { elapsedMs, allowedMs };
        console.warn(
          `Over-time submission: user=${uid} test=${testId} elapsed=${Math.round(elapsedMs / 60000)}min allowed=${Math.round(allowedMs / 60000)}min`,
        );
      }
    }

    // 5. Update the attempt securely.
    //
    // An over-time submission is recorded and flagged rather than rejected.
    // Refusing it would leave the attempt stuck 'in_progress' with no way for
    // the candidate to ever submit — a worse outcome than the overrun itself,
    // and indistinguishable to them from the site being broken. The flag gives
    // an invigilator a durable, queryable signal to act on instead.
    await attemptRef.update({
      answers,
      // `score` stays the marks awarded — it can now be fractional, and negative
      // on a heavily-penalised paper. `correctCount` is stored alongside it
      // because "accuracy" on the dashboard means percent correct, which is a
      // different question from "what did you score".
      score: result.score,
      correctCount: result.correctCount,
      wrongCount: result.wrongCount,
      unattemptedCount: result.unattemptedCount,
      marksDeducted: result.marksDeducted,
      maxMarks: result.maxMarks,
      percentage: result.percentage,
      passed: result.passed,
      // The scheme actually applied, snapshotted onto the attempt. Without it a
      // later change to the test's marking would silently reinterpret historical
      // results, and a candidate's score could not be explained after the fact.
      markingScheme: config,
      totalQuestions: solutionsSnapshot.size,
      timeTakenMs: startedAt ? Date.now() - startedAt.getTime() : null,
      status: 'completed',
      submittedAt: FieldValue.serverTimestamp(),
      ...(overTime
        ? {
            flaggedOverTime: true,
            elapsedMs: overTime.elapsedMs,
            allowedMs: overTime.allowedMs,
          }
        : {}),
    });

    // The client renders the result from this payload rather than recomputing
    // it. Grading twice — once here, once in the browser — is how the two ever
    // come to disagree, and the browser does not have the answer key for a
    // certification exam anyway.
    return NextResponse.json({
      success: true,
      ...result,
      timeTakenMs: startedAt ? Date.now() - startedAt.getTime() : null,
      flaggedOverTime: Boolean(overTime),
    });

  } catch (error: any) {
    console.error('Submit API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
