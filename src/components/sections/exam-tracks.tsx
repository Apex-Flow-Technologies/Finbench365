'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Layers, 
  CheckCircle2, 
  ArrowUpRight 
} from 'lucide-react';

interface ExamTrack {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  questionCount: string;
  passRate: string;
  keyTopics: string[];
  features: string[];
}

const EXAM_TRACKS: ExamTrack[] = [
  {
    id: 'cfa',
    badge: 'CFA® CURRICULUM v2026',
    title: 'Chartered Financial Analyst®',
    subtitle: 'Levels I, II & III Complete Institutional Matrix',
    description: 'Master quantitative methods, financial statement reporting, fixed income convexity, and portfolio management with exact Prometric item-set simulations.',
    questionCount: '6,400+ Algorithmic Qs',
    passRate: '94.2% Charterholder Pass Rate',
    keyTopics: ['Quantitative Methods & Econometrics', 'Financial Statement Analysis (U.S. GAAP vs IFRS)', 'Fixed Income & Valuation Models', 'Derivatives & Alternative Investments'],
    features: ['Adaptive IRT Difficulty Calibration', 'Sub-second Formula Step Derivations', 'Full Prometric Mock Examinations']
  },
  {
    id: 'frm',
    badge: 'GARP® FRM® v2026',
    title: 'Financial Risk Manager®',
    subtitle: 'Parts I & II Quantitative Risk Architecture',
    description: 'Engineered specifically for quantitative risk analysts. Covers parametric VaR, Expected Shortfall, Monte Carlo credit migration, and Basel IV solvency modeling.',
    questionCount: '4,800+ Advanced Case Qs',
    passRate: '96.8% First-Attempt Mastery',
    keyTopics: ['Foundations of Risk Management & Quant Methods', 'Financial Markets & Products (Exotics & Swaps)', 'Valuation & Risk Models (GARCH & Volatility)', 'Credit Risk Measurement & Counterparty CVA'],
    features: ['Exact CBT Time-per-item Tracking', 'Randomized Distractor Generation', 'Comprehensive Formula Sheet Integration']
  },
  {
    id: 'quant-ca',
    badge: 'QUANT IT & CA ADVANCED',
    title: 'Quantitative Finance & CA Final',
    subtitle: 'Stochastic Calculus, Corporate Restructuring & Modeling',
    description: 'High-performance curriculum for quantitative engineering roles and CA Final financial reporting. Deep mathematical rigor with executable Python derivation benchmarks.',
    questionCount: '3,600+ Modeling Case Studies',
    passRate: 'Top 5% Institutional Placement',
    keyTopics: ['Black-Scholes-Merton Partial Differential Equations', 'Fixed Income Term Structure Models (Hull-White)', 'Advanced Corporate Valuation & LBO Modeling', 'International Taxation & Consolidation Standards'],
    features: ['Real-world Financial Dataset Sandboxing', 'Algorithmic Excel / Python Formula Cross-checks', 'Direct Charterholder Q&A Mentorship']
  }
];

export function ExamTracks() {
  return (
    <section id="exams" className="py-24 md:py-32 bg-[#F5F5F2] text-[#181A1F] border-b border-[#E4E4E0] relative">
      <div className="max-w-[1240px] mx-auto px-6 md:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-300/60 border border-slate-400/60 text-slate-800 font-mono text-xs font-semibold uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-amber-700" />
            <span>Curriculum Engineering</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 leading-[1.16]">
            Architected for High-Stakes <br />
            Financial Examinations.
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            Every learning outcome statement (LOS) is systematically mapped against our institutional item-response database. We never use static, memorized question dumps.
          </p>
        </div>

        {/* Tracks Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {EXAM_TRACKS.map((track, idx) => (
            <motion.div
              key={track.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: idx * 0.15 }}
              className="bg-white border border-[#DDDDD2] rounded-2xl p-6 sm:p-8 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Track Badge */}
                <div className="flex items-center justify-between gap-2 mb-4 font-mono text-xs">
                  <span className="px-2.5 py-1 rounded bg-[#181A1F] text-white font-bold tracking-wider">
                    {track.badge}
                  </span>
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {track.passRate}
                  </span>
                </div>

                {/* Title & Subtitle */}
                <h3 className="text-2xl font-semibold text-slate-900 tracking-tight mb-1">
                  {track.title}
                </h3>
                <p className="text-xs font-mono text-slate-500 font-medium mb-4">
                  {track.subtitle}
                </p>

                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                  {track.description}
                </p>

                {/* Key Topics List */}
                <div className="space-y-2 mb-6 pt-6 border-t border-slate-150">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
                    Core Curriculum Modules
                  </span>
                  {track.keyTopics.map((topic, tIdx) => (
                    <div key={tIdx} className="flex items-start gap-2.5 text-xs text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                      <span className="font-medium leading-snug">{topic}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Metrics & CTA */}
              <div className="pt-6 border-t border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="font-mono text-xs text-slate-600">
                  <span className="block font-bold text-slate-900">{track.questionCount}</span>
                  <span>Prometric CBT Formats</span>
                </div>

                <a
                  href="#sandbox"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('sandbox')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="group inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#181A1F] hover:bg-[#282C36] text-white font-semibold text-xs sm:text-sm transition-all shadow-sm"
                >
                  <span>Launch Practice</span>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
