'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { getUserEntitlements } from '@/lib/firebase/db';

/**
 * A candidate's course access, kept live.
 *
 * Every screen used to call getUserEntitlements() once inside a mount effect.
 * Entitlements are granted by the SERVER — after Razorpay confirms, via
 * /api/payments/verify or the webhook — so nothing in the browser knew when
 * that happened. A candidate returning to the storefront straight after paying
 * saw "Buy Now" on the exam they had just bought, and only a hard reload fixed
 * it. Firestore's local cache made it stickier still.
 *
 * Subscribing to the user document means the grant lands as soon as it is
 * written. The listener fires on any change to the document, so the refetch is
 * debounced against the enrolment map rather than run on every unrelated write
 * (a session-id ping, a profile edit).
 */
export function useEntitlements(uid: string | undefined) {
  const [entitlements, setEntitlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      setEntitlements([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let lastKey = '';

    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const enrolled = snap.data()?.enrolledCourses ?? {};
        // Key on the course ids AND their expiry, so a renewal (same course,
        // new date) still counts as a change worth re-resolving.
        const key = Object.entries(enrolled)
          .map(([id, v]: [string, any]) => `${id}:${v?.expiresAt?.seconds ?? v?.expiresAt ?? ''}`)
          .sort()
          .join('|');
        if (key === lastKey) return;
        lastKey = key;

        // getUserEntitlements resolves the course documents behind the ids;
        // doing that here keeps a single definition of an "entitlement" shape.
        getUserEntitlements(uid)
          .then((data) => { if (!cancelled) { setEntitlements(data); setLoading(false); } })
          .catch((err) => {
            console.error('Could not resolve entitlements:', err);
            if (!cancelled) setLoading(false);
          });
      },
      (err) => {
        console.error('Entitlement subscription failed:', err);
        if (!cancelled) setLoading(false);
      },
    );

    return () => { cancelled = true; unsub(); };
  }, [uid]);

  return { entitlements, loading };
}
