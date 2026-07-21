import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (err) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const body = await req.json();
    const { attemptId, testId, answers } = body;

    if (!attemptId || !testId || !answers) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify Attempt limits (Server-side enforcement)
    const attemptsSnapshot = await adminDb.collection('test_attempts')
      .where('userId', '==', uid)
      .where('testId', '==', testId)
      .get();
      
    // Exclude the current attempt being submitted from the count
    const completedAttempts = attemptsSnapshot.docs.filter(
      doc => doc.data().status === 'completed' && doc.id !== attemptId
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
    solutionsSnapshot.docs.forEach(doc => {
      solutions.set(doc.id, doc.data().correctOptionIndex);
    });

    // 3. Calculate Score
    let score = 0;
    const answerEntries = Object.entries(answers) as [string, number][];
    for (const [questionId, selectedOption] of answerEntries) {
      const correctOption = solutions.get(questionId);
      if (correctOption !== undefined && correctOption === selectedOption) {
        score++;
      }
    }

    // 4. Validate Timer constraints
    const attemptRef = adminDb.collection('test_attempts').doc(attemptId);
    const attemptDoc = await attemptRef.get();
    
    if (!attemptDoc.exists || attemptDoc.data()?.userId !== uid) {
      return NextResponse.json({ error: 'Attempt not found or unauthorized' }, { status: 404 });
    }
    
    if (attemptDoc.data()?.status === 'completed') {
      return NextResponse.json({ error: 'Attempt already submitted' }, { status: 400 });
    }

    const startTime = attemptDoc.data()?.startedAt?.toDate();
    if (startTime) {
      // Get test duration to ensure they didn't take way too long
      const testDoc = await adminDb.collection('mock_tests').doc(testId).get();
      const durationMinutes = testDoc.data()?.durationMinutes || 60;
      const elapsedTimeMs = Date.now() - startTime.getTime();
      
      // Allow a 5 minute grace period for submission latency
      if (elapsedTimeMs > (durationMinutes + 5) * 60 * 1000) {
        // We still save the attempt, but we might want to flag it
        console.warn(`User ${uid} exceeded time limit for test ${testId}`);
      }
    }

    // 5. Update the attempt securely
    await attemptRef.update({
      answers,
      score,
      status: 'completed',
      submittedAt: adminDb.doc('users/1').firestore.FieldValue.serverTimestamp()
    });

    return NextResponse.json({ success: true, score });

  } catch (error: any) {
    console.error('Submit API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
