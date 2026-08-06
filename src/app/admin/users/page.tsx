'use client';

import React, { useMemo, useState } from 'react';
import { Users, Search, ShieldCheck, UserX, UserCheck, AlertTriangle } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { useAdminUsers, type AdminUser } from '@/hooks/useAdminUsers';
import { useAdminContent } from '@/hooks/useAdminContent';
import { formatInr } from '@/lib/admin/revenue';
import {
  PageHeader, Card, Badge, ErrorNotice, Table, Th, Td, Row, EmptyRow, LoadingRow,
  Dialog, DialogActions, Button, SectionTitle,
} from '@/components/admin/primitives';
import toast from 'react-hot-toast';

/**
 * The single user-management surface.
 *
 * There were three: this page (roles), an "Admin" tab inside
 * /dashboard/settings (suspend/activate), and /editor/settings (another user
 * directory). They read the same collection through three different queries,
 * normalised it three different ways, and offered three disjoint subsets of the
 * available actions — so the answer to "what can I do to this account" depended
 * on which screen you happened to be on. Everything lives here now, on the
 * shared useAdminUsers hook.
 */

type ActionName = 'suspend' | 'activate' | 'revokeCourse' | 'demote';

async function callUserAction(body: { action: ActionName; targetUserId: string; courseId?: string }) {
  if (!auth.currentUser) throw new Error('Your session has expired. Please sign in again.');
  const token = await auth.currentUser.getIdToken();
  const res = await fetch('/api/admin/user-actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'The action could not be completed.');
  return data;
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { users, loading, error } = useAdminUsers();
  const { content } = useAdminContent();

  const [search, setSearch] = useState('');
  const [managing, setManaging] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  // Course titles, so entitlements read as names rather than raw document ids.
  const courseTitles = useMemo(() => {
    const map = new Map<string, string>();
    content?.courses.forEach((c) => map.set(c.id, c.title));
    return map;
  }, [content]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    // Every field is optional on an incomplete record — the ones this page
    // exists to make visible — so none of them can be dereferenced directly.
    return users.filter((u) =>
      [u.name, u.email, u.id].some((f) => String(f ?? '').toLowerCase().includes(needle)),
    );
  }, [users, search]);

  // Staff and candidates are listed separately. Mixing them under one
  // "Students" heading with a role chip meant the count at the top of the page
  // included your own team, and an admin account was one row of visual noise
  // away from the customers it was there to manage.
  const students = useMemo(() => filtered.filter((u) => u.role !== 'admin'), [filtered]);
  const admins = useMemo(() => filtered.filter((u) => u.role === 'admin'), [filtered]);

  // Re-read the live record rather than the snapshot captured when the dialog
  // opened, so it reflects an action taken moments ago.
  const managed = managing ? users.find((u) => u.id === managing.id) ?? managing : null;
  const isSelf = managed?.id === currentUser?.uid;

  const run = async (body: { action: ActionName; targetUserId: string; courseId?: string }, success: string) => {
    setBusy(true);
    try {
      await callUserAction(body);
      toast.success(success);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const incompleteCount = users.filter((u) => u.incomplete).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        subtitle="Students and their exam access, and the administrators of this platform."
        icon={Users}
      />

      {error && <ErrorNotice message={`Could not load users: ${error}`} />}

      {incompleteCount > 0 && (
        <Card className="flex items-start gap-3.5">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
          <div className="text-sm">
            <div className="font-semibold text-slate-900 dark:text-white">
              {incompleteCount} incomplete record{incompleteCount === 1 ? '' : 's'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Missing an email, role or signup date. They are listed below and marked, but they drop
              out of reports that sort by those fields. The backfill endpoint repairs them.
            </p>
          </div>
        </Card>
      )}

      <div className="relative w-full sm:max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or user ID…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors"
        />
      </div>

      <section>
        <SectionTitle hint={`${students.length} account${students.length === 1 ? '' : 's'}`}>
          Students
        </SectionTitle>
        <Table
          head={
            <>
              <Th>Candidate</Th>
              <Th>Signed up</Th>
              <Th>Exams enrolled</Th>
              <Th>Spent</Th>
              <Th>Status</Th>
              <Th className="text-right">Manage</Th>
            </>
          }
        >
          {loading ? (
            <LoadingRow colSpan={6} />
          ) : students.length === 0 ? (
            <EmptyRow colSpan={6}>
              {users.length === 0 ? 'No students have registered yet.' : 'No students match that search.'}
            </EmptyRow>
          ) : (
            students.map((u) => (
              <Row key={u.id} onClick={() => setManaging(u)}>
                <Td>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {u.name || <span className="italic text-slate-400">no name</span>}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {u.email || <span className="italic">no email · {u.id.slice(0, 12)}…</span>}
                  </div>
                </Td>
                <Td className="whitespace-nowrap">
                  {u.createdAt
                    ? u.createdAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : <span className="text-slate-400 italic">unknown</span>}
                </Td>
                <Td>
                  {/* The exams themselves, not just a count — the UAT note asks
                      to see what a student is enrolled in without a click. */}
                  {u.entitlements.length === 0 ? (
                    <Badge tone="neutral">none</Badge>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {u.entitlements.slice(0, 2).map((e) => (
                        <div key={e.courseId} className="flex items-center gap-2">
                          <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[190px]">
                            {courseTitles.get(e.courseId) ?? e.courseId}
                          </span>
                          <Badge tone={!e.isActive ? 'danger' : e.daysLeft <= 7 ? 'warn' : 'success'}>
                            {e.isActive ? `${e.daysLeft}d left` : 'expired'}
                          </Badge>
                        </div>
                      ))}
                      {u.entitlements.length > 2 && (
                        <span className="text-xs text-slate-400">
                          +{u.entitlements.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </Td>
                <Td className="tabular-nums whitespace-nowrap">{formatInr(u.totalSpent)}</Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {u.suspended && <Badge tone="danger">suspended</Badge>}
                    {u.incomplete && <Badge tone="warn">incomplete</Badge>}
                    {!u.suspended && !u.incomplete && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </div>
                </Td>
                <Td className="text-right">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-500">Manage →</span>
                </Td>
              </Row>
            ))
          )}
        </Table>
      </section>

      <section>
        <SectionTitle hint="platform access, not customers">Administrators</SectionTitle>
        <Table
          head={
            <>
              <Th>Administrator</Th>
              <Th>Signed up</Th>
              <Th>Status</Th>
              <Th className="text-right">Manage</Th>
            </>
          }
        >
          {loading ? (
            <LoadingRow colSpan={4} />
          ) : admins.length === 0 ? (
            <EmptyRow colSpan={4}>No administrators match that search.</EmptyRow>
          ) : (
            admins.map((u) => (
              <Row key={u.id} onClick={() => setManaging(u)}>
                <Td>
                  <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    {u.name || <span className="italic text-slate-400">no name</span>}
                    {u.id === currentUser?.uid && <Badge tone="info">you</Badge>}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {u.email || <span className="italic">no email · {u.id.slice(0, 12)}…</span>}
                  </div>
                </Td>
                <Td className="whitespace-nowrap">
                  {u.createdAt
                    ? u.createdAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : <span className="text-slate-400 italic">unknown</span>}
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="info" icon={ShieldCheck}>admin</Badge>
                    {u.suspended && <Badge tone="danger">suspended</Badge>}
                  </div>
                </Td>
                <Td className="text-right">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-500">Manage →</span>
                </Td>
              </Row>
            ))
          )}
        </Table>
      </section>

      <Dialog
        open={Boolean(managed)}
        onClose={() => !busy && setManaging(null)}
        title={managed?.name || managed?.email || 'Account'}
        description={managed?.email && managed?.name ? managed.email : `User ID ${managed?.id ?? ''}`}
      >
        {managed && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-1.5">
              {managed.role === 'admin' && <Badge tone="info" icon={ShieldCheck}>admin</Badge>}
              <Badge tone={managed.suspended ? 'danger' : 'success'}>
                {managed.suspended ? 'suspended' : 'active'}
              </Badge>
              <Badge tone="neutral">{formatInr(managed.totalSpent)} lifetime</Badge>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Course access
              </div>
              {managed.entitlements.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No enrolments.</p>
              ) : (
                <ul className="space-y-2">
                  {managed.entitlements.map((e) => (
                    <li
                      key={e.courseId}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-slate-900 dark:text-white truncate">
                          {courseTitles.get(e.courseId) ?? e.courseId}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {e.isActive ? `${e.daysLeft} day${e.daysLeft === 1 ? '' : 's'} left` : 'expired'}
                        </div>
                      </div>
                      {e.isActive && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(
                              { action: 'revokeCourse', targetUserId: managed.id, courseId: e.courseId },
                              'Course access revoked.',
                            )
                          }
                          className="shrink-0 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isSelf && (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                This is your own account. Suspending it or removing your admin access is blocked —
                if you were the last admin, nothing could undo it.
              </p>
            )}

            <DialogActions>
              <Button variant="secondary" onClick={() => setManaging(null)} disabled={busy}>
                Close
              </Button>

              {managed.role === 'admin' && !isSelf && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    run({ action: 'demote', targetUserId: managed.id }, 'Admin access removed.')
                  }
                >
                  Remove admin
                </Button>
              )}

              {!isSelf && (
                <Button
                  variant={managed.suspended ? 'primary' : 'danger'}
                  disabled={busy}
                  onClick={() =>
                    run(
                      {
                        action: managed.suspended ? 'activate' : 'suspend',
                        targetUserId: managed.id,
                      },
                      managed.suspended ? 'Account reactivated.' : 'Account suspended.',
                    )
                  }
                >
                  {managed.suspended ? (
                    <span className="inline-flex items-center gap-1.5"><UserCheck className="w-4 h-4" /> Reactivate</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5"><UserX className="w-4 h-4" /> Suspend</span>
                  )}
                </Button>
              )}
            </DialogActions>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
              Granting admin is deliberately not available here — set <code>role: &quot;admin&quot;</code> on the
              user document in the Firebase console.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
