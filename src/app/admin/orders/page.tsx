'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import { CreditCard, CheckCircle2, ShieldCheck, Download, Search, RefreshCw, RotateCcw, Clock } from 'lucide-react';
import { PLAN_PRICING } from '@/constants/pricing';
import toast from 'react-hot-toast';

interface Order {
  id: string;
  userId: string;
  userEmail?: string;
  courseId: string;
  planId: string;
  paymentId: string;
  orderId: string;
  amount: number;
  status: string;
  createdAt: any;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [reconciling, setReconciling] = useState(false);

  const handleReconcile = async () => {
    if (!auth.currentUser) return;
    setReconciling(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/reconcile-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reconciliation failed');
      const healed = (data.results || []).filter((r: any) => r.outcome === 'healed-and-granted').length;
      toast.success(`Reconciliation complete: scanned ${data.scanned}, healed ${healed} stuck order(s).`);
    } catch (err: any) {
      toast.error(err.message || 'Reconciliation failed');
    } finally {
      setReconciling(false);
    }
  };

  useEffect(() => {
    async function fetchOrders() {
      try {
        // Unordered read + client sort: ordering in the query drops any order
        // document missing createdAt, which previously hid coupon/webhook-born
        // orders from this list entirely.
        const q = query(collection(db, 'orders'));
        const querySnapshot = await getDocs(q);
        
        const fetchedOrders: Order[] = [];
        const userCache = new Map<string, string>(); // userId -> email

        for (const document of querySnapshot.docs) {
          const data = document.data() as Omit<Order, 'id'>;
          
          // Prefer the email denormalised onto the order at write time. The
          // per-row lookup below is now only a fallback for historical orders
          // written before that field existed, and its failure is logged
          // rather than swallowed — previously a permissions error was
          // indistinguishable from a genuinely missing user.
          let userEmail: string | undefined = (data as any).userEmail || userCache.get(data.userId);
          if (!userEmail && data.userId) {
            try {
              const userDoc = await getDoc(doc(db, 'users', data.userId));
              const email = userDoc.exists() ? userDoc.data().email : null;
              if (email) {
                userEmail = email;
                userCache.set(data.userId, email);
              }
            } catch (err) {
              console.error(`Order ${document.id}: user lookup failed`, err);
            }
          }

          fetchedOrders.push({
            id: document.id,
            ...data,
            userEmail
          });
        }
        
        // Sorted here rather than in the query — see the note above. Orders
        // with no createdAt sort last instead of vanishing from the list.
        const ms = (o: any) =>
          o?.createdAt?.toMillis ? o.createdAt.toMillis()
            : o?.createdAt ? new Date(o.createdAt).getTime()
            : 0;
        setOrders([...fetchedOrders].sort((a, b) => ms(b) - ms(a)));
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(order => 
    order.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.paymentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (order.userEmail && order.userEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
    order.courseId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-amber-500" />
            Orders & Revenue
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor all transactions including real payments and developer bypasses.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleReconcile}
            disabled={reconciling}
            title="Cross-checks orders stuck in 'created' status directly against Razorpay and grants access if they were actually captured"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${reconciling ? 'animate-spin' : ''}`} />
            {reconciling ? 'Reconciling…' : 'Reconcile Stuck Orders'}
          </button>
          <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, email, course..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
          />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#282C36] bg-slate-50 dark:bg-[#1A1C23]">
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Order ID</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Candidate</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Plan / Course</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#282C36]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin"></div>
                      Loading orders...
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const planData = PLAN_PRICING[order.planId as keyof typeof PLAN_PRICING];
                  // 'bypassed' is the legacy status; coupon grants now write
                  // 'success' with a zero amount, so detect both.
                  const isBypass = order.status === 'bypassed';
                  const isComped = !isBypass
                    && order.status === 'success'
                    && ((order as any).amountPaid === 0 || String(order.orderId).startsWith('BYPASS-'));
                  
                  return (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-[#1A1C23] transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-mono font-medium text-slate-900 dark:text-white">
                            {order.orderId}
                          </span>
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            {order.paymentId}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {order.userEmail ? (
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {order.userEmail}
                          </span>
                        ) : (
                          // Distinguish "we couldn't resolve this" from a real
                          // account named "Unknown User", and keep the id
                          // visible so it can actually be chased down.
                          <span className="text-sm text-slate-400 dark:text-slate-500 italic" title={order.userId}>
                            unresolved &middot; {order.userId ? `${order.userId.slice(0, 8)}…` : 'no user id'}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-900 dark:text-white">
                            {planData ? planData.name : order.planId}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {order.courseId}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm font-mono font-medium text-slate-900 dark:text-white">
                          ₹{order.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {(() => {
                          // Every non-'bypassed' status previously rendered as
                          // a green "Paid" — including orders still in
                          // 'created' (never paid) and 'refunded' (money
                          // returned), which is actively misleading on a
                          // financial screen.
                          const badge = {
                            base: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                          };
                          if (isBypass || isComped) {
                            return (
                              <span className={`${badge.base} bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20`}>
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Comped
                              </span>
                            );
                          }
                          if (order.status === 'refunded') {
                            return (
                              <span className={`${badge.base} bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20`}>
                                <RotateCcw className="w-3.5 h-3.5" />
                                Refunded
                              </span>
                            );
                          }
                          if (order.status === 'created') {
                            return (
                              <span className={`${badge.base} bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20`}>
                                <Clock className="w-3.5 h-3.5" />
                                Unpaid
                              </span>
                            );
                          }
                          return (
                            <span className={`${badge.base} bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20`}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Paid
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : 'Unknown'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
