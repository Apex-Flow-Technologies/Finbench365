'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useAdminContent } from '@/hooks/useAdminContent';
import { toMillis, formatInr, isComped } from '@/lib/admin/revenue';
import {
  PageHeader, Card, SectionTitle, Badge, Table, Th, Td, Row,
  EmptyRow, LoadingRow, Dialog, DialogActions, Button, ErrorNotice,
} from '@/components/admin/primitives';
import {
  ArrowLeft, Mail, Calendar, ShieldCheck, UserX, UserCheck,
  BookOpen, CreditCard, ClipboardList, AlertTriangle, Gift,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PLAN_PRICING } from '@/constants/pricing';

/**
 * Everything about one student in one place.
 *
 * Previously this information was split across three screens and none of them
 * was complete: role changes lived in the admin user list, suspend/activate in
 * the *student* settings page, and a read-only directory in the editor
 * settings. Payment history and exam attempts were not visible anywhere.
 */
export default function StudentDetailPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);
  const { users, loading: usersLoading } = useAdminUsers();
  const { content } = useAdminContent();

  const student = useMemo(() => users.find((u) => u.id === uid), [users, uid]);

  const [orders, setOrders] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [testTitles, setTestTitles] = useState<Record<string, string>>({});
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [working, setWorking] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantForm, setGrantForm] = useState({ courseId: '', planId: 'plan-30', mode: 'grant' as 'grant' | 'extend', reason: '' });
  const [confirmRevoke, setConfirmRevoke] = useState<{ courseId: string; title: string } | null>(null);

  const courseTitle = (courseId: string) =>
    content?.courses.find((c) => c.id === courseId)?.title ?? courseId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingHistory(true);
      try {
        const [orderSnap, attemptSnap] = await Promise.all([
          getDocs(query(collection(db, 'orders'), where('userId', '==', uid))),
          getDocs(query(collection(db, 'test_attempts'), where('userId', '==', uid))),
        ]);
        if (cancelled) return;

        const orderList = orderSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        orderList.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setOrders(orderList);

        const attemptList = attemptSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        attemptList.sort((a, b) => toMillis(b.submittedAt ?? b.startTime) - toMillis(a.submittedAt ?? a.startTime));
        setAttempts(attemptList);

        // Resolve test names for the attempts actually shown, rather than
        // reading the whole mock_tests collection.
        const ids = [...new Set(attemptList.map((a) => a.testId).filter(Boolean))];
        const titles: Record<string, string> = {};
        await Promise.all(ids.map(async (id) => {
          try {
            const snap = await getDoc(doc(db, 'mock_tests', id));
            if (snap.exists()) titles[id] = (snap.data() as any).title || id;
          } catch { /* leave unresolved; the id is shown instead */ }
        }));
        if (!cancelled) setTestTitles(titles);
      } catch (err: any) {
        console.error('Failed to load student history:', err);
        if (!cancelled) setHistoryError(err.message ?? 'Could not load history');
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  const adminAction = async (url: string, body: any) => {
    if (!auth.currentUser) throw new Error('Not signed in');
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const handleGrant = async () => {
    if (!student || !grantForm.courseId) return;
    setWorking(true);
    try {
      await adminAction('/api/admin/grant-access', {
        targetUserId: student.id,
        courseId: grantForm.courseId,
        planId: grantForm.planId,
        mode: grantForm.mode,
        reason: grantForm.reason,
      });
      toast.success(grantForm.mode === 'extend' ? 'Access extended.' : 'Access granted.');
      setGrantOpen(false);
      setGrantForm({ courseId: '', planId: 'plan-30', mode: 'grant', reason: '' });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  const handleRevoke = async () => {
    if (!student || !confirmRevoke) return;
    setWorking(true);
    try {
      const data = await adminAction('/api/admin/user-actions', {
        action: 'revokeCourse',
        targetUserId: student.id,
        courseId: confirmRevoke.courseId,
      });
      toast.success(
        data.ordersMarkedRefunded
          ? `Access revoked. ${data.ordersMarkedRefunded} order(s) marked refunded.`
          : 'Access revoked.',
      );
      setConfirmRevoke(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  // Suspension goes through the server API, never a direct client write:
  // `suspended` is a rules-protected field and the API records who did it.
  const toggleSuspension = async () => {
    if (!student || !auth.currentUser) return;
    setWorking(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/user-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: student.suspended ? 'activate' : 'suspend',
          targetUserId: student.id,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Request failed');
      toast.success(student.suspended ? 'Account reactivated.' : 'Account suspended.');
      setConfirmSuspend(false);
    } catch (err: any) {
      toast.error(err.message || 'Could not update the account.');
    } finally {
      setWorking(false);
    }
  };

  if (usersLoading) {
    return <div className="py-20 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  if (!student) {
    return (
      <div className="space-y-6">
        <BackLink />
        <ErrorNotice message={`No student record found for ${uid}. The account may have been deleted while orders still reference it.`} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BackLink />

      <PageHeader
        title={student.name || 'Unnamed student'}
        subtitle={student.email || student.id}
        actions={<>
          <Button variant="secondary" onClick={() => setGrantOpen(true)}>
            <span className="flex items-center gap-2"><Gift className="w-4 h-4" /> Grant access</span>
          </Button>
          <Button
            variant={student.suspended ? 'primary' : 'danger'}
            onClick={() => setConfirmSuspend(true)}
          >
            <span className="flex items-center gap-2">
              {student.suspended ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
              {student.suspended ? 'Reactivate' : 'Suspend'}
            </span>
          </Button>
        </>}
      />

      {student.incomplete && (
        <ErrorNotice message="This record is missing an email, role or signup date. It can drop out of reports — run the backfill to repair it." />
      )}

      {/* -------------------------------------------------------- profile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard icon={Mail} label="Email" value={student.email || '—'} />
        <InfoCard
          icon={Calendar}
          label="Joined"
          value={student.createdAt
            ? student.createdAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—'}
        />
        <InfoCard icon={CreditCard} label="Lifetime spend" value={formatInr(student.totalSpent, { decimals: true })} />
        <InfoCard
          icon={ShieldCheck}
          label="Role"
          value={<span className="capitalize">{student.role}</span>}
          badge={student.suspended ? <Badge tone="danger">Suspended</Badge> : undefined}
        />
      </div>

      {historyError && <ErrorNotice message={historyError} />}

      {/* --------------------------------------------------- entitlements */}
      <section>
        <SectionTitle hint={`${student.activeCount} active`}>Course access</SectionTitle>
        <Table head={<><Th>Course</Th><Th>Plan</Th><Th>Expires</Th><Th className="text-right">Status</Th><Th /></>}>
          {student.entitlements.length === 0 ? (
            <EmptyRow colSpan={5}>This student has no course access.</EmptyRow>
          ) : (
            student.entitlements.map((e) => (
              <Row key={e.courseId}>
                <Td className="font-medium text-slate-900 dark:text-white">{courseTitle(e.courseId)}</Td>
                <Td className="text-slate-500 dark:text-slate-400">{e.planId ?? '—'}</Td>
                <Td className="whitespace-nowrap">
                  {e.expiresAt
                    ? e.expiresAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—'}
                </Td>
                <Td className="text-right">
                  {e.isActive
                    ? <Badge tone={e.daysLeft <= 7 ? 'warn' : 'success'}>
                        {e.daysLeft <= 0 ? 'expires today' : `${e.daysLeft} day${e.daysLeft === 1 ? '' : 's'} left`}
                      </Badge>
                    : <Badge tone="neutral">Expired</Badge>}
                </Td>
                <Td className="text-right">
                  <button
                    onClick={() => setConfirmRevoke({ courseId: e.courseId, title: courseTitle(e.courseId) })}
                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    Revoke
                  </button>
                </Td>
              </Row>
            ))
          )}
        </Table>
      </section>

      {/* --------------------------------------------------------- orders */}
      <section>
        <SectionTitle hint={`${orders.length} total`}>Payment history</SectionTitle>
        <Table head={<><Th>Order</Th><Th>Course</Th><Th>Amount</Th><Th>Date</Th><Th className="text-right">Status</Th></>}>
          {loadingHistory ? (
            <LoadingRow colSpan={5} />
          ) : orders.length === 0 ? (
            <EmptyRow colSpan={5}>No orders for this student.</EmptyRow>
          ) : (
            orders.map((o) => (
              <Row key={o.id}>
                <Td className="font-mono text-xs">{o.orderId}</Td>
                <Td>{courseTitle(o.courseId)}</Td>
                <Td className="tabular-nums">
                  {typeof o.amountPaid === 'number'
                    ? formatInr(o.amountPaid, { decimals: true })
                    : <span className="text-slate-400 italic">unverified</span>}
                </Td>
                <Td className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {toMillis(o.createdAt)
                    ? new Date(toMillis(o.createdAt)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—'}
                </Td>
                <Td className="text-right">
                  {o.status === 'refunded' ? <Badge tone="danger">Refunded</Badge>
                    : o.status === 'created' ? <Badge tone="neutral">Unpaid</Badge>
                    : isComped(o) ? <Badge tone="warn">Comped</Badge>
                    : <Badge tone="success">Paid</Badge>}
                </Td>
              </Row>
            ))
          )}
        </Table>
      </section>

      {/* ------------------------------------------------------- attempts */}
      <section>
        <SectionTitle hint={`${attempts.length} total`}>Exam attempts</SectionTitle>
        <Table head={<><Th>Test</Th><Th>Score</Th><Th>Date</Th><Th className="text-right">Status</Th></>}>
          {loadingHistory ? (
            <LoadingRow colSpan={4} />
          ) : attempts.length === 0 ? (
            <EmptyRow colSpan={4}>This student has not attempted any exams.</EmptyRow>
          ) : (
            attempts.slice(0, 25).map((a) => (
              <Row key={a.id}>
                <Td className="font-medium text-slate-900 dark:text-white">
                  {testTitles[a.testId] ?? <span className="font-mono text-xs">{a.testId}</span>}
                </Td>
                <Td className="tabular-nums">
                  {typeof a.score === 'number'
                    ? `${a.score}${a.totalQuestions ? ` / ${a.totalQuestions}` : ''}`
                    : '—'}
                </Td>
                <Td className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {toMillis(a.submittedAt ?? a.startTime)
                    ? new Date(toMillis(a.submittedAt ?? a.startTime)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—'}
                </Td>
                <Td className="text-right">
                  <Badge tone={a.status === 'completed' ? 'success' : 'warn'}>
                    {a.status === 'completed' ? 'Completed' : 'In progress'}
                  </Badge>
                </Td>
              </Row>
            ))
          )}
        </Table>
      </section>

      <Dialog
        open={grantOpen}
        title="Grant course access"
        description="Gives this student access without a payment. It is recorded as a comped enrolment, so it never counts toward revenue, and it is written to the audit log."
        onClose={() => !working && setGrantOpen(false)}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleGrant(); }} className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Course</span>
            <select
              value={grantForm.courseId}
              onChange={(ev) => setGrantForm({ ...grantForm, courseId: ev.target.value })}
              className={selectCls}
            >
              <option value="">Select a course…</option>
              {(content?.courses ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Duration</span>
            <select
              value={grantForm.planId}
              onChange={(ev) => setGrantForm({ ...grantForm, planId: ev.target.value })}
              className={selectCls}
            >
              {Object.entries(PLAN_PRICING).map(([id, plan]) => (
                <option key={id} value={id}>{plan.name} — {plan.durationDays} days</option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            {(['grant', 'extend'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setGrantForm({ ...grantForm, mode: m })}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  grantForm.mode === m
                    ? 'bg-amber-500 text-[#111B35]'
                    : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400'
                }`}
              >
                {m === 'grant' ? 'Set from today' : 'Add to existing'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed -mt-1">
            {grantForm.mode === 'grant'
              ? 'Access runs from today for the full duration. If they already have longer remaining, this will shorten it.'
              : 'The duration is added on top of whatever access remains, so their expiry only ever moves forward.'}
          </p>

          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Reason <span className="text-slate-400 font-normal">· recorded in the audit log</span>
            </span>
            <input
              value={grantForm.reason}
              onChange={(ev) => setGrantForm({ ...grantForm, reason: ev.target.value })}
              placeholder="e.g. compensation for the failed payment on 2 Aug"
              className={selectCls}
            />
          </label>

          <DialogActions>
            <Button type="submit" disabled={working || !grantForm.courseId}>
              {working ? 'Working…' : grantForm.mode === 'extend' ? 'Extend access' : 'Grant access'}
            </Button>
            <Button variant="secondary" onClick={() => setGrantOpen(false)} disabled={working}>Cancel</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(confirmRevoke)}
        title={`Revoke access to "${confirmRevoke?.title ?? ''}"?`}
        description="The student loses access to this course immediately. Any successful orders for it are marked refunded so the ledger matches — do issue the actual refund in Razorpay separately, as this does not move money."
        onClose={() => !working && setConfirmRevoke(null)}
      >
        <DialogActions>
          <Button variant="danger" onClick={handleRevoke} disabled={working}>
            {working ? 'Revoking…' : 'Revoke access'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmRevoke(null)} disabled={working}>Cancel</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmSuspend}
        title={student.suspended ? 'Reactivate this account?' : 'Suspend this account?'}
        description={student.suspended
          ? 'They will be able to sign in and use their existing course access again.'
          : 'They will be signed out immediately and blocked from buying courses or submitting exams. Their course access is not deleted, so reactivating restores everything.'}
        onClose={() => !working && setConfirmSuspend(false)}
      >
        <DialogActions>
          <Button
            variant={student.suspended ? 'primary' : 'danger'}
            onClick={toggleSuspension}
            disabled={working}
          >
            {working ? 'Working…' : student.suspended ? 'Reactivate' : 'Suspend'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmSuspend(false)} disabled={working}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

const selectCls =
  'mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#121419] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500 transition-colors';

function BackLink() {
  return (
    <Link
      href="/admin/students"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
    >
      <ArrowLeft className="w-3.5 h-3.5" /> All students
    </Link>
  );
}

function InfoCard({
  icon: Icon, label, value, badge,
}: {
  icon: any; label: string; value: React.ReactNode; badge?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white truncate flex items-center gap-2">
        {value}
        {badge}
      </div>
    </Card>
  );
}
