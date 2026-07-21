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
  writeBatch
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
  return { id: testSnap.id, ...testSnap.data() };
}

export async function getTestQuestions(testId: string) {
  const q = query(collection(db, 'questions'), where('testId', '==', testId), orderBy('order', 'asc'));
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

export async function createMockTest(data: any) {
  const ref = doc(collection(db, 'mock_tests'));
  await setDoc(ref, { ...data, createdAt: serverTimestamp(), isPublished: false });
  return ref.id;
}

export async function saveQuestionsBatch(testId: string, questions: any[]) {
  const batch = writeBatch(db);
  
  questions.forEach((q, index) => {
    // If it already has an ID, update it. Otherwise, create a new doc.
    const qRef = q.id ? doc(db, 'questions', q.id) : doc(collection(db, 'questions'));
    
    // We explicitly exclude the local 'id' field if present before sending to firestore
    const { id, ...dataToSave } = q;
    
    batch.set(qRef, {
      ...dataToSave,
      testId,
      order: index,
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  await batch.commit();
}
