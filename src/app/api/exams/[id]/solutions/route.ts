import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireEntitlement } from '@/lib/api/requireEntitlement';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const testId = (await params).id;
    if (!testId) {
      return NextResponse.json({ error: 'Test ID required' }, { status: 400 });
    }

    // Answer keys are paid content — being signed in is not enough. The caller
    // must hold a live entitlement for the course that owns this test.
    const check = await requireEntitlement(request, testId);
    if (!check.ok) {
      return NextResponse.json({ error: check.error, reason: check.reason }, { status: check.status });
    }

    // Practice tests release their answer key so the candidate gets instant
    // feedback while working through them.
    //
    // A certification exam releases it only AFTER the candidate has actually
    // finished one — reviewing what you got wrong is the point of sitting a
    // mock, and previously the exam ended at a bare score with no way to learn
    // from it. The completed-attempt check is what keeps this safe: the key
    // cannot be fetched before or during an attempt, only afterwards.
    if (check.testData.type !== 'practice' && !check.isStaff) {
      const completed = await adminDb.collection('test_attempts')
        .where('userId', '==', check.uid)
        .where('testId', '==', testId)
        .where('status', '==', 'completed')
        .limit(1)
        .get();

      if (completed.empty) {
        return NextResponse.json(
          { error: 'Answers are available once you have submitted this exam.', reason: 'not-attempted' },
          { status: 403 },
        );
      }
    }

    const solutionsSnap = await adminDb
      .collection('mock_tests').doc(testId).collection('solutions').get();

    const solutionsMap: Record<string, any> = {};
    solutionsSnap.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      solutionsMap[doc.id] = doc.data();
    });

    return NextResponse.json({ solutions: solutionsMap });
  } catch (error: any) {
    console.error('Error fetching solutions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
