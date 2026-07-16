/**
 * ==============================================================================
 * FinBench365 — Course & Curriculum Domain Service (Sprint 3)
 * ==============================================================================
 * Domain repository responsible for educational tracks, course catalogs, syllabus
 * modules, and category hierarchies. Delegates data access to `FirestoreService`.
 */

import { firestoreService, type QueryFilter } from './firestore.service';
import { FIRESTORE_COLLECTIONS } from '../constants/firestore';
import type { CourseDocument, CourseCategoryDocument, DocumentStatus } from '../types/firestore';

export class CourseService {
  /**
   * Fetch a specific course by its unique document ID.
   */
  async getCourseById(courseId: string): Promise<CourseDocument | null> {
    return firestoreService.getDocument<CourseDocument>(FIRESTORE_COLLECTIONS.COURSES, courseId);
  }

  /**
   * Fetch a course by its URL-friendly slug.
   */
  async getCourseBySlug(slug: string): Promise<CourseDocument | null> {
    const { items } = await firestoreService.queryDocuments<CourseDocument>(FIRESTORE_COLLECTIONS.COURSES, {
      filters: [{ field: 'slug', operator: '==', value: slug }],
      limitCount: 1,
    });
    return items.length > 0 ? items[0] : null;
  }

  /**
   * List all courses belonging to a specific certification track.
   */
  async listCoursesByTrack(trackId: string, status: DocumentStatus = 'ACTIVE'): Promise<CourseDocument[]> {
    const { items } = await firestoreService.queryDocuments<CourseDocument>(FIRESTORE_COLLECTIONS.COURSES, {
      filters: [
        { field: 'trackId', operator: '==', value: trackId },
        { field: 'status', operator: '==', value: status },
      ],
      orders: [{ field: 'createdAt', direction: 'desc' }],
    });
    return items;
  }

  /**
   * List all course categories sorted by display order.
   */
  async listCategories(onlyActive = true): Promise<CourseCategoryDocument[]> {
    const filters: QueryFilter[] | undefined = onlyActive ? [{ field: 'isActive', operator: '==' as const, value: true }] : undefined;
    const { items } = await firestoreService.queryDocuments<CourseCategoryDocument>(FIRESTORE_COLLECTIONS.COURSE_CATEGORIES, {
      filters,
      orders: [{ field: 'displayOrder', direction: 'asc' }],
    });
    return items;
  }

  /**
   * Create or update a course document.
   */
  async saveCourse(
    courseId: string,
    data: Omit<CourseDocument, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<CourseDocument, 'createdAt' | 'updatedAt'>>
  ): Promise<CourseDocument> {
    return firestoreService.createDocument<CourseDocument>(FIRESTORE_COLLECTIONS.COURSES, courseId, data);
  }
}

export const courseService = new CourseService();
