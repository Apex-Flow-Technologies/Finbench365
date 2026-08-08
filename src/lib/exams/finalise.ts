import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { gradeAttempt, resolveExamPattern, type ScoreBreakdown } from '@/lib/exams/scoring';

/**
 * How long a candidate may be gone before an in-progress attempt is closed.
 *
 * Matches the rule stated to candidates on the disconnect screen.
 */
export const DISCONNECT_GRACE_MS = 15 * 60 * 1000;

export type FinaliseReason = 'submitted' | 'disconnected';

export interface FinaliseResult extends ScoreBreakdown {
  timeTakenMs: number | null;
  flaggedOverTime: boolean;
}

/**
 * Grades an attempt and closes it.
 *
 * Shared by the submit route and the disconnect check so the two cannot drift:
 * a paper abandoned after a disconnection must be marked by exactly the same
 * rules as one handed in, on exactly the answers that were saved.
 *
 * Writes `score`, `status` and the breakdown with the Admin SDK — Firestore
 * rules forbid a browser from touching any of those.
 */
export async function finaliseAttempt(opts: {
  attemptId: string;
  testId: string;
  testData: FirebaseFirestore.DocumentData;
  /** Answers to mark. For a disconnection these are whatever was auto-saved. */
  answers: Record<string, number>;
  startedAt: Date | null;
  reason: FinaliseReason;
}): Promise<FinaliseResult> {
  const { attemptId, testId, testData, answers, startedAt, reason } = opts;

  const solutionsSnap = await adminDb.collection(`mock_tests/${testId}/solutions`).get();
  const solutions = new Map<string, number>();
  solutionsSnap.docs.forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => {
    solutions.set(d.id, d.data().correctOptionIndex);
  });

  const config = resolveExamPattern(testData);
  const result = gradeAttempt(solutions, answers, config);

  // Only a timed certification exam has a duration to exceed; a practice test
  // is open-ended, so "overrunning" it means nothing.
  let overTime: { elapsedMs: number; allowedMs: number } | null = null;
  if (startedAt && testData.type === 'exam') {
    const allowedMs = ((testData.durationMinutes || 60) + 5) * 60 * 1000;
    const elapsedMs = Date.now() - startedAt.getTime();
    if (elapsedMs > allowedMs) overTime = { elapsedMs, allowedMs };
  }

  const timeTakenMs = startedAt ? Date.now() - startedAt.getTime() : null;

  await adminDb.collection('test_attempts').doc(attemptId).update({
    answers,
    score: result.score,
    correctCount: result.correctCount,
    wrongCount: result.wrongCount,
    unattemptedCount: result.unattemptedCount,
    marksDeducted: result.marksDeducted,
    maxMarks: result.maxMarks,
    percentage: result.percentage,
    passed: result.passed,
    // Snapshotted so a later change to the test's marking cannot silently
    // reinterpret a result that has already been given to a candidate.
    markingScheme: config,
    totalQuestions: solutionsSnap.size,
    timeTakenMs,
    status: 'completed',
    submittedAt: FieldValue.serverTimestamp(),
    finalisedBy: reason,
    ...(reason === 'disconnected' ? { expiredDueToDisconnect: true } : {}),
    ...(overTime
      ? { flaggedOverTime: true, elapsedMs: overTime.elapsedMs, allowedMs: overTime.allowedMs }
      : {}),
  });

  return { ...result, timeTakenMs, flaggedOverTime: Boolean(overTime) };
}

/**
 * When the candidate was last seen working on an attempt.
 *
 * The heartbeat is written every ten seconds while an exam is open. Falls back
 * through the other timestamps so an attempt started before heartbeats existed
 * still has a defensible "last seen" rather than looking abandoned since 1970.
 */
export function lastSeenAt(attempt: FirebaseFirestore.DocumentData): Date | null {
  const candidates = [
    attempt.lastHeartbeatAt,
    attempt.lastSavedAt,
    attempt.startedAt,
    attempt.startTime,
  ];
  for (const c of candidates) {
    const d = c?.toDate?.();
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  }
  return null;
}
