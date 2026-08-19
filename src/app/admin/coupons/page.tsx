'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { auth, db } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { Ticket, Plus, RefreshCw, Loader2, ChevronDown, X } from 'lucide-react';
import { PageHeader, Card, SectionTitle, Badge, Table, Th, Td, Row, EmptyRow } from '@/components/admin/primitives';
import toast from 'react-hot-toast';

/**
 * Discount codes, created and managed from the admin panel.
 *
 * Previously a coupon could only be created by running a script committed to
 * the repository, which is how a live 100%-off code with no expiry ended up in
 * version control.
 */

interface Coupon {
  code: string;
  discountPercent: number;
  isActive: boolean;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string | null;
  description: string | null;
  usable: boolean;
  unusableReason: string | null;
  /** Empty means the code works on every exam. */
  courseIds: string[];
}

const REASON_LABEL: Record<string, string> = {
  inactive: 'Switched off',
  exhausted: 'Usage limit reached',
  expired: 'Past its expiry date',
};

interface Course { id: string; title: string }

/**
 * A dropdown of exams, any number of which can be ticked.
 *
 * Deliberately not a native `<select multiple>`: adding a second exam there
 * needs a ctrl-click, un-choosing one needs another, and neither works on a
 * touch screen — an admin would reasonably conclude only one exam was possible.
 * A list of checkboxes ticks and unticks with an ordinary click. Each row is a
 * `<label>` wrapping its input, so the whole row is the hit target and the state
 * is announced rather than inferred from a highlight colour.
 */
function ExamPicker({
  id, courses, selected, onChange, fieldClass,
}: {
  id: string;
  courses: Course[];
  selected: string[];
  onChange: (next: string[]) => void;
  fieldClass: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // The panel is absolutely positioned and covers the fields beneath it, so it
  // needs a way out that is not "tick something". Both an outside click and
  // Escape close it; the listeners exist only while it is open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = (courseId: string) => {
    onChange(selected.includes(courseId)
      ? selected.filter((x) => x !== courseId)
      : [...selected, courseId]);
  };

  const titleOf = (courseId: string) =>
    courses.find((c) => c.id === courseId)?.title ?? courseId;

  // Naming the single choice is more use than "1 exam selected". Past that the
  // titles do not fit on one line, and the chips below spell them out anyway.
  const summary = selected.length === 0
    ? 'All exams'
    : selected.length === 1
      ? titleOf(selected[0])
      : `${selected.length} exams selected`;

  return (
    <div ref={boxRef} className="relative">
      <button
        id={id} type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open} aria-haspopup="true"
        className={`${fieldClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className={selected.length === 0 ? 'text-slate-500 dark:text-slate-400' : ''}>
          {summary}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#181A1F] shadow-lg p-1">
          {/* Clearing every tick is the same thing as "works on everything", so
              it is offered as a row rather than left as something to deduce. */}
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            All exams
            {selected.length === 0 && <span className="text-amber-500 font-normal"> · current</span>}
          </button>
          <div className="my-1 border-t border-slate-200 dark:border-white/10" />

          {courses.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No exams found.</p>
          ) : courses.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="w-4 h-4 shrink-0 accent-amber-500 cursor-pointer"
              />
              <span>{c.title}</span>
            </label>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((courseId) => (
            <span
              key={courseId}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300"
            >
              {titleOf(courseId)}
              <button
                type="button"
                onClick={() => toggle(courseId)}
                aria-label={`Remove ${titleOf(courseId)}`}
                className="p-0.5 rounded hover:bg-amber-500/25 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [description, setDescription] = useState('');
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const call = useCallback(async (method: string, body?: any) => {
    if (!auth.currentUser) throw new Error('Not signed in.');
    const token = await auth.currentUser.getIdToken();
    const res = await fetch('/api/admin/coupons', {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCoupons((await call('GET')).coupons);
    } catch (err: any) {
      toast.error(err.message, { duration: 8000 });
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => { load(); }, [load]);

  // The exam list for the restriction dropdown. Read directly: the catalogue is
  // public, so this needs no privileged call.
  useEffect(() => {
    getDocs(collection(db, 'courses'))
      .then((snap) => setCourses(snap.docs
        .map((d) => ({ id: d.id, title: (d.data() as any).title ?? d.id }))
        .sort((a, b) => a.title.localeCompare(b.title))))
      .catch(() => setCourses([]));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await call('POST', {
        code,
        discountPercent: Number(discount),
        maxUses: maxUses === '' ? null : Number(maxUses),
        expiresAt: expiresAt || null,
        description,
        courseIds,
      });
      toast.success(`${code.toUpperCase()} created — ${discount}% off.`);
      setCode(''); setDiscount(''); setMaxUses(''); setExpiresAt(''); setDescription(''); setCourseIds([]);
      await load();
    } catch (err: any) {
      toast.error(err.message, { duration: 9000 });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Coupon) => {
    // Switching a code off is instant and reversible; a candidate mid-checkout
    // is simply told it is not valid, and nothing already paid is affected.
    try {
      await call('PATCH', { code: c.code, isActive: !c.isActive });
      toast.success(`${c.code} ${c.isActive ? 'switched off' : 'switched on'}.`);
      await load();
    } catch (err: any) {
      toast.error(err.message, { duration: 9000 });
    }
  };

  const field = 'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#181A1F] text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/40';
  const label = 'block text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] mb-1.5';

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Ticket}
        title="Discount Codes"
        subtitle="Create a code, set what it takes off, and switch it off when you are done with it."
      />

      <Card>
        <SectionTitle hint="The code is what a candidate types at checkout. It is not case-sensitive.">
          New code
        </SectionTitle>

        <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div>
            <label className={label} htmlFor="code">Code</label>
            <input
              id="code" value={code} required
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="DIWALI20"
              className={`${field} font-mono tracking-wider`}
            />
          </div>
          <div>
            <label className={label} htmlFor="discount">Discount %</label>
            <input
              id="discount" type="number" min={1} max={100} required
              value={discount} onChange={(e) => setDiscount(e.target.value)}
              placeholder="20" className={field}
            />
          </div>
          <div>
            <label className={label} htmlFor="maxUses">Usage limit</label>
            <input
              id="maxUses" type="number" min={1}
              value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Leave blank for unlimited" className={field}
            />
          </div>
          <div>
            <label className={label} htmlFor="expiresAt">Expires</label>
            <input
              id="expiresAt" type="date"
              value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              className={field}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={label} htmlFor="courseIds">Valid for</label>
            <ExamPicker
              id="courseIds" courses={courses}
              selected={courseIds} onChange={setCourseIds}
              fieldClass={field}
            />
            <p className="mt-1.5 text-xs text-[#475569] dark:text-[#94A3B8]">
              Tick every exam the code should work on. Leave them all unticked for the whole catalogue.
            </p>
          </div>

          <div className="sm:col-span-2 lg:col-span-2">
            <label className={label} htmlFor="description">Note to yourself (optional)</label>
            <input
              id="description" value={description} maxLength={140}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Diwali campaign, Instagram" className={field}
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit" disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Creating…' : 'Create code'}
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-[#475569] dark:text-[#94A3B8]">
          A 100% code gives the course away free and skips the payment step entirely. That is
          occasionally what you want — for a reviewer or a giveaway — but set a usage limit on it.
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle hint="A code counts a use only when a payment actually completes.">
            All codes
          </SectionTitle>
          <button
            onClick={load} disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <Table head={<>
          <Th>Code</Th>
          <Th>Discount</Th>
          <Th>Valid for</Th>
          <Th>Used</Th>
          <Th>Expires</Th>
          <Th>Status</Th>
          <Th />
        </>}>
          {loading ? (
            <EmptyRow colSpan={7}>Loading…</EmptyRow>
          ) : coupons.length === 0 ? (
            <EmptyRow colSpan={7}>No discount codes yet.</EmptyRow>
          ) : coupons.map((c) => (
            <Row key={c.code}>
              <Td>
                <div className="font-mono font-bold tracking-wider text-slate-900 dark:text-white">{c.code}</div>
                {c.description && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">{c.description}</div>
                )}
              </Td>
              <Td className="tabular-nums font-semibold">{c.discountPercent}% off</Td>
              <Td>
                {c.courseIds.length === 0
                  ? <span className="text-slate-500 dark:text-slate-400">All exams</span>
                  : (
                    <div className="flex flex-wrap gap-1 max-w-[16rem]">
                      {c.courseIds.map((courseId) => (
                        <span
                          key={courseId}
                          className="inline-block px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200"
                        >
                          {courses.find((x) => x.id === courseId)?.title ?? courseId}
                        </span>
                      ))}
                    </div>
                  )}
              </Td>
              <Td className="tabular-nums">
                {c.usedCount}{c.maxUses ? ` of ${c.maxUses}` : ' · unlimited'}
              </Td>
              <Td className="whitespace-nowrap">
                {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'No expiry'}
              </Td>
              <Td>
                {c.usable ? (
                  <Badge tone="success">Working</Badge>
                ) : (
                  <Badge tone="warn">
                    {REASON_LABEL[c.unusableReason ?? ''] ?? 'Not usable'}
                  </Badge>
                )}
              </Td>
              <Td>
                <button
                  onClick={() => toggle(c)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white transition-colors whitespace-nowrap"
                >
                  {c.isActive ? 'Switch off' : 'Switch on'}
                </button>
              </Td>
            </Row>
          ))}
        </Table>
      </Card>
    </div>
  );
}
