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
  Timestamp,
  deleteDoc,
  deleteField
} from 'firebase/firestore';

// --- Courses & Chapters ---

export async function getCourses() {
  const q = query(collection(db, 'courses'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deleteCourse(courseId: string) {
  const ref = doc(db, 'courses', courseId);
  await deleteDoc(ref);
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

export async function getTestQuestions(testId: string, withSolutions: boolean = false) {
  const q = query(
    collection(db, `mock_tests/${testId}/questions`), 
    orderBy('order', 'asc')
  );
  const snapshot = await getDocs(q);
  const questions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  if (withSolutions) {
    const solutionsSnap = await getDocs(collection(db, `mock_tests/${testId}/solutions`));
    const solutionsMap = new Map();
    solutionsSnap.docs.forEach(doc => {
      solutionsMap.set(doc.id, doc.data());
    });

    return questions.map(q => {
      const solution = solutionsMap.get(q.id);
      if (solution) {
        return { ...q, ...solution };
      }
      return q;
    });
  }

  return questions;
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

export async function updateAttemptHeartbeat(attemptId: string) {
  const attemptRef = doc(db, 'test_attempts', attemptId);
  await updateDoc(attemptRef, {
    lastHeartbeatAt: serverTimestamp()
  });
}

export async function expireAttemptDueToDisconnect(attemptId: string) {
  const attemptRef = doc(db, 'test_attempts', attemptId);
  await updateDoc(attemptRef, {
    status: 'completed',
    expiredDueToDisconnect: true,
    endedAt: serverTimestamp()
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
    where('testId', '==', testId),
    where('status', '==', 'completed') // Match server-side validation — only count completed, not in_progress or expired
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

/**
 * Persists the question bank and returns the document id for each question, in
 * order.
 *
 * Returning the ids matters: questions created here get auto-generated ids, and
 * if the caller does not write them back into its state the NEXT save treats
 * every question as new again and writes a second copy. Saving twice after a
 * 100-question import produced 200 question documents, and students would have
 * sat the test with every question duplicated.
 *
 * Also deletes questions removed since the last load — previously removing a
 * question only changed local state, so a deleted question stayed live for
 * students while the editor reported success.
 */
export async function saveQuestionsBatch(
  testId: string,
  questions: any[],
  testType?: string,
  previousIds: string[] = [],
): Promise<string[]> {
  const batch = writeBatch(db);
  const savedIds: string[] = [];

  questions.forEach((q, index) => {
    // If it already has an ID, update it. Otherwise, create a new doc in the subcollection.
    const questionsRef = collection(db, `mock_tests/${testId}/questions`);
    const qRef = q.id ? doc(db, `mock_tests/${testId}/questions`, q.id) : doc(questionsRef);
    savedIds.push(qRef.id);
    
    // We explicitly exclude the local 'id' and 'explanation' fields from public data
    const { id, correctOptionIndex, explanation, ...publicData } = q;
    const safeCorrectOptionIndex = correctOptionIndex ?? 0;
    
    // For practice tests, we keep correctOptionIndex public for instant grading UI
    // For certification exams, it is completely stripped from the client payload
    const finalPublicData = testType === 'practice' 
      ? { ...publicData, correctOptionIndex: safeCorrectOptionIndex } 
      : publicData;
    
    // 1. Save public question data 
    batch.set(qRef, {
      ...finalPublicData,
      // merge:true only OMITS correctOptionIndex for exams, it does not remove
      // an existing one — so a test switched from practice to exam kept its
      // answer key readable by every entitled student. Delete it explicitly.
      ...(testType === 'practice' ? {} : { correctOptionIndex: deleteField() }),
      order: index,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // 2. Save the solution securely in a separate subcollection using the SAME document ID
    const solutionRef = doc(db, `mock_tests/${testId}/solutions`, qRef.id);
    batch.set(solutionRef, {
      correctOptionIndex: safeCorrectOptionIndex,
      explanation: explanation || "",
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  // Anything present before but not now has been removed in the editor. Delete
  // the question and its solution together so no orphan answer key survives.
  const keep = new Set(savedIds);
  for (const staleId of previousIds) {
    if (keep.has(staleId)) continue;
    batch.delete(doc(db, `mock_tests/${testId}/questions`, staleId));
    batch.delete(doc(db, `mock_tests/${testId}/solutions`, staleId));
  }

  await batch.commit();
  return savedIds;
}

// --- Entitlements (Student Pipeline) ---

export async function enrollUserInCourse(userId: string, courseId: string, durationDays: number) {
  const userRef = doc(db, 'users', userId);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + durationDays);
  
  await setDoc(userRef, {
    enrolledCourses: {
      [courseId]: {
        expiresAt: Timestamp.fromDate(expiresAt),
        enrolledAt: serverTimestamp(),
        durationDays
      }
    }
  }, { merge: true });
}

export async function getUserEntitlements(userId: string) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return [];
  
  const userData = userSnap.data();
  const enrolled = userData.enrolledCourses || {};
  const entries = Object.entries<any>(enrolled);
  
  if (entries.length === 0) return [];

  // Fetch all course docs in PARALLEL instead of sequential for-loop (eliminates N+1 pattern)
  const courseSnaps = await Promise.all(
    entries.map(([courseId]) => getDoc(doc(db, 'courses', courseId)))
  );
  
  return entries.map(([courseId, data], i) => {
    const courseSnap = courseSnaps[i];
    const courseData = courseSnap.exists()
      ? { id: courseSnap.id, ...courseSnap.data() }
      : { id: courseId, title: courseId.replace(/-/g, ' ').toUpperCase(), tier: 'Professional' };

    const parseDate = (val: any) => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      if (val instanceof Date) return val;
      return new Date(val); // parse string/number fallback
    };

    const expiresAtDate = parseDate(data.expiresAt);

    return {
      courseId,
      course: courseData,
      enrolledAt: parseDate(data.enrolledAt),
      expiresAt: expiresAtDate,
      durationDays: data.durationDays,
      isActive: new Date() < expiresAtDate
    };
  });
}

// --- Admin Portal ---
export async function updateUserRole(userId: string, newRole: 'student' | 'admin') {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { role: newRole });
}

// Get all mock tests for a given exam
export async function getCourseTests(courseId: string) {
  const q = query(
    collection(db, 'mock_tests'),
    where('courseId', '==', courseId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Get all registered users for Admin Management
export async function getUsers() {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Single active session enforcement.
//
// Deliberately updateDoc, not setDoc({merge:true}). A merge-set CREATES the
// document when it doesn't exist, which produced "skeleton" user records with
// no email/name/role/createdAt for any Auth account that predated its Firestore
// profile. Those records are invisible to any query ordered by createdAt
// (Firestore silently drops documents missing the ordered field), which is why
// the admin overview under-counted users and orders showed "Unknown User".
// Profile creation belongs to createUserProfile below, not to a session ping.
export async function updateUserActiveSession(userId: string, sessionId: string) {
  const userRef = doc(db, 'users', userId);
  try {
    await updateDoc(userRef, { activeSessionId: sessionId, lastLoginAt: serverTimestamp() });
  } catch (err: any) {
    // Document doesn't exist yet — the caller is responsible for creating a
    // complete profile first. Nothing to do here.
    if (err?.code !== 'not-found') throw err;
  }
}

/**
 * Creates a complete user profile document. Used when an authenticated account
 * has no Firestore record yet (e.g. created before the profile write existed).
 * Every field the admin screens rely on is written, so the document can never
 * be dropped from an ordered query or render as "Unknown User".
 */
export async function createUserProfile(
  userId: string,
  data: { email: string | null; name: string | null },
) {
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, {
    email: data.email || '',
    name: data.name || '',
    role: 'student',
    createdAt: serverTimestamp(),
  }, { merge: true });
}

// Find existing active attempt for fallback recovery
export async function getActiveAttemptForUser(userId: string, testId: string) {
  const q = query(
    collection(db, 'test_attempts'),
    where('userId', '==', userId),
    where('testId', '==', testId),
    where('status', '==', 'in_progress')
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

export async function getUserAnalytics(userId: string) {
  const q = query(
    collection(db, 'test_attempts'),
    where('userId', '==', userId),
    where('status', '==', 'completed')
  );
  
  const snapshot = await getDocs(q);
  
  let totalScore = 0;
  let totalQuestions = 0;
  let totalTimeMs = 0;
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    
    // Fallback to max 50 if missing for old data
    const attemptTotalQuestions = data.totalQuestions || Object.keys(data.answers || {}).length || 50; 
    
    totalScore += (data.score || 0);
    totalQuestions += attemptTotalQuestions;
    
    if (data.startedAt && data.submittedAt) {
      const start = data.startedAt.toDate();
      const end = data.submittedAt.toDate();
      totalTimeMs += Math.max(0, end.getTime() - start.getTime());
    }
  });

  const accuracy = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
  const attemptsCount = snapshot.size;

  return {
    accuracy,
    attemptsCount,
    totalTimeMs
  };
}

export async function updateMockTest(testId: string, data: any) {
  const testRef = doc(db, 'mock_tests', testId);
  await updateDoc(testRef, data);
}
