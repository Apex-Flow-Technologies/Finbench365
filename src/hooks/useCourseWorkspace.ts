/**
 * ==============================================================================
 * FinBench365 — Administration Course Workspace & Module Hook (Sprint 4.2)
 * ==============================================================================
 * Strictly adheres to `Component -> Hook -> Service -> Firestore` hierarchy.
 * Encapsulates single-course hydration, real-time module updates, optimistic
 * reordering, and administrative RBAC validation.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { courseService } from '../services/course.service';
import { useAuth } from './useAuth';
import type { CourseDocument, CourseSyllabusModule } from '../types/firestore';

export function useCourseWorkspace(courseId: string) {
  const { user, authenticated } = useAuth();
  const [course, setCourse] = useState<CourseDocument | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeletedModules, setShowDeletedModules] = useState<boolean>(false);

  /**
   * Fetch course document and syllabus modules from Firestore via `CourseService`
   */
  const fetchCourse = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const fetched = await courseService.getCourseById(courseId);
      if (!fetched) {
        setError(`Course [${courseId}] not found in institutional catalog.`);
      } else {
        setCourse(fetched);
      }
    } catch (err: unknown) {
      console.error('[useCourseWorkspace] Error fetching course workspace:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to synchronize workspace from institutional Firestore database.'
      );
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  /**
   * Computed list of modules, sorted by `moduleIndex` and filtered by soft deletion
   */
  const modules = useMemo(() => {
    if (!course || !Array.isArray(course.syllabus)) return [];
    const list = [...course.syllabus].sort((a, b) => (a.moduleIndex || 0) - (b.moduleIndex || 0));
    if (showDeletedModules) return list;
    return list.filter((m) => m.status !== 'DELETED');
  }, [course, showDeletedModules]);

  /**
   * Administrative Action: Create a new syllabus module inside workspace
   */
  const addModule = useCallback(
    async (
      data: Omit<CourseSyllabusModule, 'moduleId' | 'createdAt' | 'updatedAt'> & { moduleId?: string }
    ): Promise<CourseSyllabusModule> => {
      setError(null);
      try {
        const created = await courseService.addModule(courseId, data);
        setCourse((prev) => {
          if (!prev) return prev;
          const prevSyllabus = Array.isArray(prev.syllabus) ? [...prev.syllabus] : [];
          prevSyllabus.push(created);
          prevSyllabus.sort((a, b) => a.moduleIndex - b.moduleIndex);
          return {
            ...prev,
            syllabus: prevSyllabus,
            updatedAt: new Date().toISOString(),
          };
        });
        return created;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create module.';
        setError(msg);
        throw new Error(msg);
      }
    },
    [courseId]
  );

  /**
   * Administrative Action: Update existing module fields
   */
  const updateModule = useCallback(
    async (
      moduleId: string,
      data: Partial<Omit<CourseSyllabusModule, 'moduleId' | 'createdAt'>>
    ): Promise<CourseSyllabusModule> => {
      setError(null);
      try {
        const updated = await courseService.updateModule(courseId, moduleId, data);
        setCourse((prev) => {
          if (!prev || !Array.isArray(prev.syllabus)) return prev;
          const nextSyllabus = prev.syllabus.map((m) => (m.moduleId === moduleId ? updated : m));
          nextSyllabus.sort((a, b) => a.moduleIndex - b.moduleIndex);
          return {
            ...prev,
            syllabus: nextSyllabus,
            updatedAt: new Date().toISOString(),
          };
        });
        return updated;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update module.';
        setError(msg);
        throw new Error(msg);
      }
    },
    [courseId]
  );

  /**
   * Administrative Action: Archive a module (`status: 'ARCHIVED'`)
   */
  const archiveModule = useCallback(
    async (moduleId: string): Promise<void> => {
      await updateModule(moduleId, { status: 'ARCHIVED' });
    },
    [updateModule]
  );

  /**
   * Administrative Action: Soft delete a module (`status: 'DELETED'`)
   */
  const softDeleteModule = useCallback(
    async (moduleId: string): Promise<void> => {
      await updateModule(moduleId, { status: 'DELETED' });
    },
    [updateModule]
  );

  /**
   * Administrative Action: Reorder modules based on new array order of `moduleId`s
   */
  const reorderModules = useCallback(
    async (orderedModuleIds: string[]): Promise<CourseSyllabusModule[]> => {
      setError(null);
      try {
        const reordered = await courseService.reorderModules(courseId, orderedModuleIds);
        setCourse((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            syllabus: reordered,
            updatedAt: new Date().toISOString(),
          };
        });
        return reordered;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to reorder modules.';
        setError(msg);
        throw new Error(msg);
      }
    },
    [courseId]
  );

  return {
    course,
    modules,
    loading,
    error,
    showDeletedModules,
    setShowDeletedModules,
    addModule,
    updateModule,
    archiveModule,
    softDeleteModule,
    reorderModules,
    refresh: fetchCourse,
    isAdmin: authenticated && (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'),
  };
}
