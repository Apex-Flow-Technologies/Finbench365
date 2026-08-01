import { adminAuth, adminDb } from '@/lib/firebase/admin';

export interface EntitlementOk {
  ok: true;
  uid: string;
  courseId: string;
  /** Staff previewing content — entitlement was bypassed, not earned. */
  isStaff: boolean;
  testData: FirebaseFirestore.DocumentData;
}

export interface EntitlementFailure {
  ok: false;
  status: number;
  error: string;
  /** Distinguishes "you paid but it ran out" from "you never had access". */
  reason?: 'expired' | 'not-enrolled' | 'suspended' | 'misconfigured';
}

/**
 * Server-side gate for anything that exposes paid exam content.
 *
 * Verifies the bearer token, then confirms the caller holds a live (unexpired)
 * entitlement for the course that owns `testId`. This is deliberately applied
 * to practice tests as well as certification exams — practice material is part
 * of the paid course, and gating only 'exam' type left every published
 * practice test readable by any signed-up account.
 *
 * Admins and editors bypass the entitlement requirement so they can preview
 * and author content, but they are still authenticated first.
 */
export async function requireEntitlement(
  req: Request,
  testId: string,
): Promise<EntitlementOk | EntitlementFailure> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const uid = decoded.uid;

  const [testSnap, userSnap] = await Promise.all([
    adminDb.collection('mock_tests').doc(testId).get(),
    adminDb.collection('users').doc(uid).get(),
  ]);

  if (!testSnap.exists) {
    return { ok: false, status: 404, error: 'Test not found' };
  }
  const testData = testSnap.data()!;
  const userData = userSnap.exists ? userSnap.data()! : {};

  if (userData.suspended) {
    return { ok: false, status: 403, error: 'Account suspended', reason: 'suspended' };
  }

  const isStaff = userData.role === 'admin' || userData.role === 'editor';
  const courseId: string | undefined = testData.courseId;

  if (isStaff) {
    return { ok: true, uid, courseId: courseId ?? '', isStaff: true, testData };
  }

  // A test with no course (or one pointing at a deleted course) can never be
  // entitled to. Fail closed, but say so distinctly so it is diagnosable
  // rather than looking like an ordinary access denial.
  if (!courseId) {
    console.error(`Test ${testId} has no courseId — cannot resolve entitlement.`);
    return {
      ok: false, status: 403, reason: 'misconfigured',
      error: 'This test is not linked to a course. Please contact support.',
    };
  }

  const entitlement = (userData.enrolledCourses || {})[courseId];
  if (!entitlement) {
    return {
      ok: false, status: 403, reason: 'not-enrolled',
      error: 'You do not have access to this exam.',
    };
  }

  const expiresAtMs =
    typeof entitlement.expiresAt?.toMillis === 'function'
      ? entitlement.expiresAt.toMillis()
      : new Date(entitlement.expiresAt).getTime();

  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return {
      ok: false, status: 403, reason: 'expired',
      error: 'Your access to this course has expired. Please renew to continue.',
    };
  }

  return { ok: true, uid, courseId, isStaff: false, testData };
}
