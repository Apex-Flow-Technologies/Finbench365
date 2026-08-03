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
  /**
   * Days until this user's SOONEST-expiring active entitlement; 0 when none.
   *
   * Deliberately the soonest and not the longest: every consumer is a renewal
   * prompt ("expiring soon"), and taking the max meant a student with one
   * course lapsing in 2 days and another running 300 more was listed as
   * "300 days left" — the exact opposite of the signal the screen exists for.
   */
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
    daysLeft: (() => {
      const active = entitlements.filter((e) => e.isActive);
      return active.length ? Math.min(...active.map((e) => e.daysLeft)) : 0;
    })(),
    incomplete: !data.email || !data.createdAt || !data.role,
  };
}

/**
 * One shared subscription for the whole app, reference-counted.
 *
 * Several admin screens call this hook, and the overview calls it alongside
 * other widgets — each mount used to open its own listener over the entire
 * users collection, so the same documents were streamed and billed two or
 * three times over. Consumers now attach to a single listener that is opened
 * on the first subscriber and closed after the last one leaves.
 *
 * Still a whole-collection read: fine at the current scale, and the eventual
 * fix is a paginated /api/admin/students rather than more listeners.
 */
interface Snapshot {
  users: AdminUser[];
  loading: boolean;
  error: string | null;
}

let shared: Snapshot = { users: [], loading: true, error: null };
let unsubscribe: (() => void) | null = null;
const subscribers = new Set<(s: Snapshot) => void>();

function publish(next: Snapshot) {
  shared = next;
  subscribers.forEach((fn) => fn(next));
}

function ensureSubscription() {
  if (unsubscribe) return;
  unsubscribe = onSnapshot(
    query(collection(db, 'users')),
    (snap) => {
      const list = snap.docs.map((d) => normalise(d.id, d.data()));
      // Newest first. Undated records sort last rather than appearing as the
      // most recent signup, which is what a `new Date()` fallback would do.
      list.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      publish({ users: list, loading: false, error: null });
    },
    (err) => {
      // The previous listeners had no error handler, so a rules denial left
      // the page showing "Loading..." forever with no indication why.
      console.error('useAdminUsers subscription failed:', err);
      publish({ users: shared.users, loading: false, error: err.message });
    },
  );
}

export function useAdminUsers() {
  const [state, setState] = useState<Snapshot>(shared);

  useEffect(() => {
    subscribers.add(setState);
    ensureSubscription();
    // A late subscriber gets whatever the shared listener already has, rather
    // than sitting on a stale "loading" from its initial render.
    setState(shared);

    return () => {
      subscribers.delete(setState);
      if (subscribers.size === 0) {
        unsubscribe?.();
        unsubscribe = null;
        // Next mount must not show the previous session's data as settled.
        shared = { users: [], loading: true, error: null };
      }
    };
  }, []);

  return state;
}
