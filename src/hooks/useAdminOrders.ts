'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { toMillis, type OrderLike } from '@/lib/admin/revenue';

export interface AdminOrder extends OrderLike {
  id: string;
  userId: string;
  userEmail?: string;
  courseId: string;
  planId: string;
  paymentId?: string;
  couponCode?: string | null;
  grantedVia?: string;
  amount?: number;
}

/**
 * Orders for the admin panel. Unordered read + client sort, for the same
 * reason as useAdminUsers: an order missing createdAt would otherwise be
 * dropped from the query entirely rather than merely sorted oddly.
 */
export function useAdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'orders')));
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as AdminOrder[];
      list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      setOrders(list);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load orders:', err);
      setError(err.message ?? 'Could not load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { orders, loading, error, reload: load };
}
