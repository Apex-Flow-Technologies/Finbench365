import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    await adminAuth.verifyIdToken(token); // Verify user is logged in

    const testId = (await params).id;
    if (!testId) {
      return NextResponse.json({ error: 'Test ID required' }, { status: 400 });
    }

    // 1. Fetch the mock test
    const testRef = adminDb.collection('mock_tests').doc(testId);
    const testDoc = await testRef.get();

    if (!testDoc.exists) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    const testData = testDoc.data();

    // 2. Check if the test is a practice test
    if (testData?.type !== 'practice') {
      return NextResponse.json({ error: 'Solutions not available for exam mode' }, { status: 403 });
    }

    // 3. Fetch solutions
    const solutionsSnap = await testRef.collection('solutions').get();
    const solutionsMap: Record<string, any> = {};
    
    solutionsSnap.forEach((doc) => {
      solutionsMap[doc.id] = doc.data();
    });

    return NextResponse.json({ solutions: solutionsMap });
  } catch (error: any) {
    console.error('Error fetching solutions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
