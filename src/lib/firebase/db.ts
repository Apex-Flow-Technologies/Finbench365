import { db } from './config';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  writeBatch,
  Timestamp
} from 'firebase/firestore';

// --- Courses & Chapters ---

export async function getCourses() {
  const q = query(collection(db, 'courses'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getCourse(courseId: string) {
  const ref = doc(db, 'courses', courseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Course not found');
  return { id: snap.id, ...snap.data() };
}

export async function getCourseChapters(courseId: string) {
  const q = query(
    collection(db, 'chapters'), 
    where('courseId', '==', courseId)
  );
  const snapshot = await getDocs(q);
  // Sort client-side to avoid needing a composite index
  const chapters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return chapters.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
}

// --- Mock Tests ---

export async function getMockTest(testId: string) {
  const testRef = doc(db, 'mock_tests', testId);
  const testSnap = await getDoc(testRef);
  if (!testSnap.exists()) throw new Error('Test not found');
  return { id: testSnap.id, ...testSnap.data() } as any;
}

export async function getTestQuestions(testId: string) {
  const q = query(
    collection(db, `mock_tests/${testId}/questions`), 
    orderBy('order', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- Test Attempts (The Engine) ---

export async function startTestAttempt(userId: string, testId: string) {
  const attemptRef = doc(collection(db, 'test_attempts'));
  const newAttempt = {
    userId,
    testId,
    startTime: serverTimestamp(),
    status: 'in_progress',
    answers: {}
  };
  await setDoc(attemptRef, newAttempt);
  return attemptRef.id;
}

export async function saveTestProgress(attemptId: string, answers: Record<string, number>) {
  const attemptRef = doc(db, 'test_attempts', attemptId);
  await updateDoc(attemptRef, {
    answers,
    lastSavedAt: serverTimestamp()
  });
}

export async function submitTestAttempt(attemptId: string, answers: Record<string, number>, score: number) {
  const attemptRef = doc(db, 'test_attempts', attemptId);
  await updateDoc(attemptRef, {
    answers,
    score,
    endTime: serverTimestamp(),
    status: 'completed'
  });
}

export async function getTestAttempt(attemptId: string) {
  const attemptRef = doc(db, 'test_attempts', attemptId);
  const attemptSnap = await getDoc(attemptRef);
  if (!attemptSnap.exists()) throw new Error('Attempt not found');
  return { id: attemptSnap.id, ...attemptSnap.data() };
}

export async function getTestAttemptsCount(userId: string, testId: string) {
  const q = query(
    collection(db, 'test_attempts'),
    where('userId', '==', userId),
    where('testId', '==', testId)
  );
  const snapshot = await getDocs(q);
  return snapshot.size;
}


// --- Editor Functions ---

export async function createCourse(data: any) {
  const ref = doc(collection(db, 'courses'));
  await setDoc(ref, { ...data, createdAt: serverTimestamp(), isPublished: false });
  return ref.id;
}

export async function updateCourse(courseId: string, data: any) {
  const ref = doc(db, 'courses', courseId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function createChapter(courseId: string, data: any) {
  const ref = doc(collection(db, 'chapters'));
  await setDoc(ref, { ...data, courseId, createdAt: serverTimestamp(), isPublished: false });
  return ref.id;
}

export async function updateChapter(chapterId: string, data: any) {
  const ref = doc(db, 'chapters', chapterId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function createMockTest(data: {
  title: string, 
  durationMinutes: number, 
  totalQuestions: number,
  chapterId?: string,
  courseId: string,
  type?: 'practice' | 'exam'
}) {
  const testRef = doc(collection(db, 'mock_tests'));
  await setDoc(testRef, {
    ...data,
    type: data.type || 'practice',
    createdAt: serverTimestamp(),
    isPublished: false
  });
  return testRef.id;
}

export async function saveQuestionsBatch(testId: string, questions: any[], testType?: string) {
  const batch = writeBatch(db);
  
  questions.forEach((q, index) => {
    // If it already has an ID, update it. Otherwise, create a new doc in the subcollection.
    const questionsRef = collection(db, `mock_tests/${testId}/questions`);
    const qRef = q.id ? doc(db, `mock_tests/${testId}/questions`, q.id) : doc(questionsRef);
    
    // We explicitly exclude the local 'id' field
    const { id, correctOptionIndex, ...publicData } = q;
    
    // For practice tests, we keep correctOptionIndex public for instant grading UI
    // For certification exams, it is completely stripped from the client payload
    const finalPublicData = testType === 'practice' 
      ? { ...publicData, correctOptionIndex } 
      : publicData;
    
    // 1. Save public question data 
    batch.set(qRef, {
      ...finalPublicData,
      testId,
      order: index,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // 2. Save the solution securely in a separate subcollection using the SAME document ID
    const solutionRef = doc(db, `mock_tests/${testId}/solutions`, qRef.id);
    batch.set(solutionRef, {
      correctOptionIndex,
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  await batch.commit();
}

// --- Entitlements (Student Pipeline) ---

export async function enrollUserInCourse(userId: string, courseId: string, durationDays: number) {
  const userRef = doc(db, 'users', userId);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + durationDays);
  
  await updateDoc(userRef, {
    [`enrolledCourses.${courseId}`]: {
      expiresAt: Timestamp.fromDate(expiresAt),
      enrolledAt: serverTimestamp(),
      durationDays
    }
  });
}

export async function getUserEntitlements(userId: string) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return [];
  
  const userData = userSnap.data();
  const enrolled = userData.enrolledCourses || {};
  
  const entitlements = [];
  
  for (const [courseId, data] of Object.entries<any>(enrolled)) {
    const courseSnap = await getDoc(doc(db, 'courses', courseId));
    if (courseSnap.exists()) {
      entitlements.push({
        courseId,
        course: { id: courseSnap.id, ...courseSnap.data() },
        enrolledAt: data.enrolledAt?.toDate() || new Date(),
        expiresAt: data.expiresAt?.toDate() || new Date(),
        durationDays: data.durationDays,
        isActive: new Date() < (data.expiresAt?.toDate() || new Date(0))
      });
    }
  }
  
  return entitlements;
}

// --- Admin Portal ---
export async function updateUserRole(userId: string, newRole: 'student' | 'editor' | 'admin') {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { role: newRole });
}
