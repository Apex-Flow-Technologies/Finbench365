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
   * Alias of `getCourseById` for administrative module consistency.
   */
  async getCourse(courseId: string): Promise<CourseDocument | null> {
    return this.getCourseById(courseId);
  }

  /**
   * List all courses with optional filtering and search capabilities.
   * Automatically filters out soft-deleted (`DELETED`) courses unless explicitly requested.
   */
  async listCourses(options: {
    categoryId?: string;
    status?: DocumentStatus;
    searchQuery?: string;
    includeDeleted?: boolean;
  } = {}): Promise<CourseDocument[]> {
    const filters: QueryFilter[] = [];
    if (options.categoryId && options.categoryId !== 'ALL') {
      filters.push({ field: 'categoryId', operator: '==' as const, value: options.categoryId });
    }
    if (options.status && options.status !== ('ALL' as unknown as DocumentStatus)) {
      filters.push({ field: 'status', operator: '==' as const, value: options.status });
    }

    const { items } = await firestoreService.queryDocuments<CourseDocument>(FIRESTORE_COLLECTIONS.COURSES, {
      filters: filters.length > 0 ? filters : undefined,
      orders: [{ field: 'createdAt', direction: 'desc' }],
    });

    let results = items;
    if (!options.includeDeleted && !options.status) {
      results = results.filter((c) => c.status !== 'DELETED');
    }

    if (options.searchQuery && options.searchQuery.trim() !== '') {
      const queryLower = options.searchQuery.trim().toLowerCase();
      results = results.filter(
        (c) =>
          c.title.toLowerCase().includes(queryLower) ||
          (c.description && c.description.toLowerCase().includes(queryLower)) ||
          (c.slug && c.slug.toLowerCase().includes(queryLower)) ||
          (c.trackId && c.trackId.toLowerCase().includes(queryLower)) ||
          (c.categoryId && c.categoryId.toLowerCase().includes(queryLower))
      );
    }

    return results;
  }

  /**
   * Create a new course record inside `courses` collection.
   * Automatically injects `status` and `isPublished` flags.
   */
  async createCourse(
    data: Omit<CourseDocument, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<CourseDocument> {
    const courseId = data.id || data.slug || `course_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const status: DocumentStatus = data.status || 'DRAFT';
    const isPublished = status === 'ACTIVE' || status === 'PUBLISHED' || data.isPublished === true;

    const payload: Omit<CourseDocument, 'id' | 'createdAt' | 'updatedAt'> = {
      ...data,
      status,
      isPublished,
    };

    return firestoreService.createDocument<CourseDocument>(FIRESTORE_COLLECTIONS.COURSES, courseId, payload);
  }

  /**
   * Update specific fields of an existing course.
   */
  async updateCourse(
    courseId: string,
    data: Partial<Omit<CourseDocument, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    const updatePayload = { ...data };
    if (updatePayload.status === 'ACTIVE' || updatePayload.status === 'PUBLISHED') {
      updatePayload.isPublished = true;
    } else if (
      updatePayload.status === 'DRAFT' ||
      updatePayload.status === 'ARCHIVED' ||
      updatePayload.status === 'DELETED' ||
      updatePayload.status === 'SUSPENDED'
    ) {
      updatePayload.isPublished = false;
    }
    return firestoreService.updateDocument<CourseDocument>(FIRESTORE_COLLECTIONS.COURSES, courseId, updatePayload);
  }

  /**
   * Publish an existing course (sets status to `ACTIVE` and `isPublished: true`).
   */
  async publishCourse(courseId: string): Promise<void> {
    return this.updateCourse(courseId, { status: 'ACTIVE', isPublished: true });
  }

  /**
   * Unpublish an existing course (sets status to `DRAFT` and `isPublished: false`).
   */
  async unpublishCourse(courseId: string): Promise<void> {
    return this.updateCourse(courseId, { status: 'DRAFT', isPublished: false });
  }

  /**
   * Archive an existing course (sets status to `ARCHIVED` and `isPublished: false`).
   */
  async archiveCourse(courseId: string): Promise<void> {
    return this.updateCourse(courseId, { status: 'ARCHIVED', isPublished: false });
  }

  /**
   * Soft delete an existing course (sets status to `DELETED` and `isPublished: false`).
   */
  async softDeleteCourse(courseId: string): Promise<void> {
    return this.updateCourse(courseId, { status: 'DELETED', isPublished: false });
  }

  /**
   * Create or update a course document (backward compatible alias).
   */
  async saveCourse(
    courseId: string,
    data: Omit<CourseDocument, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<CourseDocument, 'createdAt' | 'updatedAt'>>
  ): Promise<CourseDocument> {
    return firestoreService.createDocument<CourseDocument>(FIRESTORE_COLLECTIONS.COURSES, courseId, data);
  }
}

export const courseService = new CourseService();
