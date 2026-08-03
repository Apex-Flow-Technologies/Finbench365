'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, type LucideIcon } from 'lucide-react';

/**
 * Shared admin building blocks.
 *
 * Every admin screen previously hand-rolled its own cards, tables and badges,
 * so no two looked alike and a fix had to be repeated per page. All of these
 * style both themes via `dark:` variants so the existing theme toggle works.
 */

/* ------------------------------------------------------------------ layout */

export function PageHeader({
  title, subtitle, icon: Icon, actions,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
          {Icon && <Icon className="w-6 h-6 text-amber-500" />}
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Card({
  children, className = '', padded = true,
}: {
  children: React.ReactNode; className?: string; padded?: boolean;
}) {
  return (
    <div
      className={`bg-white dark:bg-[#121419] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none transition-colors ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {children}
      </h2>
      {hint && <span className="text-xs text-slate-400 dark:text-slate-500">{hint}</span>}
    </div>
  );
}

/* -------------------------------------------------------------------- stats */

export function StatCard({
  label, value, sub, icon: Icon, tone = 'neutral', loading = false, title,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  tone?: 'neutral' | 'money' | 'people' | 'warn';
  loading?: boolean;
  title?: string;
}) {
  const tones = {
    neutral: 'text-slate-500 bg-slate-500/10',
    money: 'text-emerald-500 bg-emerald-500/10',
    people: 'text-blue-500 bg-blue-500/10',
    warn: 'text-amber-500 bg-amber-500/10',
  } as const;

  return (
    <Card className="flex items-start gap-4">
      {Icon && (
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </div>
        {loading ? (
          <div className="h-7 w-24 mt-1.5 rounded bg-slate-200 dark:bg-white/10 animate-pulse" />
        ) : (
          <div
            className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums truncate"
            title={title}
          >
            {value}
          </div>
        )}
        {sub && !loading && (
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ badges */

export function Badge({
  children, tone = 'neutral', icon: Icon,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'info';
  icon?: LucideIcon;
}) {
  const tones = {
    neutral: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  } as const;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${tones[tone]}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------- table */

export function Table({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card padded={false} className="overflow-hidden">
      {/* Wide tables scroll inside their own container so the page body never
          scrolls horizontally on small screens. */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
            <tr>{head}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">{children}</tbody>
        </table>
      </div>
    </Card>
  );
}

export function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`py-3 px-5 text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`py-3.5 px-5 text-sm text-slate-700 dark:text-slate-300 ${className}`}>{children}</td>;
}

export function Row({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={`transition-colors ${onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5' : ''}`}
    >
      {children}
    </tr>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
        {children}
      </td>
    </tr>
  );
}

export function LoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12">
        <div className="flex items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <span className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          Loading…
        </div>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ notices */

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ dialog */

/**
 * Replaces the browser's native confirm()/prompt(), which render as a jarring
 * "myexams365.com says…" chrome dialog and cannot be styled or themed.
 */
export function Dialog({
  open, title, description, children, onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  // Escape to dismiss, and keep Tab inside the dialog. Without either, the
  // dialog was a styled div: keyboard users could tab into the page behind it
  // and screen readers never announced that anything had opened.
  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#181A1F] border border-slate-200 dark:border-white/10 p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        <h3 id={titleId} className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        {description && (
          <p id={descId} className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{description}</p>
        )}
        <div className="mt-5">{children}</div>
      </motion.div>
    </div>
  );
}

export function DialogActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col-reverse sm:flex-row gap-2.5 mt-6">{children}</div>;
}

export function Button({
  children, onClick, variant = 'primary', type = 'button', disabled, className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary: 'bg-amber-500 hover:bg-amber-400 text-[#111B35] shadow-sm',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white',
    danger: 'bg-rose-500 hover:bg-rose-400 text-white shadow-sm',
  } as const;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
