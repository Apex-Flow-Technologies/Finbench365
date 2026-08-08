'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { IN_SCOPE_PATTERNS } from '@/constants/examPatterns';
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
  durationMinutes: number;
  maxMarks: number;
  passPercent: number;
  negativeMarkPercent: number;
  features: string[];
}

/**
 * The exams actually on sale, built from the official NISM pattern table.
 *
 * What was here advertised CFA®, FRM® and GARP® tracks — third-party
 * certifications this platform does not sell and whose marks it has no licence
 * to use — alongside invented figures presented as fact: "94.2% Charterholder
 * Pass Rate", "96.8% First-Attempt Mastery", "6,400+ Algorithmic Qs". Those
 * pass rates also directly contradicted the site's own disclaimer, which states
 * that no exam result is guaranteed.
 *
 * Everything below is derived from NISM_EXAM_PATTERNS, so the duration, marks
 * and pass mark on the landing page cannot drift from the ones the exam engine
 * actually grades against.
 */
const EXAM_TRACKS: ExamTrack[] = IN_SCOPE_PATTERNS.slice(0, 3).map((p) => ({
  id: p.series.toLowerCase(),
  badge: `NISM SERIES ${p.series}`,
  title: p.name,
  subtitle: `${p.durationMinutes} minutes · ${p.maxMarks} marks · pass ${p.passPercent}%`,
  description: p.description,
  durationMinutes: p.durationMinutes,
  maxMarks: p.maxMarks,
  passPercent: p.passPercent,
  negativeMarkPercent: p.negativeMarkPercent,
  features: [
    'Full-length mock on the official exam pattern',
    'Explanation for every option, not just the correct one',
    'Complete syllabus study notes',
  ],
}));

export function ExamTracks() {
  return (
    <section id="exams" className="py-24 md:py-32 bg-[#F5F5F2] text-[#181A1F] border-b border-[#E4E4E0] relative">
      <div className="max-w-[1240px] mx-auto px-6 md:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-300/60 border border-slate-400/60 text-[#111B35] tabular-nums text-xs font-semibold uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-amber-700" />
            <span>NISM certifications</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#111B35] leading-[1.16]">
            Built for Exams That Actually Matter.
          </h2>
          <p className="text-[#334155] text-lg leading-relaxed">
            Every mock follows the official NISM exam pattern — the same duration, marks and pass mark — and every option carries an explanation for why it is right or wrong.
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
                <div className="flex items-center justify-between gap-2 mb-4 tabular-nums text-xs">
                  <span className="px-2.5 py-1 rounded bg-white dark:bg-[#181A1F] transition-colors duration-300 text-[#111B35] dark:text-white font-bold tracking-wider">
                    {track.badge}
                  </span>
                  {/* Negative marking is the single fact that most changes how
                      a candidate sits the paper, so it stays on the badge row. */}
                  <span className={`font-semibold px-2 py-0.5 rounded border ${
                    track.negativeMarkPercent > 0
                      ? 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/30'
                      : 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30'
                  }`}>
                    {track.negativeMarkPercent > 0
                      ? `${track.negativeMarkPercent}% negative marking`
                      : 'No negative marking'}
                  </span>
                </div>

                {/* Title & Subtitle */}
                <h3 className="text-2xl font-semibold text-[#111B35] tracking-tight mb-1">
                  {track.title}
                </h3>
                <p className="text-xs tabular-nums text-[#475569] dark:text-[#94A3B8] font-medium mb-4">
                  {track.subtitle}
                </p>

                <p className="text-[#334155] text-sm leading-relaxed mb-6">
                  {track.description}
                </p>

                {/* The exam's own pattern, in the four figures a candidate
                    actually compares. "Core Curriculum Modules" used to sit here
                    over an empty list — the topics were never populated — and
                    the footer claimed "Prometric CBT Formats", which is not how
                    NISM delivers these exams. */}
                <div className="grid grid-cols-2 gap-2.5 mt-6 pt-6 border-t border-slate-150 dark:border-white/10">
                  {[
                    ['Duration', `${track.durationMinutes} min`],
                    ['Questions', String(track.maxMarks)],
                    ['Pass mark', `${track.passPercent}%`],
                    ['Negative marking', track.negativeMarkPercent > 0 ? `${track.negativeMarkPercent}%` : 'None'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2">
                      <div className="text-sm font-bold text-[#111B35] dark:text-white tabular-nums">{value}</div>
                      <div className="text-[10px] uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-5">
                <a
                  href="/exams"
                  className="group w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#111B35] font-bold text-sm transition-colors shadow-sm"
                >
                  <span>Buy Now</span>
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
