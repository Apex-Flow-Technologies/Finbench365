import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
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

    // 2. Confirm the attempt is this candidate's and still open.
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

    // 3. Grade and close the attempt.
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
