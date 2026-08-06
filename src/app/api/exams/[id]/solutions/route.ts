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

    // Only practice tests ever release their answer key to the browser;
    // certification exams are graded server-side and never expose solutions.
    if (check.testData.type !== 'practice') {
      return NextResponse.json({ error: 'Solutions not available for exam mode' }, { status: 403 });
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
