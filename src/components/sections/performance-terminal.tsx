'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Terminal, XCircle, CheckCircle2, Cpu, BarChart3, Zap, Activity } from 'lucide-react';

export function PerformanceTerminal() {
  const [activeTab, setActiveTab] = useState<'architecture' | 'metrics'>('architecture');

  return (
    <section id="terminal" className="py-24 md:py-32 bg-[#181A1F] text-[#FBFBF9] border-b border-[#282C36] relative overflow-hidden">
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
            <Terminal className="w-3.5 h-3.5" />
            <span>Bloomberg Terminal Inspired Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white leading-[1.16]">
            Why Institutional Precision Outperforms <br />
            Static Coaching Material.
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed">
            Conventional coaching institutes rely on static PDFs and memorized question dumps from past cycles. FinBench365 operates like a quantitative diagnostic engine.
          </p>
        </div>

        {/* Bloomberg Modern Table / Matrix Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-[#121419] border border-[#2D323E] rounded-2xl shadow-[0_24px_80px_-16px_rgba(0,0,0,0.8)] overflow-hidden"
        >
          {/* Terminal Header Bar */}
          <div className="bg-[#1A1E26] border-b border-[#2D323E] px-6 py-4 flex items-center justify-between flex-wrap gap-4 font-mono text-xs select-none">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-slate-400 font-semibold tracking-wider">DIAGNOSTIC_COMPARISON_MATRIX.fb365</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('architecture')}
                className={`px-3 py-1 rounded font-semibold transition-colors ${
                  activeTab === 'architecture'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Architecture Matrix
              </button>
              <button
                onClick={() => setActiveTab('metrics')}
                className={`px-3 py-1 rounded font-semibold transition-colors ${
                  activeTab === 'metrics'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Performance Telemetry
              </button>
            </div>
          </div>

          {/* Table Content */}
          <div className="p-6 md:p-8 overflow-x-auto">
            {activeTab === 'architecture' ? (
              <table className="w-full text-left border-collapse min-w-[680px]">
                <thead>
                  <tr className="border-b border-[#2D323E] font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-4 px-4 w-[28%]">Pedagogical Dimension</th>
                    <th className="py-4 px-4 w-[36%] text-slate-500">Typical Coaching Institutes (Static Prep)</th>
                    <th className="py-4 px-4 w-[36%] text-amber-400">FinBench365 Institutional Architecture</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232731] font-sans text-sm md:text-base">
                  {[
                    {
                      dimension: 'Examination Environment Fidelity',
                      conventional: 'Static PDF worksheets or generic web quizzes with no timer calibration or Prometric CBT constraints.',
                      finbench: 'Exact Prometric CBT terminal replica (screen split, highlighting, strikethrough, item flagging, precise sub-second latency).'
                    },
                    {
                      dimension: 'Question Bank Algorithmic Variance',
                      conventional: 'Fixed numeric parameters. Students memorize answers after 2 practice attempts instead of learning the formula.',
                      finbench: 'Dynamic Algorithmic Parameter Randomization. Par values, yields, volatilities, and tax rates regenerate on every single attempt.'
                    },
                    {
                      dimension: 'Distractor Diagnostic Explanations',
                      conventional: 'Provides only the explanation for option A being correct. Decoy distractors are left completely unexplained.',
                      finbench: 'Complete Distractor Deconstruction. Explains exactly why option B is a time-value trap and why option C represents a tax shield error.'
                    },
                    {
                      dimension: 'Grading & Mastery Calibration',
                      conventional: 'Raw percentage score (e.g. "72/100"). Fails to distinguish between easy foundation questions and complex 3-step derivatives.',
                      finbench: 'Item-Response Theory (IRT) Two-Parameter Logistic Model. Calibrates true mastery and predicts exact Prometric exam pass probability.'
                    },
                    {
                      dimension: 'Curriculum Synchronization',
                      conventional: 'Updated once annually (or biannually). Often contains deprecated LOS standards from 3 years prior.',
                      finbench: 'Real-time 2026–2027 Syllabus Sync. Automated deprecation alerts when CFA Institute or GARP alters weightings.'
                    }
                  ].map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[#1E222C]/60 transition-colors">
                      <td className="py-5 px-4 font-mono font-semibold text-slate-200 align-top">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          <span>{row.dimension}</span>
                        </div>
                      </td>
                      <td className="py-5 px-4 text-slate-400 align-top">
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-rose-500/80 flex-shrink-0 mt-1" />
                          <span className="leading-relaxed">{row.conventional}</span>
                        </div>
                      </td>
                      <td className="py-5 px-4 text-slate-100 align-top bg-amber-500/[0.03]">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-1" />
                          <span className="font-medium leading-relaxed">{row.finbench}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
                <div className="p-6 rounded-xl bg-[#161A22] border border-[#2D323E] space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>AVERAGE TIME TO MASTERY</span>
                    <Activity className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-bold text-white">142 Hours</div>
                  <p className="text-xs text-slate-400 font-sans leading-relaxed">
                    Compared to 300+ hours with unstructured video lectures. Our IRT diagnostic engine focuses candidates purely on their weak quantitative quartiles.
                  </p>
                </div>

                <div className="p-6 rounded-xl bg-[#161A22] border border-[#2D323E] space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>FIRST-ATTEMPT PASS PERCENTILE</span>
                    <BarChart3 className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-3xl font-bold text-amber-400">95.4%</div>
                  <p className="text-xs text-slate-400 font-sans leading-relaxed">
                    Among candidates who complete at least 8 full Prometric CBT simulated mock examinations within our sandbox environment.
                  </p>
                </div>

                <div className="p-6 rounded-xl bg-[#161A22] border border-[#2D323E] space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>FORMULA DERIVATION LATENCY</span>
                    <Zap className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-3xl font-bold text-blue-400">&lt; 18 ms</div>
                  <p className="text-xs text-slate-400 font-sans leading-relaxed">
                    Instant algorithmic derivation of Black-Scholes Greeks, Macaulay duration, and multivariate regressions on every answer submission.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
