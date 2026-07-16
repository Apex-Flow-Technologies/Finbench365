/**
 * ==============================================================================
 * FinBench365 — Examination Attempt Domain Service (Sprint 3)
 * ==============================================================================
 * Domain repository responsible for candidate CBT attempts, response logging,
 * timer state tracking, and diagnostic scoring submission.
 */

import { firestoreService, type QueryFilter } from './firestore.service';
import { FIRESTORE_COLLECTIONS } from '../constants/firestore';
import type { AttemptDocument, QuestionResponse, AttemptAnalyticsSnapshot } from '../types/firestore';

export class AttemptService {
  /**
   * Fetch an examination attempt record by its ID.
   */
  async getAttemptById(attemptId: string): Promise<AttemptDocument | null> {
    return firestoreService.getDocument<AttemptDocument>(FIRESTORE_COLLECTIONS.ATTEMPTS, attemptId);
  }

  /**
   * List all historical examination attempts for a specific candidate.
   */
  async listCandidateAttempts(userId: string, mockTestId?: string): Promise<AttemptDocument[]> {
    const filters: QueryFilter[] = [
      { field: 'userId', operator: '==', value: userId },
      ...(mockTestId ? [{ field: 'mockTestId', operator: '==' as const, value: mockTestId }] : []),
    ];

    const { items } = await firestoreService.queryDocuments<AttemptDocument>(FIRESTORE_COLLECTIONS.ATTEMPTS, {
      filters,
      orders: [{ field: 'startedAt', direction: 'desc' }],
    });
    return items;
  }

  /**
   * Initialize and persist a new examination attempt session.
   */
  async startAttempt(
    attemptId: string,
    userId: string,
    mockTestId: string,
    courseId: string,
    totalQuestions: number,
    maxPossibleScore: number
  ): Promise<AttemptDocument> {
    const now = new Date().toISOString();
    return firestoreService.createDocument<AttemptDocument>(FIRESTORE_COLLECTIONS.ATTEMPTS, attemptId, {
      userId,
      mockTestId,
      courseId,
      startedAt: now,
      durationSpentSeconds: 0,
      totalScore: 0,
      maxPossibleScore,
      percentageScore: 0,
      isPassed: false,
      attemptStatus: 'IN_PROGRESS',
      responses: {},
      status: 'ACTIVE',
    });
  }

  /**
   * Periodically persist candidate question responses during active CBT execution.
   */
  async saveResponseProgress(
    attemptId: string,
    responses: Record<string, QuestionResponse>,
    durationSpentSeconds: number
  ): Promise<void> {
    return firestoreService.updateDocument<AttemptDocument>(FIRESTORE_COLLECTIONS.ATTEMPTS, attemptId, {
      responses,
      durationSpentSeconds,
    });
  }

  /**
   * Finalize and submit an attempt with computed score and diagnostic metrics.
   */
  async submitAttempt(
    attemptId: string,
    totalScore: number,
    percentageScore: number,
    isPassed: boolean,
    responses: Record<string, QuestionResponse>,
    durationSpentSeconds: number,
    analyticsSnapshot?: AttemptAnalyticsSnapshot
  ): Promise<void> {
    const now = new Date().toISOString();
    return firestoreService.updateDocument<AttemptDocument>(FIRESTORE_COLLECTIONS.ATTEMPTS, attemptId, {
      completedAt: now,
      totalScore,
      percentageScore,
      isPassed,
      responses,
      durationSpentSeconds,
      attemptStatus: 'SUBMITTED',
      analyticsSnapshot,
    });
  }
}

export const attemptService = new AttemptService();
