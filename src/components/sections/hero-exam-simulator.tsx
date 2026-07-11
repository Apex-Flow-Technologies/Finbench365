'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useAnimate } from 'framer-motion';
import { CheckCircle2, Clock } from 'lucide-react';

export function HeroExamSimulator() {
  const [scope, animate] = useAnimate();
  const [activeStep, setActiveStep] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'selecting' | 'verified'>('idle');
  const [timerSeconds, setTimerSeconds] = useState(6135); // 01:42:15
  const [completedCells, setCompletedCells] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [progressPercent, setProgressPercent] = useState(48);

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 7200));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Single-Element Imperative 3D Sequence Engine (Guarantees zero snap)
  useEffect(() => {
    let isCancelled = false;

    const runSequence = async () => {
      if (!scope.current) return;

      // Phase 1: 360 Entrance Spin smoothly arriving at exact (-11, 8, -1.5, y:0)
      await animate(
        scope.current,
        {
          opacity: [0, 1],
          scale: [0.85, 1],
          rotateY: [-371, -11],
          rotateX: [8, 8],
          rotateZ: [-1.5, -1.5],
          y: [0, 0],
        },
        { duration: 2.2, ease: [0.22, 1, 0.36, 1] }
      );

      if (isCancelled || !scope.current) return;

      // Phase 2: Seamlessly begin continuous 3D floating animation from exact arrival coordinates
      animate(
        scope.current,
        {
          y: [0, -12, 0],
          rotateY: [-11, -13.5, -11],
          rotateX: [8, 6, 8],
          rotateZ: [-1.5, -2, -1.5],
        },
        {
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }
      );
    };

    runSequence();

    return () => {
      isCancelled = true;
    };
  }, [animate, scope]);

  // Ambient natural looping state machine
  useEffect(() => {
    const cycle = () => {
      setPhase('idle');

      const selectTimeout = setTimeout(() => {
        setPhase('selecting');
      }, 1600);

      const verifyTimeout = setTimeout(() => {
        setPhase('verified');
        const nextCell = 8 + (activeStep % 7);
        setCompletedCells((prev) => (prev.includes(nextCell) ? prev : [...prev, nextCell]));
        setProgressPercent((prev) => (prev >= 92 ? 48 : prev + 6));
      }, 2800);

      const nextTimeout = setTimeout(() => {
        setActiveStep((prev) => (prev + 1) % 6);
      }, 5400);

      return () => {
        clearTimeout(selectTimeout);
        clearTimeout(verifyTimeout);
        clearTimeout(nextTimeout);
      };
    };

    const cleanup = cycle();
    return cleanup;
  }, [activeStep]);

  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine active option target based on activeStep
  const targetOptionIdx = activeStep % 4; // cycles 0, 1, 2, 3

  return (
    <div className="relative w-full max-w-xl mx-auto lg:max-w-none flex items-center justify-end overflow-visible py-1 perspective-1200 select-none pointer-events-none">
      {/* 
        Single-Element Imperative 3D Sheet
        Phase 1 (Entrance Spin) -> Phase 2 (Idle Float) seamlessly managed via useAnimate()
      */}
      <motion.div
        ref={scope}
        style={{
          transformStyle: 'preserve-3d',
        }}
        className="relative w-full max-w-[520px] bg-[#12141A] border border-[#262A35] rounded-2xl shadow-[0_36px_110px_-16px_rgba(0,0,0,0.88)] ring-1 ring-white/[0.04] overflow-hidden text-slate-300 transform-gpu lg:translate-x-4 lg:-translate-y-8"
      >
        {/* Soft Ambient Top Glow line on the card edge */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-slate-500/30 to-transparent" />

        {/* Top Minimal Monochrome Header */}
        <div className="bg-[#161821]/90 border-b border-[#232732] px-5 py-3.5 flex items-center justify-between gap-3 font-mono text-[11px]">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
            <span className="text-slate-400 font-semibold tracking-wider uppercase">CBT_TERMINAL_v4.8</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1A1D27] border border-[#2B303E] text-slate-300 font-medium tracking-wide">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{formatTime(timerSeconds)}</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-800/60 text-slate-400 text-[10px]">
              {progressPercent}%
            </span>
          </div>
        </div>

        {/* Question Palette Matrix (Minimal completion squares) */}
        <div className="bg-[#15171F] border-b border-[#222630] px-5 py-3 flex items-center gap-2 overflow-x-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => {
            const isDone = completedCells.includes(num);
            const isCurrent = num === 8 + (activeStep % 7);

            return (
              <motion.div
                key={num}
                animate={{
                  scale: isCurrent ? [1, 1.08, 1] : 1,
                }}
                transition={{ duration: 2, repeat: isCurrent ? Infinity : 0 }}
                className={`w-6 h-6 rounded sm:rounded-md flex items-center justify-center font-mono text-[10px] font-bold transition-colors duration-300 flex-shrink-0 ${
                  isDone && !isCurrent
                    ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-400'
                    : isCurrent
                    ? 'bg-[#272C3A] border border-slate-400 text-slate-100 shadow-[0_0_10px_rgba(255,255,255,0.08)]'
                    : 'bg-[#181A23] border border-[#232733] text-slate-600'
                }`}
              >
                {isDone && !isCurrent ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 stroke-[2.5]" />
                ) : (
                  num.toString().padStart(2, '0')
                )}
              </motion.div>
            );
          })}
          <span className="text-slate-600 text-[10px] font-mono ml-auto pl-2 hidden sm:inline">
            SECTION II
          </span>
        </div>

        {/* Main Card Content (Visual Storytelling & Placeholders) */}
        <div className="p-6 sm:p-7 space-y-6">
          {/* Question Sequence Label Indicator */}
          <div className="flex items-center justify-between font-mono text-xs text-slate-500">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-ping" />
              <span className="font-semibold text-slate-400 tracking-wide">
                QUESTION {(8 + (activeStep % 7)).toString().padStart(2, '0')} OF 100
              </span>
            </span>
            <span className="text-slate-600">────────────────</span>
          </div>

          {/* Placeholder Question Block (Abstract monochrome bars) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`q-block-${activeStep}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
              className="space-y-3 pt-1 pb-2"
            >
              <div className="w-11/12 h-3.5 rounded bg-slate-700/70" />
              <div className="w-4/5 h-3.5 rounded bg-slate-800/90" />
              <div className="w-3/5 h-3.5 rounded bg-slate-800/60" />
            </motion.div>
          </AnimatePresence>

          {/* Option Placeholders (A, B, C, D) */}
          <div className="space-y-3 pt-1">
            {['A', 'B', 'C', 'D'].map((optLabel, idx) => {
              const isTarget = idx === targetOptionIdx;
              const isSelecting = isTarget && phase === 'selecting';
              const isVerified = isTarget && phase === 'verified';

              // Placeholder bar widths for abstract variation
              const barWidths = ['w-3/4', 'w-2/3', 'w-5/6', 'w-1/2'];

              return (
                <motion.div
                  key={optLabel}
                  animate={{
                    borderColor: isVerified
                      ? 'rgba(16, 185, 129, 0.45)'
                      : isSelecting
                      ? 'rgba(148, 163, 184, 0.4)'
                      : 'rgba(38, 42, 53, 1)',
                    backgroundColor: isVerified
                      ? 'rgba(6, 78, 59, 0.22)'
                      : isSelecting
                      ? 'rgba(30, 35, 48, 0.9)'
                      : 'rgba(21, 23, 31, 0.7)',
                    scale: isSelecting ? 1.01 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                  className="p-3.5 sm:p-4 rounded-xl border flex items-center justify-between gap-4 relative overflow-hidden"
                >
                  <div className="flex items-center gap-3.5 flex-1">
                    {/* Option Letter Circle */}
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-mono text-[11px] font-bold transition-colors duration-300 ${
                        isVerified
                          ? 'bg-emerald-500 text-[#12141A]'
                          : isSelecting
                          ? 'bg-slate-300 text-[#12141A]'
                          : 'bg-[#1C1F2A] border border-[#2B303E] text-slate-400'
                      }`}
                    >
                      {isVerified ? (
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        optLabel
                      )}
                    </div>

                    {/* Placeholder Bar representing option text */}
                    <div
                      className={`h-2.5 rounded transition-all duration-300 ${barWidths[idx]} ${
                        isVerified
                          ? 'bg-emerald-400/50'
                          : isSelecting
                          ? 'bg-slate-400/60'
                          : 'bg-slate-800/80'
                      }`}
                    />
                  </div>

                  {/* Right Confirmation Tick / Subtle Status */}
                  <div className="flex items-center gap-2">
                    <AnimatePresence>
                      {isVerified && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.25, type: 'spring' }}
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-semibold"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>RECORDED</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Minimal Bottom Progress Bar */}
          <div className="pt-3">
            <div className="flex items-center justify-between font-mono text-[11px] text-slate-500 mb-2">
              <span>PROGRESSION TRACKER</span>
              <span className="text-slate-400 font-semibold">{progressPercent}% COMPLETED</span>
            </div>
            <div className="w-full h-1.5 bg-[#191C26] rounded-full overflow-hidden p-[1px]">
              <motion.div
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-slate-600 via-emerald-500 to-emerald-400 rounded-full"
              />
            </div>
          </div>
        </div>

        {/* Bottom Minimal Decorative Status */}
        <div className="bg-[#15171F] border-t border-[#222630] px-6 py-3 flex items-center justify-between text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-ping" />
            <span>IRT_CALIBRATION_ACTIVE</span>
          </div>
          <span className="text-slate-600 tracking-widest">FINBENCH365 SYSTEM</span>
        </div>
      </motion.div>
    </div>
  );
}
