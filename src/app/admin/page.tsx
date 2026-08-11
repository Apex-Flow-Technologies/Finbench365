'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  Users, IndianRupee, BookOpen, AlertTriangle, Clock, Gift,
  TrendingUp, FileText, ArrowRight, CheckCircle2,
} from 'lucide-react';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useAdminOrders } from '@/hooks/useAdminOrders';
import { useAdminContent } from '@/hooks/useAdminContent';
import { summariseRevenue, formatInr, toMillis } from '@/lib/admin/revenue';
import {
  PageHeader, Card, SectionTitle, StatCard, Badge, ErrorNotice,
} from '@/components/admin/primitives';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRY_WARNING_DAYS = 7;
const STUCK_ORDER_MINUTES = 15;

export default function AdminOverviewPage() {
  const { users, loading: usersLoading, error: usersError } = useAdminUsers();
  const { orders, loading: ordersLoading, error: ordersError } = useAdminOrders();
  const { content, loading: contentLoading, error: contentError } = useAdminContent();

  const revenue = useMemo(() => summariseRevenue(orders), [orders]);

  const people = useMemo(() => {
    const weekAgo = Date.now() - 7 * DAY_MS;
    return {
      total: users.length,
      newThisWeek: users.filter((u) => u.createdAt && u.createdAt.getTime() >= weekAgo).length,
      withActiveAccess: users.filter((u) => u.activeCount > 0).length,
      suspended: users.filter((u) => u.suspended).length,
      expiringSoon: users
        .filter((u) => u.entitlements.some((e) => e.isActive && e.daysLeft <= EXPIRY_WARNING_DAYS))
        .sort((a, b) => a.daysLeft - b.daysLeft),
    };
  }, [users]);

  // A single list of things that are actually wrong, rather than leaving the
  // operator to infer problems by comparing numbers across pages.
  const attention = useMemo(() => {
    const items: { label: string; detail: string; href?: string; tone: 'warn' | 'danger' }[] = [];
    const cutoff = Date.now() - STUCK_ORDER_MINUTES * 60 * 1000;

    const stuck = orders.filter(
      (o) => o.status === 'created' && toMillis(o.createdAt) && toMillis(o.createdAt) < cutoff,
    );
    if (stuck.length) {
      items.push({
        label: `${stuck.length} unresolved payment${stuck.length === 1 ? '' : 's'}`,
        detail: 'Started but never completed. Run the reconcile sweep to settle them against the gateway.',
        href: '/admin/orders',
        tone: 'warn',
      });
    }

    if (revenue.unknownAmountCount) {
      items.push({
        label: `${revenue.unknownAmountCount} order${revenue.unknownAmountCount === 1 ? '' : 's'} with an unverifiable amount`,
        detail: 'The gateway has no captured payment for these — usually orders created under different API keys. They are excluded from revenue.',
        href: '/admin/orders',
        tone: 'warn',
      });
    }

    const incomplete = users.filter((u) => u.incomplete);
    if (incomplete.length) {
      items.push({
        label: `${incomplete.length} incomplete user record${incomplete.length === 1 ? '' : 's'}`,
        detail: 'Missing email, role or signup date. These can drop out of reports.',
        href: '/admin/users',
        tone: 'warn',
      });
    }

    if (people.expiringSoon.length) {
      items.push({
        label: `${people.expiringSoon.length} student${people.expiringSoon.length === 1 ? '' : 's'} expiring within ${EXPIRY_WARNING_DAYS} days`,
        detail: 'A renewal opportunity while they are still active.',
        href: '/admin/users',
        tone: 'warn',
      });
    }

    const noTests = content?.courses.filter((c) => c.publishedWithoutTests) ?? [];
    if (noTests.length) {
      items.push({
        label: `${noTests.length} published course${noTests.length === 1 ? '' : 's'} with no live test`,
        detail: `Purchasable but empty: ${noTests.map((c) => c.title).join(', ')}.`,
        tone: 'danger',
      });
    }

    if (content?.orphanedTests.length) {
      items.push({
        label: `${content.orphanedTests.length} test${content.orphanedTests.length === 1 ? '' : 's'} not linked to a live course`,
        detail: 'Access is resolved through the owning course, so these cannot be opened by anyone if published.',
        tone: 'danger',
      });
    }

    return items;
  }, [orders, users, content, people.expiringSoon, revenue.unknownAmountCount]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        subtitle="Money, people and content at a glance."
        icon={TrendingUp}
      />

      {/* Every loader reports its own failure. Only the users error was shown
          before, so a denied read of `orders` (or of the catalogue) left this
          page rendering a confident ₹0 / 0 students / 0 courses with nothing to
          explain it — the reported "admin dashboard shows no activity". An empty
          panel and a broken panel must not look the same. */}
      {usersError && <ErrorNotice message={`Could not load students: ${usersError}`} />}
      {ordersError && <ErrorNotice message={`Could not load orders — every money figure below is incomplete: ${ordersError}`} />}
      {contentError && <ErrorNotice message={`Could not load courses and tests: ${contentError}`} />}

      {/* ------------------------------------------------------------ money */}
      <section>
        <SectionTitle hint="from the order ledger">Money</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Collected"
            value={formatInr(revenue.collected, { decimals: true })}
            sub={`${revenue.paidCount} paid order${revenue.paidCount === 1 ? '' : 's'} · incl. GST`}
            icon={IndianRupee}
            tone="money"
            loading={ordersLoading}
          />
          <StatCard
            label="GST payable"
            value={formatInr(revenue.gstPayable, { decimals: true })}
            sub="Collected on your behalf — must be remitted"
            icon={FileText}
            tone="warn"
            loading={ordersLoading}
          />
          <StatCard
            label="Net after fees"
            value={formatInr(revenue.netAfterFees, { decimals: true })}
            // Says which it is rather than hedging permanently. Once every paid
            // order has its real fee from Razorpay there is nothing indicative
            // left, and calling it an estimate then would undersell the figure.
            sub={revenue.estimatedFeeCount > 0
              ? `Estimated on ${revenue.estimatedFeeCount} order${revenue.estimatedFeeCount === 1 ? '' : 's'} — run Sync Fees`
              : `After ${formatInr(revenue.gatewayFees, { decimals: true })} in gateway fees`}
            icon={TrendingUp}
            tone="neutral"
            loading={ordersLoading}
          />
          <StatCard
            label="Comped"
            value={revenue.compedCount}
            sub={revenue.refunded > 0
              ? `${formatInr(revenue.refunded, { decimals: true })} refunded`
              : 'Free enrolments — not counted as revenue'}
            icon={Gift}
            tone="neutral"
            loading={ordersLoading}
          />
        </div>
      </section>

      {/* ----------------------------------------------------------- people */}
      <section>
        <SectionTitle>People</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Students" value={people.total} icon={Users} tone="people" loading={usersLoading} />
          <StatCard label="New this week" value={people.newThisWeek} icon={TrendingUp} tone="people" loading={usersLoading} />
          <StatCard label="With active access" value={people.withActiveAccess} icon={CheckCircle2} tone="money" loading={usersLoading} />
          <StatCard
            label="Expiring soon"
            value={people.expiringSoon.length}
            sub={`within ${EXPIRY_WARNING_DAYS} days`}
            icon={Clock}
            tone="warn"
            loading={usersLoading}
          />
        </div>
      </section>

      {/* ---------------------------------------------------------- content */}
      <section>
        <SectionTitle>Content</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Live courses"
            value={content?.publishedCourses ?? 0}
            sub={`${content?.draftCourses ?? 0} in draft`}
            icon={BookOpen}
            tone="people"
            loading={contentLoading}
          />
          <StatCard
            label="Live tests"
            value={content?.publishedTests ?? 0}
            sub={`of ${content?.totalTests ?? 0} total`}
            icon={FileText}
            tone="neutral"
            loading={contentLoading}
          />
          <StatCard
            label="Study notes"
            value={content?.totalMaterials ?? 0}
            icon={BookOpen}
            tone="neutral"
            loading={contentLoading}
          />
          <StatCard
            label="Needs attention"
            value={attention.length}
            sub={attention.length === 0 ? 'Everything looks healthy' : 'See the list below'}
            icon={AlertTriangle}
            tone={attention.length ? 'warn' : 'neutral'}
            loading={contentLoading || ordersLoading || usersLoading}
          />
        </div>
      </section>

      {/* -------------------------------------------------- needs attention */}
      {attention.length > 0 && (
        <section>
          <SectionTitle>Needs attention</SectionTitle>
          <div className="space-y-3">
            {attention.map((item) => (
              <Card key={item.label} className="flex items-start gap-3.5">
                <AlertTriangle
                  className={`w-5 h-5 shrink-0 mt-0.5 ${item.tone === 'danger' ? 'text-rose-500' : 'text-amber-500'}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">{item.label}</div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{item.detail}</p>
                </div>
                {item.href && (
                  <Link
                    href={item.href}
                    className="shrink-0 text-xs font-bold text-amber-600 dark:text-amber-500 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    View <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------- expiring soon */}
      {people.expiringSoon.length > 0 && (
        <section>
          <SectionTitle hint="renewal opportunities">Expiring within {EXPIRY_WARNING_DAYS} days</SectionTitle>
          <Card padded={false}>
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {people.expiringSoon.slice(0, 8).map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {u.name || u.email || u.id}
                    </div>
                    {u.name && u.email && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}</div>
                    )}
                  </div>
                  <Badge tone={u.daysLeft <= 2 ? 'danger' : 'warn'}>
                    {u.daysLeft <= 0 ? 'expires today' : `${u.daysLeft} day${u.daysLeft === 1 ? '' : 's'} left`}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* -------------------------------------------------- recent students */}
      <section>
        <SectionTitle hint={`${users.length} total`}>Recent signups</SectionTitle>
        <Card padded={false}>
          {usersLoading ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              No students have registered yet.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {users.slice(0, 8).map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {u.name || <span className="italic text-slate-400">no name</span>}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email || u.id}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {u.suspended && <Badge tone="danger">suspended</Badge>}
                    {u.role !== 'student' && <Badge tone="info">{u.role}</Badge>}
                    <Badge tone={u.activeCount > 0 ? 'success' : 'neutral'}>
                      {u.activeCount > 0 ? `${u.activeCount} active` : 'no courses'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
