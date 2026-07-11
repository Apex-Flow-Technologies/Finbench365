'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Target, 
  Award 
} from 'lucide-react';
import { SANDBOX_QUESTIONS } from '@/data/sandbox-questions';

export function InteractiveSandbox() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);

  const filteredQuestions = SANDBOX_QUESTIONS;

  const handleSelectOption = (label: 'A' | 'B' | 'C' | 'D', isCenter: boolean) => {
    if (!isCenter || hasAnswered) return;
    setSelectedOption(label);
    setHasAnswered(true);
  };

  const handleReset = () => {
    setSelectedOption(null);
    setHasAnswered(false);
  };

  const handleNext = () => {
    handleReset();
    setActiveIdx((prev) => (prev + 1) % filteredQuestions.length);
  };

  const handlePrev = () => {
    handleReset();
    setActiveIdx((prev) => (prev - 1 + filteredQuestions.length) % filteredQuestions.length);
  };

  const handleSelectSideCard = (targetIndex: number) => {
    if (targetIndex === activeIdx) return;
    handleReset();
    setActiveIdx(targetIndex);
  };

  return (
    <section id="sandbox" className="py-24 md:py-32 bg-[#FAFAF8] text-[#181A1F] border-b border-[#E4E4E0] relative overflow-hidden">
      {/* Background ambient fine grid lines */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #181A1F 1px, transparent 1px),
            linear-gradient(to bottom, #181A1F 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px'
        }}
      />

      <div className="max-w-[1240px] mx-auto px-6 md:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-200/80 border border-slate-300/80 text-slate-800 font-mono text-xs font-semibold uppercase tracking-wider">
            <Target className="w-3.5 h-3.5 text-amber-700" />
            <span>3D Spiral Interactive Deck</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 leading-[1.16]">
            Experience Institutional Fidelity. <br />
            Test the Diagnostic Sandbox.
          </h2>
          <p className="text-slate-600 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            Spin the spiral carousel from left to right. Click any option on the center viewing card to test real-time formula derivations and Two-Parameter Logistic (2PL) distractor deconstruction.
          </p>
        </div>

        {/* Navigation & Question Indicator Bar */}
        <div className="flex items-center justify-between max-w-[880px] mx-auto mb-8 px-2">
          <button
            onClick={handlePrev}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#D4D4CE] bg-white hover:bg-slate-100 text-slate-800 font-medium text-xs sm:text-sm transition-all shadow-sm cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous Card</span>
          </button>

          <span className="font-mono text-xs font-bold tracking-wider text-slate-500">
            CARD {(activeIdx + 1).toString().padStart(2, '0')} OF {filteredQuestions.length.toString().padStart(2, '0')}
          </span>

          <button
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#181A1F] hover:bg-[#272B33] text-white font-medium text-xs sm:text-sm transition-all shadow-sm cursor-pointer"
          >
            <span>Next Card</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 
          3D Spiral Coverflow Question Carousel
          Only the center card is active, sharp, and interactive.
          Center card uses relative positioning to dynamically size the container and prevent any clipping/overlap.
        */}
        <div className="relative w-full flex items-start justify-center overflow-visible py-4 perspective-1200 min-h-[580px]">
          {filteredQuestions.map((q, idx) => {
            const n = filteredQuestions.length;
            // Calculate minimum circular distance from active index
            let diff = (idx - activeIdx) % n;
            if (diff > Math.floor(n / 2)) diff -= n;
            if (diff < -Math.floor(n / 2)) diff += n;

            // Determine 3D transform targets
            let positionState: 'center' | 'left' | 'right' | 'far-left' | 'far-right' | 'hidden' = 'hidden';
            let xOffset = 0;
            let rotateYAngle = 0;
            let scaleFactor = 0.5;
            let zIndexVal = 0;
            let blurVal = '10px';
            let opacityVal = 0;

            if (diff === 0) {
              positionState = 'center';
              xOffset = 0;
              rotateYAngle = 0;
              scaleFactor = 1;
              zIndexVal = 40;
              blurVal = '0px';
              opacityVal = 1;
            } else if (diff === 1 || (diff === -(n - 1) && n > 2)) {
              positionState = 'right';
              xOffset = 560; // horizontal slide right for wider cards
              rotateYAngle = -15; // tilt away
              scaleFactor = 0.85;
              zIndexVal = 25;
              blurVal = '3.5px';
              opacityVal = 0.52;
            } else if (diff === -1 || (diff === n - 1 && n > 2)) {
              positionState = 'left';
              xOffset = -560; // horizontal slide left for wider cards
              rotateYAngle = 15; // tilt away
              scaleFactor = 0.85;
              zIndexVal = 25;
              blurVal = '3.5px';
              opacityVal = 0.52;
            } else if (diff === 2 && n >= 5) {
              positionState = 'far-right';
              xOffset = 1020;
              rotateYAngle = -25;
              scaleFactor = 0.72;
              zIndexVal = 10;
              blurVal = '6px';
              opacityVal = 0.22;
            } else if (diff === -2 && n >= 5) {
              positionState = 'far-left';
              xOffset = -1020;
              rotateYAngle = 25;
              scaleFactor = 0.72;
              zIndexVal = 10;
              blurVal = '6px';
              opacityVal = 0.22;
            }

            if (positionState === 'hidden') return null;

            const isCenter = positionState === 'center';

            return (
              <motion.div
                key={q.id}
                layout
                onClick={() => !isCenter && handleSelectSideCard(idx)}
                initial={false}
                animate={{
                  x: xOffset,
                  rotateY: rotateYAngle,
                  scale: scaleFactor,
                  opacity: opacityVal,
                  filter: `blur(${blurVal})`,
                  zIndex: zIndexVal,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 240,
                  damping: 26,
                }}
                style={{
                  transformStyle: 'preserve-3d',
                }}
                className={`${
                  isCenter ? 'relative' : 'absolute top-0 left-0 right-0 mx-auto'
                } w-full max-w-[880px] bg-white border rounded-2xl shadow-[0_20px_60px_-16px_rgba(0,0,0,0.12)] overflow-hidden transition-colors ${
                  isCenter
                    ? 'border-[#181A1F] cursor-default'
                    : 'border-[#DDDDCF] cursor-pointer hover:border-slate-500'
                }`}
              >
                {/* Card Header */}
                <div className="bg-[#F4F4F0] border-b border-[#E2E2DE] px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-0.5 rounded bg-[#181A1F] text-white font-mono text-xs font-bold">
                      {q.track}
                    </span>
                    <span className="text-slate-700 font-mono text-xs font-medium">
                      {q.topic}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs font-mono text-slate-500">
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-semibold">
                      {q.difficulty}
                    </span>
                    <span>Est: {q.timeEstimateSeconds}s</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 md:p-6 space-y-5">
                  <div className="text-xs font-mono text-amber-800 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{q.los}</span>
                  </div>

                  <h3 className="text-base md:text-lg font-medium text-slate-900 leading-relaxed">
                    {q.questionText}
                  </h3>

                  {/* Options Grid */}
                  <div className="space-y-2.5">
                    {q.options.map((opt) => {
                      const isSelected = selectedOption === opt.label && isCenter;
                      const isAnswered = hasAnswered && isCenter;
                      const isCorrectOption = opt.isCorrect;

                      let borderClass = 'border-[#E2E2DE] hover:border-slate-400 bg-white';
                      let badgeClass = 'bg-[#F2F2ED] text-slate-700 border border-slate-300';

                      if (isAnswered) {
                        if (isCorrectOption) {
                          borderClass = 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-500';
                          badgeClass = 'bg-emerald-600 text-white border-emerald-600';
                        } else if (isSelected && !isCorrectOption) {
                          borderClass = 'border-amber-700 bg-amber-50/60 ring-1 ring-amber-700/50';
                          badgeClass = 'bg-amber-700 text-white border-amber-700';
                        } else {
                          borderClass = 'border-[#EBEBE7] bg-[#F9F9F7] opacity-60';
                        }
                      }

                      return (
                        <button
                          key={opt.label}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectOption(opt.label, isCenter);
                          }}
                          disabled={!isCenter || hasAnswered}
                          className={`w-full text-left p-3.5 md:p-4 rounded-xl border transition-all duration-200 flex items-start gap-3.5 ${borderClass} ${
                            isCenter && !hasAnswered ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center font-mono text-xs font-bold flex-shrink-0 mt-0.5 transition-colors ${badgeClass}`}>
                            {isAnswered && isCorrectOption ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : isAnswered && isSelected && !isCorrectOption ? (
                              <XCircle className="w-3.5 h-3.5" />
                            ) : (
                              opt.label
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="text-sm md:text-base font-normal text-slate-900 leading-snug">
                              {opt.text}
                            </div>

                            {/* Individual Option Explanation when answered */}
                            <AnimatePresence>
                              {isAnswered && (isCorrectOption || isSelected) && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                  animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
                                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className="overflow-hidden"
                                >
                                  <div className={`p-3 rounded-lg font-sans text-xs md:text-sm leading-relaxed border ${
                                    isCorrectOption 
                                      ? 'bg-emerald-100/60 border-emerald-200 text-emerald-950 font-medium' 
                                      : 'bg-amber-100/60 border-amber-200 text-amber-950 font-normal'
                                  }`}>
                                    <div className="font-bold font-mono tracking-wide uppercase mb-1 flex items-center gap-1.5">
                                      {isCorrectOption ? (
                                        <>
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                          <span>Correct Diagnostic Reasoning</span>
                                        </>
                                      ) : (
                                        <>
                                          <XCircle className="w-3.5 h-3.5 text-amber-800" />
                                          <span>Why this distractor is incorrect</span>
                                        </>
                                      )}
                                    </div>
                                    {opt.explanation}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Master Formula Breakdown Panel (Expands when answered) */}
                  <AnimatePresence>
                    {hasAnswered && q.correctFormulaBreakdown && isCenter && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.35 }}
                        className="p-4 rounded-xl bg-[#181A1F] text-slate-200 font-mono text-xs md:text-sm shadow-md border border-[#313642]"
                      >
                        <div className="flex items-center justify-between text-amber-400 border-b border-slate-800 pb-2.5 mb-2.5 font-semibold uppercase tracking-wider">
                          <span className="flex items-center gap-2">
                            <Award className="w-3.5 h-3.5" />
                            Algorithmic Step-by-Step Derivation
                          </span>
                          <span className="text-xs text-slate-400">Adaptive IRT Engine v2.4</span>
                        </div>
                        <p className="font-sans text-slate-300 leading-relaxed font-normal text-xs md:text-sm">
                          {q.correctFormulaBreakdown}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action Footer inside Center Card */}
                  {isCenter && (
                    <div className="pt-4 border-t border-[#E2E2DE] flex items-center justify-between flex-wrap gap-3">
                      <button
                        onClick={handleReset}
                        disabled={!hasAnswered}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all ${
                          hasAnswered
                            ? 'bg-slate-200 text-slate-800 hover:bg-slate-300 cursor-pointer'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retry Question</span>
                      </button>

                      <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                        <span>Side cards: Click or swipe to spin carousel</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
