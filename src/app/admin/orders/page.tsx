'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import { CreditCard, CheckCircle2, ShieldCheck, Download, Search, RefreshCw, RotateCcw, Clock } from 'lucide-react';
import { PLAN_PRICING } from '@/constants/pricing';
import { formatInr, summariseRevenue } from '@/lib/admin/revenue';
import toast from 'react-hot-toast';

/**
 * Optionality here is deliberate and load-bearing — it mirrors what is actually
 * in Firestore. An order in 'created' has no `paymentId`; orders written before
 * the money fields were split have no `amountPaid`/`amountBase`/`gstAmount`.
 * Typing them as required is what let the search crash ship.
 */
interface Order {
  id: string;
  userId: string;
  userEmail?: string;
  courseId?: string;
  planId: string;
  paymentId?: string;
  orderId: string;
  /** Legacy field: the ex-GST list price. Kept for older documents only. */
  amount?: number;
  /** Ex-GST, post-discount. */
  amountBase?: number;
  gstAmount?: number;
  /** Incl-GST — what the gateway actually captured. The figure that matters. */
  amountPaid?: number;
  couponCode?: string | null;
  status: string;
  createdAt: any;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [reconciling, setReconciling] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'refunded'>('all');
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [confirmRefund, setConfirmRefund] = useState<Order | null>(null);

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

  const reload = useCallback(async () => {
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
  }, []);

  useEffect(() => { reload(); }, [reload]);

  /**
   * Exports what is currently on screen (so a search narrows the export too).
   * Fields are quoted and internal quotes doubled per RFC 4180 — an order id
   * or coupon code containing a comma would otherwise shift every later column.
   */
  const handleExportCsv = () => {
    const cell = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = [
      'Order ID', 'Payment ID', 'Email', 'Course', 'Plan',
      'Base (ex-GST)', 'GST', 'Paid (incl GST)', 'Coupon', 'Status', 'Date',
    ];
    const rows = filteredOrders.map((o: any) => [
      o.orderId, o.paymentId, o.userEmail, o.courseId, o.planId,
      o.amountBase ?? '', o.gstAmount ?? '', o.amountPaid ?? '',
      o.couponCode ?? '', o.status,
      o.createdAt?.toDate ? o.createdAt.toDate().toISOString() : '',
    ]);

    const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
    // BOM so Excel opens UTF-8 correctly rather than mangling the rupee sign.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myexams365-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Every searchable field here is optional in practice: an order that was
   * created but never paid has no `paymentId`, and older rows can be missing
   * `courseId` or the denormalised `userEmail`. Reading `.toLowerCase()`
   * straight off them threw and blanked the entire page — masked until now
   * because an empty query short-circuits on `orderId.includes('')`, so the
   * crash only appeared once someone actually typed. Unpaid orders are exactly
   * what the "Reconcile Stuck Orders" button next to this box is for.
   */
  const filteredOrders = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      // "Unpaid" is the follow-up queue: money may have left a candidate's
      // account without the order ever resolving, and there was previously no
      // way to isolate those from a list dominated by successful ones.
      if (statusFilter === 'unpaid' && order.status !== 'created') return false;
      if (statusFilter === 'paid' && order.status !== 'success') return false;
      if (statusFilter === 'refunded'
        && !['refunded', 'refund_pending', 'revoked'].includes(order.status)) return false;

      if (!needle) return true;
      return [order.orderId, order.paymentId, order.userEmail, order.courseId, order.userId]
        .some((field) => String(field ?? '').toLowerCase().includes(needle));
    });
  }, [orders, searchQuery, statusFilter]);

  const counts = useMemo(() => ({
    all: orders.length,
    paid: orders.filter((o) => o.status === 'success').length,
    unpaid: orders.filter((o) => o.status === 'created').length,
    refunded: orders.filter((o) => ['refunded', 'refund_pending', 'revoked'].includes(o.status)).length,
  }), [orders]);

  const handleRefund = async (order: Order) => {
    if (!auth.currentUser) return;
    setRefundingId(order.orderId);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: order.orderId, revokeAccess: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refund failed');
      toast.success(
        `Refunded ${data.amount != null ? formatInr(data.amount, { decimals: true }) : ''} — access revoked.`,
        { duration: 8000 },
      );
      setConfirmRefund(null);
      await reload();
    } catch (err: any) {
      toast.error(err.message, { duration: 10000 });
    } finally {
      setRefundingId(null);
    }
  };

  // Revenue belongs on the page that holds the ledger it is derived from —
  // the Overview's "money collected" tile had no way to show its working, and
  // reconciling it against a Razorpay settlement report meant switching pages.
  // Reuses the same summariser the Overview does, so the two cannot disagree.
  const revenue = useMemo(() => summariseRevenue(filteredOrders), [filteredOrders]);

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
            onClick={handleExportCsv}
            disabled={filteredOrders.length === 0}
            title="Download the orders currently shown as a CSV file"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
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

      {/* Status tabs. "Unpaid" is the follow-up queue the Code Red list asks
          for: orders where money may have left a candidate's account without
          the order ever resolving. */}
      <div className="flex flex-wrap gap-2">
        {([
          ['all', 'All orders', counts.all],
          ['paid', 'Paid', counts.paid],
          ['unpaid', 'Unpaid / abandoned', counts.unpaid],
          ['refunded', 'Refunded & revoked', counts.refunded],
        ] as const).map(([key, label, n]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
              statusFilter === key
                ? 'bg-amber-500 text-slate-950 border-amber-500'
                : 'bg-white dark:bg-[#121419] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#282C36] hover:border-amber-500/50'
            }`}
          >
            {label} <span className="tabular-nums opacity-70">({n})</span>
          </button>
        ))}
      </div>

      {/* Revenue for whatever is currently on screen — narrowing the search
          narrows these figures too, which is what makes them useful for
          reconciling a date range or a single candidate against Razorpay. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Collected',
            value: formatInr(revenue.collected, { decimals: true }),
            sub: `${revenue.paidCount} paid order${revenue.paidCount === 1 ? '' : 's'} · incl. GST`,
            tone: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'GST payable',
            value: formatInr(revenue.gstPayable, { decimals: true }),
            sub: 'Collected on your behalf — must be remitted',
            tone: 'text-amber-600 dark:text-amber-400',
          },
          {
            label: 'Net revenue',
            value: formatInr(revenue.netAfterFees, { decimals: true }),
            sub: 'Ex-GST, less gateway fees — indicative',
            tone: 'text-slate-900 dark:text-white',
          },
          {
            label: 'Not counted',
            value: `${revenue.compedCount + revenue.unknownAmountCount}`,
            sub: `${revenue.compedCount} comped · ${revenue.unknownAmountCount} unverifiable · ${revenue.unpaidCount} unpaid`,
            tone: 'text-slate-900 dark:text-white',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-2xl p-4"
          >
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{s.label}</div>
            <div className={`text-xl font-bold tabular-nums mt-1 ${s.tone}`}>{s.value}</div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 leading-snug">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#282C36] bg-slate-50 dark:bg-[#1A1C23]">
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Order ID</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Candidate</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Plan / Course</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Paid (incl. GST)</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#282C36]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin"></div>
                      Loading orders...
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
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
                        {/* What actually changed hands, incl. GST — the same
                            basis the overview and the CSV export use. This
                            column used to render `amount`, the ex-GST list
                            price, so a discounted order reported the full
                            ticket price and no two screens agreed. */}
                        {typeof order.amountPaid === 'number' ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium tabular-nums text-slate-900 dark:text-white">
                              {formatInr(order.amountPaid, { decimals: true })}
                            </span>
                            {typeof order.amountBase === 'number' && typeof order.gstAmount === 'number' && (
                              <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                                {formatInr(order.amountBase, { decimals: true })} + {formatInr(order.gstAmount, { decimals: true })} GST
                              </span>
                            )}
                          </div>
                        ) : (
                          // Absent, not zero. Rendering ₹0.00 here would look
                          // like a comped order rather than a missing figure.
                          <span
                            className="text-sm text-slate-400 dark:text-slate-500 italic"
                            title="No captured amount recorded — usually an order created under different gateway keys. Run the backfill to resolve it."
                          >
                            unknown
                          </span>
                        )}
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
                          if (order.status === 'refund_pending') {
                            return (
                              <span className={`${badge.base} bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20`}>
                                <Clock className="w-3.5 h-3.5" />
                                Refunding
                              </span>
                            );
                          }
                          if (order.status === 'revoked') {
                            return (
                              <span className={`${badge.base} bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20`}>
                                <RotateCcw className="w-3.5 h-3.5" />
                                Access revoked
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
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        {/* Refundable only when real money was captured. A comped
                            enrolment has nothing at the gateway to return. */}
                        {order.status === 'success' && order.paymentId && !isComped ? (
                          <button
                            onClick={() => setConfirmRefund(order)}
                            disabled={refundingId === order.orderId}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors disabled:opacity-50"
                          >
                            Refund
                          </button>
                        ) : order.status === 'refund_pending' ? (
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">in progress</span>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmRefund && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          onClick={() => !refundingId && setConfirmRefund(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#181A1F] border border-slate-200 dark:border-white/10 p-6 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Refund {confirmRefund.amountPaid != null
                ? formatInr(confirmRefund.amountPaid, { decimals: true })
                : 'this order'}?
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              This returns the money through Razorpay and revokes access to{' '}
              <strong className="text-slate-700 dark:text-slate-200">{confirmRefund.courseId}</strong>{' '}
              for {confirmRefund.userEmail || 'this candidate'}.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
              A refund cannot be undone. Razorpay settles it back to the candidate over the
              next 5–7 working days, so they will not see it immediately.
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 mt-6">
              <button
                onClick={() => setConfirmRefund(null)}
                disabled={Boolean(refundingId)}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRefund(confirmRefund)}
                disabled={Boolean(refundingId)}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-rose-500 hover:bg-rose-400 text-white transition-colors disabled:opacity-50"
              >
                {refundingId ? 'Refunding…' : 'Refund and revoke access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
