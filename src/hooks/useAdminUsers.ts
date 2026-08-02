'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { toMillis } from '@/lib/admin/revenue';

/**
 * Single source for the admin user list.
 *
 * The same query was copy-pasted across four files, each normalising the data
 * slightly differently — so a bug had to be fixed four times and the screens
 * disagreed with each other about how many users existed.
 *
 * Deliberately NOT ordered in the query: Firestore silently omits documents
 * missing the field being ordered by, which is exactly how incomplete user
 * records became invisible to the admin panel. Read everything, sort here.
 */

export interface AdminEntitlement {
  courseId: string;
  expiresAt: Date | null;
  daysLeft: number;
  isActive: boolean;
  planId?: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin';
  suspended: boolean;
  createdAt: Date | null;
  totalSpent: number;
  entitlements: AdminEntitlement[];
  activeCount: number;
  /** Longest remaining access across this user's courses; 0 when none. */
  daysLeft: number;
  /** True when required profile fields are missing — surfaced in Data Health. */
  incomplete: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function normalise(id: string, data: any): AdminUser {
  const now = Date.now();
  const enrolled = data.enrolledCourses || {};

  const entitlements: AdminEntitlement[] = Object.entries<any>(enrolled).map(
    ([courseId, value]) => {
      const ms = toMillis(value?.expiresAt);
      const daysLeft = ms ? Math.ceil((ms - now) / DAY_MS) : 0;
      return {
        courseId,
        expiresAt: ms ? new Date(ms) : null,
        daysLeft,
        isActive: ms > now,
        planId: value?.planId,
      };
    },
  );

  const createdMs = toMillis(data.createdAt);

  return {
    id,
    name: data.name || '',
    email: data.email || '',
    role: data.role || 'student',
    suspended: Boolean(data.suspended),
    createdAt: createdMs ? new Date(createdMs) : null,
    totalSpent: data.totalSpent || 0,
    entitlements,
    activeCount: entitlements.filter((e) => e.isActive).length,
    daysLeft: entitlements.length ? Math.max(...entitlements.map((e) => e.daysLeft), 0) : 0,
    incomplete: !data.email || !data.createdAt || !data.role,
  };
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'users')),
      (snap) => {
        const list = snap.docs.map((d) => normalise(d.id, d.data()));
        // Newest first. Undated records sort last rather than appearing as the
        // most recent signup, which is what a `new Date()` fallback would do.
        list.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
        setUsers(list);
        setLoading(false);
      },
      (err) => {
        // The previous listeners had no error handler, so a rules denial left
        // the page showing "Loading..." forever with no indication why.
        console.error('useAdminUsers subscription failed:', err);
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  return { users, loading, error };
}
