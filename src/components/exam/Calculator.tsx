'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, GripHorizontal } from 'lucide-react';

/**
 * On-screen calculator for the exam runner.
 *
 * NISM provides a basic four-function calculator in the real test, so a mock
 * without one is harder than the exam it simulates — candidates on the
 * derivatives and research-analyst papers need it for the numericals.
 *
 * Deliberately basic: four functions, percent, sign flip. No memory or
 * scientific functions, because giving candidates a tool the real exam does not
 * have trains the wrong habit.
 *
 * Two things it must not do, both of which come from living inside a
 * proctored exam screen:
 *  - it must not let keystrokes reach the anti-cheat handler, which blocks
 *    Ctrl+C and friends and would otherwise fire while someone types digits
 *  - it must not steal focus or trigger a fullscreen-exit strike
 */

type Op = '+' | '-' | '*' | '/' | null;

export function Calculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState('0');
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<Op>(null);
  // True once an operator is pressed: the next digit starts a new number
  // rather than appending to the result being shown.
  const [startFresh, setStartFresh] = useState(true);

  // Drag position, so the calculator can be moved off a question it covers.
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const inputDigit = useCallback((d: string) => {
    setDisplay((cur) => {
      if (startFresh) return d === '.' ? '0.' : d;
      if (d === '.' && cur.includes('.')) return cur;
      if (cur === '0' && d !== '.') return d;
      // Cap the length so a long entry cannot overflow the readout.
      return cur.length >= 14 ? cur : cur + d;
    });
    setStartFresh(false);
  }, [startFresh]);

  const compute = useCallback((a: number, b: number, op: Op): number => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      // Division by zero yields Infinity in JS; surfaced as "Error" below
      // rather than shown to a candidate mid-exam as "Infinity".
      case '/': return b === 0 ? NaN : a / b;
      default: return b;
    }
  }, []);

  const applyOp = useCallback((op: Op) => {
    const current = parseFloat(display);
    if (accumulator !== null && pendingOp && !startFresh) {
      const next = compute(accumulator, current, pendingOp);
      setAccumulator(next);
      setDisplay(Number.isFinite(next) ? String(parseFloat(next.toPrecision(12))) : 'Error');
    } else {
      setAccumulator(current);
    }
    setPendingOp(op);
    setStartFresh(true);
  }, [display, accumulator, pendingOp, startFresh, compute]);

  const equals = useCallback(() => {
    if (accumulator === null || !pendingOp) return;
    const next = compute(accumulator, parseFloat(display), pendingOp);
    setDisplay(Number.isFinite(next) ? String(parseFloat(next.toPrecision(12))) : 'Error');
    setAccumulator(null);
    setPendingOp(null);
    setStartFresh(true);
  }, [accumulator, pendingOp, display, compute]);

  const clearAll = useCallback(() => {
    setDisplay('0'); setAccumulator(null); setPendingOp(null); setStartFresh(true);
  }, []);

  // Keyboard support, scoped to this component and stopped from propagating.
  // The exam runner blocks Ctrl+C/X and F12 at the document level; without
  // stopPropagation a candidate typing numbers would collide with it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      const handled =
        /^[0-9.]$/.test(k) || ['+', '-', '*', '/', 'Enter', '=', 'Escape', 'Backspace'].includes(k);
      if (!handled) return;

      e.preventDefault();
      e.stopPropagation();

      if (/^[0-9.]$/.test(k)) inputDigit(k);
      else if (k === 'Escape') clearAll();
      else if (k === 'Enter' || k === '=') equals();
      else if (k === 'Backspace') {
        setDisplay((c) => (c.length <= 1 || c === 'Error' ? '0' : c.slice(0, -1)));
      } else applyOp(k as Op);
    };
    // Capture phase, so this runs before the runner's document-level handler.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [inputDigit, applyOp, equals, clearAll]);

  // Dragging by the header.
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const d = dragRef.current;
      setPos({ x: d.originX + (e.clientX - d.startX), y: d.originY + (e.clientY - d.startY) });
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  const key = (label: string, onClick: () => void, cls = '') => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      // Keeps focus on the calculator body rather than moving it into the exam,
      // and avoids a focus change the anti-cheat watcher could misread.
      onMouseDown={(e) => e.preventDefault()}
      className={`h-11 rounded-lg font-bold text-sm transition-colors active:scale-95 ${
        cls || 'bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-[#272B33] dark:hover:bg-[#343942] dark:text-white'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      className="fixed bottom-24 right-6 z-40 w-64 rounded-2xl bg-white dark:bg-[#181A1F] border border-slate-200 dark:border-white/10 shadow-2xl select-none"
    >
      <div
        onMouseDown={(e) => {
          dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y };
        }}
        className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-white/10 cursor-move"
      >
        <div className="flex items-center gap-1.5 text-slate-400">
          <GripHorizontal className="w-4 h-4" />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Calculator</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close calculator"
          className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 pt-3">
        <div
          className="h-12 rounded-lg bg-slate-50 dark:bg-[#0B0C10] border border-slate-200 dark:border-white/10 flex items-center justify-end px-3 text-2xl font-bold tabular-nums text-slate-900 dark:text-white overflow-hidden"
          aria-live="polite"
        >
          {display}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 p-3">
        {key('C', clearAll, 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400')}
        {key('±', () => setDisplay((c) => (c === '0' || c === 'Error' ? c : String(parseFloat(c) * -1))))}
        {key('%', () => { setDisplay((c) => String(parseFloat(c) / 100)); setStartFresh(true); })}
        {key('÷', () => applyOp('/'), 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400')}

        {['7', '8', '9'].map((d) => key(d, () => inputDigit(d)))}
        {key('×', () => applyOp('*'), 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400')}

        {['4', '5', '6'].map((d) => key(d, () => inputDigit(d)))}
        {key('−', () => applyOp('-'), 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400')}

        {['1', '2', '3'].map((d) => key(d, () => inputDigit(d)))}
        {key('+', () => applyOp('+'), 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400')}

        <button
          type="button"
          onClick={() => inputDigit('0')}
          onMouseDown={(e) => e.preventDefault()}
          className="col-span-2 h-11 rounded-lg font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-[#272B33] dark:hover:bg-[#343942] dark:text-white transition-colors active:scale-95"
        >
          0
        </button>
        {key('.', () => inputDigit('.'))}
        {key('=', equals, 'bg-amber-500 hover:bg-amber-400 text-slate-900')}
      </div>
    </div>
  );
}
