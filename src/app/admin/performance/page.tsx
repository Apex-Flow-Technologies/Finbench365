'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { BarChart3, Search, RefreshCw, ChevronRight, Download } from 'lucide-react';
import { PageHeader, Card, StatCard, Badge, Table, Th, Td, Row, EmptyRow } from '@/components/admin/primitives';
import toast from 'react-hot-toast';

/**
 * Every candidate's exam performance, in one place.
 *
 * A candidate has always been able to see their own accuracy and time on the
 * dashboard; the business could see who had paid but never how anyone was
 * actually doing. Without this, "is this course too hard?" and "did that
 * candidate ever sit the paper they bought?" had no answer short of reading the
 * database by hand.
 *
 * Read-only, and deliberately so: nothing here can change a mark. Grading
 * belongs to the server, and an admin screen that could edit a result would
 * undo the whole point of moving it there.
 */

interface AttemptRow {
  id: string;
  userId: string;
  testId: string;
  score: number | null;
  percentage: number | null;
  passed: boolean | null;
  correctCount: number | null;
  totalQuestions: number | null;
  timeTakenMs: number | null;
  submittedAt: Date | null;
  finalisedBy: string | null;
}

interface StudentRow {
  uid: string;
  name: string;
  email: string;
  attempts: AttemptRow[];
  bestPct: number | null;
  avgPct: number | null;
  passRate: number | null;
  lastActive: Date | null;
}

const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n)}%`);

const duration = (ms: number | null) => {
  if (!ms || ms < 0) return '—';
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

const toDate = (v: any): Date | null =>
  v?.toDate ? v.toDate() : v instanceof Date ? v : null;

/**
 * Percentage for one attempt.
 *
 * `percentage` is written by the grader. Attempts recorded before that existed
 * fall back to correct/total — never to `score`, which under negative marking
 * can be fractional or negative and would misreport how much a candidate knew.
 */
function attemptPct(a: AttemptRow): number | null {
  if (typeof a.percentage === 'number') return a.percentage;
  if (typeof a.correctCount === 'number' && a.totalQuestions) {
    return (a.correctCount / a.totalQuestions) * 100;
  }
  return null;
}

export default function AdminPerformancePage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [tests, setTests] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openUid, setOpenUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersSnap, attemptsSnap, testsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'test_attempts'), where('status', '==', 'completed'))),
        getDocs(collection(db, 'mock_tests')),
      ]);

      const titles: Record<string, string> = {};
      testsSnap.docs.forEach((d) => { titles[d.id] = d.data().title ?? d.id; });
      setTests(titles);

      const byUser = new Map<string, AttemptRow[]>();
      attemptsSnap.docs.forEach((d) => {
        const x = d.data();
        const row: AttemptRow = {
          id: d.id,
          userId: x.userId,
          testId: x.testId,
          score: x.score ?? null,
          percentage: typeof x.percentage === 'number' ? x.percentage : null,
          passed: typeof x.passed === 'boolean' ? x.passed : null,
          correctCount: typeof x.correctCount === 'number' ? x.correctCount : null,
          totalQuestions: x.totalQuestions ?? null,
          timeTakenMs: x.timeTakenMs ?? null,
          submittedAt: toDate(x.submittedAt) ?? toDate(x.endTime),
          finalisedBy: x.finalisedBy ?? null,
        };
        const list = byUser.get(row.userId);
        if (list) list.push(row); else byUser.set(row.userId, [row]);
      });

      const rows: StudentRow[] = usersSnap.docs
        .filter((d) => d.data().role !== 'admin')
        .map((d) => {
          const attempts = (byUser.get(d.id) ?? [])
            .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));
          const pcts = attempts.map(attemptPct).filter((p): p is number => p !== null);
          const graded = attempts.filter((a) => typeof a.passed === 'boolean');
          return {
            uid: d.id,
            name: d.data().name ?? '—',
            email: d.data().email ?? '—',
            attempts,
            bestPct: pcts.length ? Math.max(...pcts) : null,
            avgPct: pcts.length ? pcts.reduce((s, p) => s + p, 0) / pcts.length : null,
            passRate: graded.length
              ? (graded.filter((a) => a.passed).length / graded.length) * 100
              : null,
            lastActive: attempts[0]?.submittedAt ?? null,
          };
        })
        // Candidates who have actually sat something come first; the rest are
        // still listed, because "bought it and never started" is a finding too.
        .sort((a, b) => (b.lastActive?.getTime() ?? 0) - (a.lastActive?.getTime() ?? 0));

      setStudents(rows);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.code === 'permission-denied'
        ? 'Permission denied. Deploy the latest security rules and sign in as an admin.'
        : 'Could not load performance data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }, [students, search]);

  const totals = useMemo(() => {
    const sat = students.filter((s) => s.attempts.length > 0);
    const all = students.flatMap((s) => s.attempts).map(attemptPct)
      .filter((p): p is number => p !== null);
    const graded = students.flatMap((s) => s.attempts).filter((a) => typeof a.passed === 'boolean');
    return {
      sat: sat.length,
      neverSat: students.length - sat.length,
      attempts: students.reduce((n, s) => n + s.attempts.length, 0),
      avg: all.length ? all.reduce((a, b) => a + b, 0) / all.length : null,
      passRate: graded.length ? (graded.filter((a) => a.passed).length / graded.length) * 100 : null,
    };
  }, [students]);

  const exportCsv = () => {
    const cell = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Candidate', 'Email', 'Mock test', 'Score %', 'Correct', 'Out of',
      'Result', 'Time taken', 'Finalised by', 'Submitted'];
    const rows = filtered.flatMap((s) => s.attempts.map((a) => [
      s.name, s.email, tests[a.testId] ?? a.testId,
      attemptPct(a) === null ? '' : Math.round(attemptPct(a)!),
      a.correctCount ?? '', a.totalQuestions ?? '',
      a.passed === null ? '' : a.passed ? 'Pass' : 'Fail',
      duration(a.timeTakenMs),
      a.finalisedBy === 'disconnected' ? 'Closed after disconnection' : 'Submitted',
      a.submittedAt ? a.submittedAt.toISOString() : '',
    ]));
    const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myexams365-performance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Student Performance"
        subtitle="Every completed attempt, by candidate. Read-only — marks are set by the grader."
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <button
          onClick={exportCsv}
          disabled={loading || filtered.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        <div className="relative w-full sm:w-72 sm:ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#181A1F] text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Candidates who have sat a paper" value={String(totals.sat)}
          sub={`${totals.neverSat} bought but never started`} icon={BarChart3} tone="neutral" loading={loading} />
        <StatCard label="Completed attempts" value={String(totals.attempts)} icon={BarChart3} tone="neutral" loading={loading} />
        <StatCard label="Average score" value={pct(totals.avg)} icon={BarChart3} tone="neutral" loading={loading} />
        <StatCard label="Pass rate" value={pct(totals.passRate)}
          sub="Against each paper's own pass mark" icon={BarChart3} tone="neutral" loading={loading} />
      </div>

      <Card>
        <Table head={<>
          <Th>Candidate</Th>
          <Th>Attempts</Th>
          <Th>Average</Th>
          <Th>Best</Th>
          <Th>Pass rate</Th>
          <Th>Last attempt</Th>
          <Th />
        </>}>
          {loading ? (
            <EmptyRow colSpan={7}>Loading…</EmptyRow>
          ) : filtered.length === 0 ? (
            <EmptyRow colSpan={7}>No candidates match that search.</EmptyRow>
          ) : filtered.map((s) => (
            <React.Fragment key={s.uid}>
              <Row onClick={() => setOpenUid(openUid === s.uid ? null : s.uid)}>
                <Td>
                  <div className="font-semibold text-slate-900 dark:text-white">{s.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{s.email}</div>
                </Td>
                <Td className="tabular-nums">{s.attempts.length}</Td>
                <Td className="tabular-nums">{pct(s.avgPct)}</Td>
                <Td className="tabular-nums">{pct(s.bestPct)}</Td>
                <Td>
                  {s.passRate === null ? '—' : (
                    <Badge tone={s.passRate >= 50 ? 'success' : 'warn'}>{pct(s.passRate)}</Badge>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-slate-600 dark:text-slate-300">
                  {s.lastActive ? s.lastActive.toLocaleDateString() : 'Never sat a paper'}
                </Td>
                <Td>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${openUid === s.uid ? 'rotate-90' : ''}`} />
                </Td>
              </Row>

              {openUid === s.uid && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <div className="bg-slate-50 dark:bg-[#0B0C10] px-5 py-4 border-y border-slate-200 dark:border-white/10">
                      {s.attempts.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          This candidate has access but has not completed a paper yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {s.attempts.map((a) => {
                            const p = attemptPct(a);
                            return (
                              <div key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm rounded-lg bg-white dark:bg-[#181A1F] border border-slate-200 dark:border-white/10 px-3 py-2">
                                <span className="font-semibold text-slate-900 dark:text-white min-w-0 flex-1 truncate">
                                  {tests[a.testId] ?? a.testId}
                                </span>
                                <span className="tabular-nums text-slate-700 dark:text-slate-200">{pct(p)}</span>
                                <span className="tabular-nums text-xs text-slate-500 dark:text-slate-400">
                                  {a.correctCount ?? '—'}/{a.totalQuestions ?? '—'} correct
                                </span>
                                <span className="tabular-nums text-xs text-slate-500 dark:text-slate-400">{duration(a.timeTakenMs)}</span>
                                {a.passed !== null && (
                                  <Badge tone={a.passed ? 'success' : 'danger'}>{a.passed ? 'Pass' : 'Fail'}</Badge>
                                )}
                                {/* Worth surfacing: an attempt closed by the
                                    disconnect rule was marked on whatever had
                                    been answered, so a low score here may not
                                    mean the candidate could not do it. */}
                                {a.finalisedBy === 'disconnected' && (
                                  <Badge tone="warn">Closed after disconnection</Badge>
                                )}
                                <span className="text-xs text-slate-400 whitespace-nowrap">
                                  {a.submittedAt ? a.submittedAt.toLocaleString() : '—'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </Table>
      </Card>
    </div>
  );
}
