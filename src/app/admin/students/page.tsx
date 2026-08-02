'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Users, Search, ShieldCheck, UserX, AlertTriangle, ChevronRight } from 'lucide-react';
import { useAdminUsers, type AdminUser } from '@/hooks/useAdminUsers';
import {
  PageHeader, Table, Th, Td, Row, EmptyRow, LoadingRow, Badge, ErrorNotice,
} from '@/components/admin/primitives';

/**
 * Student directory.
 *
 * Replaces /admin/users. Per-student actions live on the detail page rather
 * than being scattered across screens — previously suspend/activate lived in
 * the *student* settings page while role changes lived here, so neither could
 * do the whole job and each was missing what the other had.
 */
export default function AdminStudentsPage() {
  const { users, loading, error } = useAdminUsers();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'suspended' | 'staff'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !(
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      )) return false;

      switch (filter) {
        case 'active': return u.activeCount > 0;
        case 'expiring': return u.entitlements.some((e) => e.isActive && e.daysLeft <= 7);
        case 'suspended': return u.suspended;
        case 'staff': return u.role !== 'student';
        default: return true;
      }
    });
  }, [users, search, filter]);

  const filters = [
    { key: 'all', label: 'All', count: users.length },
    { key: 'active', label: 'With access', count: users.filter((u) => u.activeCount > 0).length },
    { key: 'expiring', label: 'Expiring', count: users.filter((u) => u.entitlements.some((e) => e.isActive && e.daysLeft <= 7)).length },
    { key: 'suspended', label: 'Suspended', count: users.filter((u) => u.suspended).length },
    { key: 'staff', label: 'Staff', count: users.filter((u) => u.role !== 'student').length },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title="Students" subtitle="Everyone registered on the platform." icon={Users} />

      {error && <ErrorNotice message={`Could not load students: ${error}`} />}

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as typeof filter)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                filter === f.key
                  ? 'bg-amber-500 text-[#111B35]'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-70 tabular-nums">{f.count}</span>
            </button>
          ))}
        </div>

        <div className="relative lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or ID…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#121419] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      </div>

      <Table
        head={<>
          <Th>Student</Th>
          <Th>Access</Th>
          <Th>Spent</Th>
          <Th>Joined</Th>
          <Th className="text-right">Status</Th>
          <Th />
        </>}
      >
        {loading ? (
          <LoadingRow colSpan={6} />
        ) : filtered.length === 0 ? (
          <EmptyRow colSpan={6}>
            {users.length === 0 ? 'No students registered yet.' : 'No students match this filter.'}
          </EmptyRow>
        ) : (
          filtered.map((u) => <StudentRow key={u.id} user={u} />)
        )}
      </Table>
    </div>
  );
}

function StudentRow({ user: u }: { user: AdminUser }) {
  const soonest = u.entitlements
    .filter((e) => e.isActive)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];

  return (
    <Row>
      <Td>
        <div className="min-w-0">
          <div className="font-medium text-slate-900 dark:text-white truncate flex items-center gap-2">
            {u.name || <span className="italic text-slate-400">no name</span>}
            {u.incomplete && (
              <span title="This record is missing email, role or signup date">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {u.email || <span className="font-mono">{u.id}</span>}
          </div>
        </div>
      </Td>

      <Td>
        {u.activeCount > 0 ? (
          <div>
            <span className="font-medium text-slate-900 dark:text-white">
              {u.activeCount} course{u.activeCount === 1 ? '' : 's'}
            </span>
            {soonest && (
              <div className={`text-xs mt-0.5 ${soonest.daysLeft <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {soonest.daysLeft <= 0 ? 'expires today' : `${soonest.daysLeft}d left`}
              </div>
            )}
          </div>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">—</span>
        )}
      </Td>

      <Td className="tabular-nums">
        {u.totalSpent > 0
          ? `₹${u.totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : <span className="text-slate-400 dark:text-slate-500">—</span>}
      </Td>

      <Td className="whitespace-nowrap text-slate-500 dark:text-slate-400">
        {u.createdAt
          ? u.createdAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—'}
      </Td>

      <Td className="text-right">
        <div className="flex items-center justify-end gap-2">
          {u.suspended && <Badge tone="danger" icon={UserX}>Suspended</Badge>}
          {u.role !== 'student' && <Badge tone="info" icon={ShieldCheck}>{u.role}</Badge>}
          {!u.suspended && u.role === 'student' && (
            <Badge tone={u.activeCount > 0 ? 'success' : 'neutral'}>
              {u.activeCount > 0 ? 'Active' : 'No courses'}
            </Badge>
          )}
        </div>
      </Td>

      <Td className="text-right">
        <Link
          href={`/admin/students/${u.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-500 hover:underline whitespace-nowrap"
        >
          Manage <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </Td>
    </Row>
  );
}
