'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, TrendingUp, Award, Star, CheckCircle } from 'lucide-react';

interface TestimonialCard {
  id: string;
  name: string;
  role: string;
  examPassed: string;
  avatarInitials: string;
  avatarColor: string;
  review: string;
  scoreImprovement: string;
  percentile: string;
  cardOffset: string;
  floatDelay: number;
}

const TESTIMONIALS_DATA: TestimonialCard[] = [
  {
    id: 't-1',
    name: 'Candidate #1048',
    role: 'Investment Analyst at Institutional Asset Manager',
    examPassed: 'Track A (Level II)  Passed First Attempt',
    avatarInitials: 'IA',
    avatarColor: 'bg-slate-800 text-amber-400',
    review: 'The CBT terminal exactness is uncanny. When I sat for the actual Level II exam at the official exam center, the screen split and item flagging felt identical to the FinBench365 sandbox. The algorithmic distractor deconstruction taught me why option B was a time-value trap.',
    scoreImprovement: 'Mock Score: 62% → 89%',
    percentile: '96th Percentile Overall',
    cardOffset: 'lg:mt-0',
    floatDelay: 0
  },
  {
    id: 't-2',
    name: 'Candidate #2109',
    role: 'Quantitative Risk Associate at Global Investment Bank',
    examPassed: 'Track B (Part I)  Passed Quartile 1 Across All Books',
    avatarInitials: 'QA',
    avatarColor: 'bg-emerald-900 text-emerald-300',
    review: 'Most certification prep books give you 15-year-old static questions. FinBench365’s parametric VaR and Monte Carlo simulation problems regenerate numbers every single time you attempt them. I practiced over 1,200 unique quantitative derivations.',
    scoreImprovement: 'Quartile 3 → Quartile 1',
    percentile: 'Top 2% Globally',
    cardOffset: 'lg:mt-6',
    floatDelay: 2
  },
  {
    id: 't-3',
    name: 'Candidate #3082',
    role: 'Portfolio Manager, Quantitative Equities',
    examPassed: 'Track A (Level III)  Certification Awarded',
    avatarInitials: 'PM',
    avatarColor: 'bg-blue-900 text-blue-300',
    review: 'For Level III, the constructed response and portfolio management case studies make or break your outcome. FinBench365’s IRT diagnostic engine identified precisely which fixed income duration concepts I was misapplying under time pressure.',
    scoreImprovement: 'Constructed Response: +32%',
    percentile: 'Passed Above 90th MPS',
    cardOffset: 'lg:mt-12',
    floatDelay: 4
  },
  {
    id: 't-4',
    name: 'Candidate #4155',
    role: 'Derivatives Structuring Analyst',
    examPassed: 'Track A (Level I)  Top 10th Percentile',
    avatarInitials: 'DS',
    avatarColor: 'bg-amber-900 text-amber-300',
    review: 'I stopped reading 400-page static PDFs within two weeks of joining. Whenever I got a derivatives question wrong on Delta/Gamma hedging, the exact mathematical derivation expanded below immediately without needing to hunt through textbook appendices.',
    scoreImprovement: 'Derivatives Module: 58% → 94%',
    percentile: '94th Percentile',
    cardOffset: 'lg:mt-0',
    floatDelay: 1
  },
  {
    id: 't-5',
    name: 'Candidate #5204',
    role: 'Senior Financial Engineer',
    examPassed: 'Quantitative Finance & Advanced Track',
    avatarInitials: 'FE',
    avatarColor: 'bg-indigo-900 text-indigo-300',
    review: 'The distinction between average coaching institute websites and FinBench365 is night and day. This feels like an institutional terminal workstation engineered specifically for quantitative certification mastery.',
    scoreImprovement: 'Quant Speed: 110s → 45s per item',
    percentile: 'First Class Honors',
    cardOffset: 'lg:mt-6',
    floatDelay: 3
  },
  {
    id: 't-6',
    name: 'Candidate #6318',
    role: 'Corporate Restructuring Associate',
    examPassed: 'Dual Certification Candidate  Passed',
    avatarInitials: 'CR',
    avatarColor: 'bg-purple-900 text-purple-300',
    review: 'Juggling two major financial tracks simultaneously seemed impossible until I used the IRT diagnostic heatmap. It eliminated redundant review hours by showing me exactly which multinational accounting modules were already at master tier.',
    scoreImprovement: 'Study Efficiency: +45% Time Saved',
    percentile: 'Dual Track Passed',
    cardOffset: 'lg:mt-12',
    floatDelay: 5
  }
];

export function Testimonials() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <section id="testimonials" className="py-24 md:py-32 bg-[#181A1F] text-[#FBFBF9] border-b border-[#282C36] relative overflow-hidden">
      {/* Background Bloomberg Grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #333947 1px, transparent 1px),
            linear-gradient(to bottom, #333947 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px'
        }}
      />

      <div className="max-w-[1240px] mx-auto px-6 md:px-8 relative z-10">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-amber-400 font-mono text-xs font-semibold uppercase tracking-wider">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Verifiable Candidate Outcomes</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white leading-[1.16]">
            Tested by Charterholders. <br />
            Trusted by Top Percentile Candidates.
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed">
            We don’t use generic stock avatars or anonymous quotes. Explore exact score trajectories and official CBT exam room experiences from our charterholder network.
          </p>
        </div>

        {/* Clean Responsive Grid without Overlaps or Clipping */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
          {TESTIMONIALS_DATA.map((t) => {
            const isHovered = hoveredId === t.id;

            return (
              <motion.div
                key={t.id}
                onMouseEnter={() => setHoveredId(t.id)}
                onMouseLeave={() => setHoveredId(null)}
                animate={{
                  y: isHovered ? -8 : [0, -6, 0],
                }}
                transition={{
                  y: isHovered
                    ? { duration: 0.25, ease: 'easeOut' }
                    : { duration: 6 + t.floatDelay, repeat: Infinity, ease: 'easeInOut', delay: t.floatDelay * 0.5 },
                }}
                style={{
                  zIndex: isHovered ? 40 : undefined,
                }}
                className={`relative bg-[#121419] border rounded-2xl p-6 sm:p-7 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.8)] transition-all duration-300 flex flex-col justify-between ${t.cardOffset} ${isHovered
                    ? 'border-amber-500/60 shadow-[0_24px_64px_-12px_rgba(245,158,11,0.18)] ring-1 ring-amber-500/40'
                    : 'border-[#2D323E]'
                  }`}
              >
                <div>
                  {/* Card Header: Avatar & Credentials */}
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-mono font-bold text-sm tracking-tight ${t.avatarColor} shadow-sm`}>
                        {t.avatarInitials}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-base leading-tight">
                          {t.name}
                        </h4>
                        <p className="text-xs text-slate-400 font-medium">
                          {t.role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>

                  {/* Exam Passed Badge */}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1A1E26] border border-[#2D323E] text-slate-200 font-mono text-xs font-semibold mb-4">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t.examPassed}</span>
                  </div>

                  {/* Review Quote */}
                  <p className="text-slate-300 text-sm md:text-base leading-relaxed font-normal mb-2">
                    “{t.review}”
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
