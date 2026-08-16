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
  deleteDoc
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

export interface CourseMaterial {
  id: string;
  name: string;
  url: string;
  /** Lowest plan tier that unlocks this note. 1 = every plan. */
  minPlanTier: number;
  order: number;
}

/**
 * Study notes for a course.
 *
 * Held in a subcollection rather than on the course document, because the
 * course document is publicly readable — the catalogue depends on that. A link
 * to paid material cannot live there, or hiding a locked note in the UI would
 * protect nothing. Firestore rules gate these by entitlement AND plan tier, so
 * a 10-day candidate requesting a 60-day note is refused by the database, not
 * merely by the interface.
 *
 * A permission error here is the rule doing its job, so it resolves to an empty
 * list rather than throwing.
 */
export async function getCourseMaterials(courseId: string): Promise<CourseMaterial[]> {
  try {
    const snap = await getDocs(collection(db, `courses/${courseId}/materials`));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .map((m) => ({ ...m, minPlanTier: m.minPlanTier ?? 1, order: m.order ?? 0 }))
      .sort((a, b) => a.order - b.order);
  } catch (err) {
    console.warn('Study notes unavailable (likely not entitled):', err);
    return [];
  }
}

/** Replaces the whole set of study notes for a course. Admin only. */
export async function saveCourseMaterials(
  courseId: string,
  materials: { id?: string; name: string; url: string; minPlanTier: number }[],
) {
  const existing = await getDocs(collection(db, `courses/${courseId}/materials`));
  const batch = writeBatch(db);

  // Anything removed in the editor must actually go, or a deleted note would
  // linger in the subcollection and stay downloadable.
  const keep = new Set(materials.map((m) => m.id).filter(Boolean));
  existing.docs.forEach((d) => { if (!keep.has(d.id)) batch.delete(d.ref); });

  materials.forEach((m, i) => {
    const ref = m.id
      ? doc(db, `courses/${courseId}/materials`, m.id)
      : doc(collection(db, `courses/${courseId}/materials`));
    batch.set(ref, {
      name: m.name,
      url: m.url,
      minPlanTier: m.minPlanTier ?? 1,
      order: i,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });

  await batch.commit();

  // A public count so the storefront can say "2 study notes" without being able
  // to read the notes themselves.
  await updateDoc(doc(db, 'courses', courseId), { materialCount: materials.length })
    .catch(() => {});
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

// Attempt timestamps are `startedAt` / `submittedAt` throughout. They used to be
// written as `startTime` / `endTime` here while every reader (the submit route's
// over-time check, getUserAnalytics) looked for `startedAt` / `submittedAt` — so
// the duration logic was dead code and "Total CBT Time" was permanently 0h 0m.
// Readers fall back to the legacy names so historical attempts still count.
export async function startTestAttempt(userId: string, testId: string) {
  const attemptRef = doc(collection(db, 'test_attempts'));
  const newAttempt = {
    userId,
    testId,
    startedAt: serverTimestamp(),
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

// NOTE: there is deliberately no client-side submit here any more. Completing an
// attempt — writing `score`, `status` and `submittedAt` — belongs to
// /api/exams/submit, which grades against the protected solutions subcollection
// using the Admin SDK. Firestore rules now reject those fields from a browser,
// so a client-side equivalent would fail anyway.

export async function updateAttemptHeartbeat(attemptId: string) {
  const attemptRef = doc(db, 'test_attempts', attemptId);
  await updateDoc(attemptRef, {
    lastHeartbeatAt: serverTimestamp()
  });
}

// `expireAttemptDueToDisconnect` used to live here. It had no callers — the
// 15-minute disconnect rule in the exam runner only ever showed a screen and
// never recorded anything — and it wrote `status`/`submittedAt`, which the
// browser is no longer permitted to set. Enforcing that rule for real belongs
// server-side, keyed off the `lastHeartbeatAt` written below.

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
  // Placed at the end of the course's existing tests. Without an order a new
  // test landed wherever Firestore happened to return it, which is what made
  // the list appear to reshuffle every time one was added.
  const siblings = await getCourseTests(data.courseId).catch(() => [] as any[]);

  const testRef = doc(collection(db, 'mock_tests'));
  await setDoc(testRef, {
    ...data,
    type: data.type || 'practice',
    order: siblings.length,
    createdAt: serverTimestamp(),
    isPublished: false
  });
  return testRef.id;
}

/**
 * Removes every question and its answer key from a test.
 *
 * Exists because a mis-uploaded .docx previously had to be undone one question
 * at a time — a 100-question import meant 100 confirmations, so in practice
 * nobody undid it and wrong content stayed live.
 *
 * Deletes the `solutions` document alongside each question. Removing only the
 * question would orphan its answer key, and the grader counts `solutions` to
 * decide how many questions a paper has — leaving them behind would mark every
 * candidate against questions that no longer exist.
 *
 * @returns how many questions were removed
 */
export async function deleteAllQuestions(testId: string): Promise<number> {
  const questionsSnap = await getDocs(collection(db, `mock_tests/${testId}/questions`));
  const solutionsSnap = await getDocs(collection(db, `mock_tests/${testId}/solutions`));

  const refs = [...questionsSnap.docs, ...solutionsSnap.docs].map((d) => d.ref);

  // Firestore caps a batch at 500 writes.
  const CHUNK = 450;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(db);
    refs.slice(i, i + CHUNK).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  await updateDoc(doc(db, 'mock_tests', testId), { totalQuestions: 0 }).catch(() => {});
  return questionsSnap.size;
}

export async function saveQuestionsBatch(testId: string, questions: any[], testType?: string) {
  const batch = writeBatch(db);
  
  questions.forEach((q, index) => {
    // If it already has an ID, update it. Otherwise, create a new doc in the subcollection.
    const questionsRef = collection(db, `mock_tests/${testId}/questions`);
    const qRef = q.id ? doc(db, `mock_tests/${testId}/questions`, q.id) : doc(questionsRef);
    
    // Strip everything that would give the answer away from the public record.
    //
    // `optionExplanations` is the important addition: each entry reads like
    // "as compliance review is permitted" and is index-aligned with the
    // options, so publishing them would hand over the answer key — the wording
    // alone distinguishes the correct option. They belong with the solution.
    const {
      id, correctOptionIndex, explanation, optionExplanations, answerUnresolved, number,
      ...publicData
    } = q;
    const safeCorrectOptionIndex = correctOptionIndex ?? 0;

    // For practice tests, we keep correctOptionIndex public for instant grading UI
    // For certification exams, it is completely stripped from the client payload
    const finalPublicData = testType === 'practice'
      ? { ...publicData, correctOptionIndex: safeCorrectOptionIndex }
      : publicData;

    // 1. Save public question data. Case fields (caseId/caseTitle/casePassage)
    //    ride along in publicData — a candidate must be able to read the
    //    scenario to answer the questions attached to it.
    batch.set(qRef, {
      ...finalPublicData,
      order: index,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 2. Save the solution securely in a separate subcollection using the SAME document ID
    const solutionRef = doc(db, `mock_tests/${testId}/solutions`, qRef.id);
    batch.set(solutionRef, {
      correctOptionIndex: safeCorrectOptionIndex,
      explanation: explanation || "",
      // Why each option is right or wrong — released to a candidate only after
      // a practice attempt, and never for a certification exam.
      optionExplanations: Array.isArray(optionExplanations) ? optionExplanations : [],
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
  
  return entries.flatMap(([courseId, data], i) => {
    const courseSnap = courseSnaps[i];

    // A course that no longer exists is dropped from the dashboard entirely.
    //
    // Deleting a course now revokes its entitlements, so this only catches
    // orphans: courses removed before that existed, or removed straight from
    // the database. Either way the candidate was left with a card reading
    // "Course no longer available" that they could not open and could only
    // "Renew". Showing nothing is the honest result — there is nothing there.
    //
    // Deliberately NOT the same as expiry: an expired entitlement still points
    // at a real course, so it keeps its card, its title and its Renew button.
    if (!courseSnap.exists()) return [];
    const courseData = { id: courseSnap.id, ...courseSnap.data(), isMissing: false };

    const parseDate = (val: any) => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      if (val instanceof Date) return val;
      return new Date(val); // parse string/number fallback
    };

    const expiresAtDate = parseDate(data.expiresAt);

    return [{
      courseId,
      course: courseData,
      enrolledAt: parseDate(data.enrolledAt),
      expiresAt: expiresAtDate,
      durationDays: data.durationDays,
      isActive: new Date() < expiresAtDate
    }];
  });
}

// --- Admin Portal ---
export async function updateUserRole(userId: string, newRole: 'student' | 'admin') {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { role: newRole });
}

// Get all mock tests for a given exam
/**
 * Mock tests for a course, in the order an admin arranged them.
 *
 * There was no ordering at all, so Firestore returned them in document-id
 * order — effectively random. Adding a test reshuffled the list, and "Mock 1,
 * Mock 4, Mock 5, Mock 3, Mock 2" is what a candidate saw too.
 *
 * Sorted here rather than in the query: `orderBy('order')` would silently drop
 * every test written before the field existed, which is the same trap that once
 * hid users and orders from the admin panel. Tests with no order yet sort last,
 * then by title, so the list is at least stable and alphabetical until someone
 * arranges it.
 */
export async function getCourseTests(courseId: string) {
  const q = query(
    collection(db, 'mock_tests'),
    where('courseId', '==', courseId)
  );
  const snapshot = await getDocs(q);
  const tests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

  return tests.sort((a, b) => {
    const ao = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
    const bo = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return String(a.title ?? '').localeCompare(String(b.title ?? ''), undefined, { numeric: true });
  });
}

/** Persists a manual arrangement of a course's mock tests. */
export async function saveTestOrder(orderedTestIds: string[]) {
  const batch = writeBatch(db);
  orderedTestIds.forEach((id, i) => {
    batch.update(doc(db, 'mock_tests', id), { order: i });
  });
  await batch.commit();
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

export interface ActiveAttempt {
  id: string;
  userId: string;
  testId: string;
  status: string;
  answers?: Record<string, number>;
  startedAt?: any;
  [key: string]: any;
}

// Find existing active attempt for fallback recovery.
//
// The return type is declared rather than inferred: spreading `docSnap.data()`
// (typed `DocumentData`) produced `{ id: string }`, so every field the caller
// actually reads — `answers` above all — was a type error at the call site.
export async function getActiveAttemptForUser(
  userId: string,
  testId: string,
): Promise<ActiveAttempt | null> {
  const q = query(
    collection(db, 'test_attempts'),
    where('userId', '==', userId),
    where('testId', '==', testId),
    where('status', '==', 'in_progress')
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as ActiveAttempt;
}

export async function getUserAnalytics(userId: string) {
  const q = query(
    collection(db, 'test_attempts'),
    where('userId', '==', userId),
    where('status', '==', 'completed')
  );
  
  const snapshot = await getDocs(q);
  
  let totalCorrect = 0;
  let totalQuestions = 0;
  let totalTimeMs = 0;

  snapshot.docs.forEach(doc => {
    const data = doc.data();

    // Fallback to max 50 if missing for old data
    const attemptTotalQuestions = data.totalQuestions || Object.keys(data.answers || {}).length || 50;

    // Accuracy is "percent answered correctly", which is NOT the same as the
    // score once negative marking exists — `score` can be fractional or
    // negative, and dividing it by the question count would report a candidate
    // as, say, 42% accurate on a paper where they got 60 of 100 right.
    // `correctCount` is written by the grader; `score` is the pre-negative-
    // marking fallback for attempts recorded before that field existed.
    totalCorrect += data.correctCount ?? Math.max(0, data.score || 0);
    totalQuestions += attemptTotalQuestions;

    // Legacy names accepted so attempts recorded before the rename still
    // contribute to the total rather than silently counting as zero.
    const started = data.startedAt ?? data.startTime;
    const ended = data.submittedAt ?? data.endTime ?? data.endedAt;
    if (started?.toDate && ended?.toDate) {
      totalTimeMs += Math.max(0, ended.toDate().getTime() - started.toDate().getTime());
    }
  });

  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
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
