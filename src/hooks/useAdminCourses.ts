/**
 * ==============================================================================
 * FinBench365 — Administration Course Management Hook (Sprint 4.1)
 * ==============================================================================
 * Enforces `Component -> Hook -> Service -> Firestore` architectural hierarchy.
 * Encapsulates administrative CRUD workflows, optimistic state transitions, error
 * recovery, and category taxonomy hydration.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { courseService } from '../services/course.service';
import { useAuth } from './useAuth';
import type { CourseDocument, CourseCategoryDocument, DocumentStatus } from '../types/firestore';

export interface AdminCourseOptions {
  categoryId?: string;
  status?: DocumentStatus;
  searchQuery?: string;
  includeDeleted?: boolean;
}

export function useAdminCourses(initialOptions: AdminCourseOptions = {}) {
  const { user, authenticated } = useAuth();
  const [courses, setCourses] = useState<CourseDocument[]>([]);
  const [categories, setCategories] = useState<CourseCategoryDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<AdminCourseOptions>(initialOptions);

  /**
   * Hydrates course catalog and category options from Firestore
   */
  const fetchCourses = useCallback(async (customOptions?: AdminCourseOptions) => {
    setLoading(true);
    setError(null);
    try {
      const queryOpts = customOptions !== undefined ? customOptions : options;
      const [coursesResult, categoriesResult] = await Promise.all([
        courseService.listCourses(queryOpts),
        courseService.listCategories(false),
      ]);
      setCourses(coursesResult);
      setCategories(categoriesResult);
    } catch (err: unknown) {
      console.error('[useAdminCourses] Failed to load administrative courses:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to synchronize with institutional database. Please verify your administrative permissions.'
      );
    } finally {
      setLoading(false);
    }
  }, [options]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  /**
   * Administrative Action: Create a new course record
   */
  const createCourse = useCallback(
    async (
      data: Omit<CourseDocument, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<CourseDocument> => {
      setError(null);
      try {
        const newCourse = await courseService.createCourse(data);
        setCourses((prev) => [newCourse, ...prev]);
        return newCourse;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create course.';
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  /**
   * Administrative Action: Update specific fields of an existing course
   */
  const updateCourse = useCallback(
    async (
      courseId: string,
      data: Partial<Omit<CourseDocument, 'id' | 'createdAt' | 'updatedAt'>>
    ): Promise<void> => {
      setError(null);
      try {
        await courseService.updateCourse(courseId, data);
        setCourses((prev) =>
          prev.map((c) => {
            if (c.id === courseId) {
              const updatedStatus = data.status || c.status;
              const isPublished =
                updatedStatus === 'ACTIVE' || updatedStatus === 'PUBLISHED'
                  ? true
                  : updatedStatus === 'DRAFT' || updatedStatus === 'ARCHIVED' || updatedStatus === 'DELETED'
                  ? false
                  : data.isPublished !== undefined
                  ? data.isPublished
                  : c.isPublished;
              return { ...c, ...data, status: updatedStatus, isPublished, updatedAt: new Date().toISOString() };
            }
            return c;
          })
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update course properties.';
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  /**
   * Administrative Action: Publish a course (make active and visible)
   */
  const publishCourse = useCallback(
    async (courseId: string): Promise<void> => {
      setError(null);
      try {
        await courseService.publishCourse(courseId);
        setCourses((prev) =>
          prev.map((c) => (c.id === courseId ? { ...c, status: 'ACTIVE', isPublished: true, updatedAt: new Date().toISOString() } : c))
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to publish course.';
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  /**
   * Administrative Action: Unpublish a course (revert to DRAFT)
   */
  const unpublishCourse = useCallback(
    async (courseId: string): Promise<void> => {
      setError(null);
      try {
        await courseService.unpublishCourse(courseId);
        setCourses((prev) =>
          prev.map((c) => (c.id === courseId ? { ...c, status: 'DRAFT', isPublished: false, updatedAt: new Date().toISOString() } : c))
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to unpublish course.';
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  /**
   * Administrative Action: Archive a course
   */
  const archiveCourse = useCallback(
    async (courseId: string): Promise<void> => {
      setError(null);
      try {
        await courseService.archiveCourse(courseId);
        setCourses((prev) =>
          prev.map((c) => (c.id === courseId ? { ...c, status: 'ARCHIVED', isPublished: false, updatedAt: new Date().toISOString() } : c))
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to archive course.';
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  /**
   * Administrative Action: Soft delete a course (mark DELETED)
   */
  const softDeleteCourse = useCallback(
    async (courseId: string): Promise<void> => {
      setError(null);
      try {
        await courseService.softDeleteCourse(courseId);
        // Remove from local list unless includeDeleted is active
        setCourses((prev) =>
          options.includeDeleted
            ? prev.map((c) => (c.id === courseId ? { ...c, status: 'DELETED', isPublished: false, updatedAt: new Date().toISOString() } : c))
            : prev.filter((c) => c.id !== courseId)
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete course.';
        setError(msg);
        throw new Error(msg);
      }
    },
    [options.includeDeleted]
  );

  return {
    courses,
    categories,
    loading,
    error,
    options,
    setOptions,
    fetchCourses,
    createCourse,
    updateCourse,
    publishCourse,
    unpublishCourse,
    archiveCourse,
    softDeleteCourse,
    refresh: fetchCourses,
    isAdmin: authenticated && (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'),
  };
}
