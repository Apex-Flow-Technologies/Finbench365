'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/config';
import {
  PageHeader, Table, Th, Td, Row, EmptyRow, LoadingRow, Badge,
  Dialog, DialogActions, Button, ErrorNotice, Card,
} from '@/components/admin/primitives';
import { Ticket, Plus, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Coupon {
  code: string;
  discountPercent: number;
  isActive: boolean;
  usedCount: number;
  maxUses: number | null;
  expiresAt: number | null;
  description: string;
  usable: boolean;
  exhausted: boolean;
  expired: boolean;
}

/**
 * Discount code management.
 *
 * Coupons are default-denied to clients in firestore.rules, so everything here
 * goes through /api/admin/coupons. Previously they could only be created or
 * disabled by running a script by hand.
 */
export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [working, setWorking] = useState(false);

  const [form, setForm] = useState({ code: '', discountPercent: '', maxUses: '', expiresAt: '', description: '' });

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    if (!auth.currentUser) throw new Error('Not signed in');
    const token = await auth.currentUser.getIdToken();
    return fetch(input, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch('/api/admin/coupons');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load coupons');
      setCoupons(data.coupons);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setWorking(true);
    try {
      const res = await authedFetch('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code,
          discountPercent: Number(form.discountPercent),
          maxUses: form.maxUses === '' ? null : Number(form.maxUses),
          expiresAt: form.expiresAt || null,
          description: form.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create coupon');
      toast.success(`Coupon ${data.code} created.`);
      setShowCreate(false);
      setForm({ code: '', discountPercent: '', maxUses: '', expiresAt: '', description: '' });
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  const toggleActive = async (c: Coupon) => {
    try {
      const res = await authedFetch('/api/admin/coupons', {
        method: 'PATCH',
        body: JSON.stringify({ code: c.code, isActive: !c.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update coupon');
      toast.success(`${c.code} ${c.isActive ? 'disabled' : 'enabled'}.`);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const liveFullDiscount = coupons.filter((c) => c.usable && c.discountPercent >= 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons"
        subtitle="Discount codes accepted at checkout."
        icon={Ticket}
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <span className="flex items-center gap-2"><Plus className="w-4 h-4" /> New coupon</span>
          </Button>
        }
      />

      {error && <ErrorNotice message={error} />}

      {/* A live 100%-off code is the single most costly thing that can be left
          switched on, so it is called out rather than blending into the table. */}
      {liveFullDiscount.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-slate-900 dark:text-white">
                {liveFullDiscount.length === 1 ? 'A 100% discount code is live' : `${liveFullDiscount.length} full-discount codes are live`}
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {liveFullDiscount.map((c) => c.code).join(', ')} — anyone with the code gets free access.
                Disable them once testing is finished.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Table
        head={<>
          <Th>Code</Th><Th>Discount</Th><Th>Used</Th><Th>Expires</Th>
          <Th className="text-right">Status</Th><Th className="text-right">Action</Th>
        </>}
      >
        {loading ? (
          <LoadingRow colSpan={6} />
        ) : coupons.length === 0 ? (
          <EmptyRow colSpan={6}>No discount codes yet.</EmptyRow>
        ) : (
          coupons.map((c) => (
            <Row key={c.code}>
              <Td>
                <div className="font-mono font-bold text-slate-900 dark:text-white">{c.code}</div>
                {c.description && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.description}</div>
                )}
              </Td>
              <Td className="tabular-nums font-medium">{c.discountPercent}%</Td>
              <Td className="tabular-nums">
                {c.usedCount}{c.maxUses !== null ? ` / ${c.maxUses}` : ''}
                {c.maxUses !== null && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {Math.max(0, c.maxUses - c.usedCount)} left
                  </div>
                )}
              </Td>
              <Td className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                {c.expiresAt
                  ? new Date(c.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                  : 'never'}
              </Td>
              <Td className="text-right">
                {c.usable ? <Badge tone="success">Usable</Badge>
                  : c.expired ? <Badge tone="neutral">Expired</Badge>
                  : c.exhausted ? <Badge tone="neutral">Used up</Badge>
                  : <Badge tone="danger">Disabled</Badge>}
              </Td>
              <Td className="text-right">
                <button
                  onClick={() => toggleActive(c)}
                  className="text-xs font-bold text-amber-600 dark:text-amber-500 hover:underline"
                >
                  {c.isActive ? 'Disable' : 'Enable'}
                </button>
              </Td>
            </Row>
          ))
        )}
      </Table>

      <Dialog
        open={showCreate}
        title="Create a discount code"
        description="The code is what students type at checkout. It becomes usable immediately."
        onClose={() => !working && setShowCreate(false)}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
          <Field label="Code" hint="A–Z, 0–9, hyphen or underscore">
            <input
              autoFocus
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="LAUNCH25"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount %" hint="1–100">
              <input
                type="number" min={1} max={100}
                value={form.discountPercent}
                onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                placeholder="25"
                className={inputCls}
              />
            </Field>
            <Field label="Usage limit" hint="blank = unlimited">
              <input
                type="number" min={1}
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                placeholder="100"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Expires" hint="blank = never">
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Note" hint="for your reference only">
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Launch promotion"
              className={inputCls}
            />
          </Field>

          <DialogActions>
            <Button type="submit" disabled={working || !form.code || !form.discountPercent}>
              {working ? 'Creating…' : 'Create coupon'}
            </Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={working}>
              Cancel
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}

const inputCls =
  'mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#121419] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500 transition-colors';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
        {hint && <span className="text-slate-400 dark:text-slate-500 font-normal"> · {hint}</span>}
      </span>
      {children}
    </label>
  );
}
