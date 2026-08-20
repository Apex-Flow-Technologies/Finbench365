'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export interface AdminCourse {
  id: string;
  title: string;
  isPublished: boolean;
  materialCount: number;
  testCount: number;
  publishedTestCount: number;
  /** Live but with nothing to sit — the most common content mistake. */
  publishedWithoutTests: boolean;
}

export interface ContentHealth {
  courses: AdminCourse[];
  publishedCourses: number;
  draftCourses: number;
  totalTests: number;
  publishedTests: number;
  totalMaterials: number;
  /** Tests whose courseId is missing or points at a course that no longer exists. */
  orphanedTests: { id: string; title: string; courseId?: string }[];
}

/**
 * Course and test inventory for the admin overview.
 *
 * Reads mock_tests once and groups by courseId rather than issuing a query per
 * course, and surfaces content that is misconfigured — a published course with
 * no test, or a test pointing at a deleted course. The latter cannot be opened
 * by any student, because entitlement is resolved through the owning course.
 */
export function useAdminContent() {
  const [data, setData] = useState<ContentHealth | null>(null);
  const [loading, setLoading] = useState(true);
  // Surfaced, not just logged. A failure here used to leave every Content tile
  // reading 0 with nothing to say why — indistinguishable from a genuinely
  // empty catalogue.
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [courseSnap, testSnap] = await Promise.all([
          getDocs(query(collection(db, 'courses'))),
          getDocs(query(collection(db, 'mock_tests'))),
        ]);
        if (cancelled) return;

        const tests = testSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const courseIds = new Set(courseSnap.docs.map((d) => d.id));

        const courses: AdminCourse[] = courseSnap.docs.map((d) => {
          const c = d.data() as any;
          const mine = tests.filter((t) => t.courseId === d.id);
          const published = mine.filter((t) => t.isPublished).length;
          return {
            id: d.id,
            title: c.title || 'Untitled',
            isPublished: Boolean(c.isPublished),
            // materialCount is written whenever study notes are saved. Reading the
            // old `materials` array instead reported 0 for every course once notes
            // moved into their own protected collection — the notes were there, the
            // count was looking in a place nothing writes to any more. The array is
            // still accepted as a fallback for any course not yet re-saved.
            materialCount: typeof c.materialCount === 'number'
              ? c.materialCount
              : (Array.isArray(c.materials) ? c.materials.length : 0),
            testCount: mine.length,
            publishedTestCount: published,
            publishedWithoutTests: Boolean(c.isPublished) && published === 0,
          };
        });

        const orphanedTests = tests
          .filter((t) => !t.courseId || !courseIds.has(t.courseId))
          .map((t) => ({ id: t.id, title: t.title || 'Untitled', courseId: t.courseId }));

        setData({
          courses,
          publishedCourses: courses.filter((c) => c.isPublished).length,
          draftCourses: courses.filter((c) => !c.isPublished).length,
          totalTests: tests.length,
          publishedTests: tests.filter((t) => t.isPublished).length,
          totalMaterials: courses.reduce((sum, c) => sum + c.materialCount, 0),
          orphanedTests,
        });
      } catch (err: any) {
        console.error('Failed to load content health:', err);
        if (!cancelled) setError(err?.message ?? 'Could not load courses and tests');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { content: data, loading, error };
}
