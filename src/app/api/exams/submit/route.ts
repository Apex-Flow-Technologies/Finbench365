import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireEntitlement } from '@/lib/api/requireEntitlement';
import { finaliseAttempt } from '@/lib/exams/finalise';

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

    // The attempt cap is NOT checked here. It is enforced at /api/exams/start,
    // because starting an exam is what spends an attempt.
    //
    // This route used to refuse a submission once ten attempts had completed,
    // which meant a candidate could sit a full timed paper and be turned away
    // at the door still holding it — every answer lost, over a limit that could
    // have been applied before they began. Refusing to accept finished work is
    // never the right end of that rule.
    //
    // 1. Confirm the attempt is this candidate's and still open.
    const attemptRef = adminDb.collection('test_attempts').doc(attemptId);
    const attemptDoc = await attemptRef.get();

    if (!attemptDoc.exists || attemptDoc.data()?.userId !== uid) {
      return NextResponse.json({ error: 'Attempt not found or unauthorized' }, { status: 404 });
    }
    if (attemptDoc.data()?.status === 'completed') {
      return NextResponse.json({ error: 'Attempt already submitted' }, { status: 400 });
    }

    const solutionsSnapshot = await adminDb.collection(`mock_tests/${testId}/solutions`).get();
    if (solutionsSnapshot.empty) {
      return NextResponse.json({ error: 'Test solutions not found' }, { status: 404 });
    }

    // 2. Grade and close the attempt.
    //
    // Shared with the disconnect check so a paper abandoned mid-exam is marked
    // by exactly the same rules as one handed in. `startedAt` falls back to the
    // legacy `startTime` for attempts predating the rename.
    const attemptData = attemptDoc.data();
    const startedAt = (attemptData?.startedAt ?? attemptData?.startTime)?.toDate?.() ?? null;

    const result = await finaliseAttempt({
      attemptId,
      testId,
      testData: check.testData,
      answers,
      startedAt,
      reason: 'submitted',
    });

    if (result.flaggedOverTime) {
      console.warn(`Over-time submission: user=${uid} test=${testId}`);
    }

    return NextResponse.json({ success: true, ...result });

  } catch (error: any) {
    console.error('Submit API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
