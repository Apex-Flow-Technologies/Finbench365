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
  questionCount: string;
  passRate: string;
  keyTopics: string[];
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
  questionCount: `${p.maxMarks} questions`,
  passRate: p.negativeMarkPercent > 0
    ? `${p.negativeMarkPercent}% negative marking`
    : 'No negative marking',
  keyTopics: [],
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
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {track.passRate}
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

                {/* Key Topics List */}
                <div className="space-y-2 mb-6 pt-6 border-t border-slate-150">
                  <span className="tabular-nums text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] dark:text-[#94A3B8] block mb-3">
                    Core Curriculum Modules
                  </span>
                  {track.keyTopics.map((topic, tIdx) => (
                    <div key={tIdx} className="flex items-start gap-2.5 text-xs text-[#334155]">
                      <CheckCircle2 className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                      <span className="font-medium leading-snug">{topic}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Metrics & CTA */}
              <div className="pt-6 border-t border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="tabular-nums text-xs text-[#334155]">
                  <span className="block font-bold text-[#111B35]">{track.questionCount}</span>
                  <span>Prometric CBT Formats</span>
                </div>

                <a
                  href="#sandbox"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('sandbox')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="group inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-[#181A1F] transition-colors duration-300 hover:bg-[#282C36] text-[#111B35] dark:text-white font-semibold text-xs sm:text-sm transition-all shadow-sm"
                >
                  <span>Try a sample question</span>
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
