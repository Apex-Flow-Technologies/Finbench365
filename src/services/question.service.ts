/**
 * ==============================================================================
 * FinBench365 — Question & Mock Test Domain Service (Sprint 3)
 * ==============================================================================
 * Domain repository responsible for CBT mock tests, Item-Response Theory (IRT)
 * exam questions, and study note supplements.
 */

import { firestoreService } from './firestore.service';
import { FIRESTORE_COLLECTIONS } from '../constants/firestore';
import type { MockTestDocument, QuestionDocument, NoteDocument } from '../types/firestore';

export class QuestionService {
  /**
   * Fetch a CBT mock test by its ID.
   */
  async getMockTestById(mockTestId: string): Promise<MockTestDocument | null> {
    return firestoreService.getDocument<MockTestDocument>(FIRESTORE_COLLECTIONS.MOCK_TESTS, mockTestId);
  }

  /**
   * List all mock tests associated with a specific course ID.
   */
  async listMockTestsByCourse(courseId: string): Promise<MockTestDocument[]> {
    const { items } = await firestoreService.queryDocuments<MockTestDocument>(FIRESTORE_COLLECTIONS.MOCK_TESTS, {
      filters: [{ field: 'courseId', operator: '==', value: courseId }],
      orders: [{ field: 'createdAt', direction: 'asc' }],
    });
    return items;
  }

  /**
   * List all questions ordered sequentially for a given CBT mock test.
   */
  async listQuestionsByMockTest(mockTestId: string): Promise<QuestionDocument[]> {
    const { items } = await firestoreService.queryDocuments<QuestionDocument>(FIRESTORE_COLLECTIONS.QUESTIONS, {
      filters: [{ field: 'mockTestId', operator: '==', value: mockTestId }],
      orders: [{ field: 'orderIndex', direction: 'asc' }],
    });
    return items;
  }

  /**
   * List study notes associated with a certification course.
   */
  async listNotesByCourse(courseId: string): Promise<NoteDocument[]> {
    const { items } = await firestoreService.queryDocuments<NoteDocument>(FIRESTORE_COLLECTIONS.NOTES, {
      filters: [{ field: 'courseId', operator: '==', value: courseId }],
      orders: [{ field: 'moduleIndex', direction: 'asc' }],
    });
    return items;
  }
}

export const questionService = new QuestionService();
