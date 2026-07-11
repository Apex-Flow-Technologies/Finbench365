'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, HelpCircle } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    category: 'Institutional CBT Fidelity',
    question: 'How does FinBench365 replicate the exact CBT (Computer-Based Testing) interface for CFA® and FRM® exams?',
    answer: 'Our frontend terminal exactly mirrors official examination center station constraints: pixel-accurate split-screen layouts, dual-pane formula sheets, item highlighting, right-click strikethrough for eliminating decoy distractors, and precise sub-second latency behavior. Sitting for our full-length mock exams builds muscle memory so exam day feels like just another practice session.'
  },
  {
    category: 'Algorithmic Question Bank',
    question: 'What makes your quantitative algorithmic question bank different from standard static question banks?',
    answer: 'Conventional question banks use fixed numbers. If you attempt a question twice, you end up memorizing the answer rather than the underlying mathematical derivation. FinBench365’s algorithmic engine dynamically randomizes par values, yields, volatilities, asset weights, and tax rates every time a question is launched, generating thousands of unique quantitative variations from our core learning outcome statements.'
  },
  {
    category: 'IRT Diagnostic Engine',
    question: 'How does the Item-Response Theory (IRT) diagnostic engine calculate my true probability of passing?',
    answer: 'Instead of raw percentage scores (which fail to differentiate between a simple definition and a complex 3-step bond duration problem), our engine uses a Two-Parameter Logistic (2PL) IRT model. It calibrates every question by item difficulty and discrimination index, continuously mapping your ability parameter (θ) against the historically observed minimum passing score (MPS) of actual charterholders.'
  },
  {
    category: 'Curriculum Synchronization',
    question: 'Are all curriculum learning outcomes (LOS) fully updated for the 2026–2027 examination cycle?',
    answer: 'Yes. Our quantitative analysts and CFA charterholders synchronize our item matrix with official curriculum releases within 72 hours of publication. Any deprecated learning outcome statements or altered syllabus weights are automatically flagged across your personal study dashboard.'
  },
  {
    category: 'Device & Platform Access',
    question: 'Can I use FinBench365 across mobile, tablet, and desktop workstations simultaneously?',
    answer: 'Absolutely. While we recommend taking full-length timed CBT mock exams on a desktop or laptop to replicate official examination conditions, our responsive architecture allows you to practice individual algorithmic question sets, review formula derivations, and check performance analytics seamlessly on iPad and smartphone.'
  },
  {
    category: 'Pass Guarantee & Institutional Policy',
    question: 'What is your institutional academic pass guarantee and refund policy?',
    answer: 'We stand by the institutional rigor of our simulator. If you complete at least 8 full-length Institutional CBT mock examinations within our sandbox and achieve an average IRT confidence percentile above the 75th mark, but fail to pass your official CFA® or FRM® examination, we provide a 100% full tuition refund or complimentary access extension for your next testing window.'
  }
];

export function Faq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-24 md:py-32 bg-[#FAFAF8] text-[#181A1F] border-b border-[#E4E4E0] relative">
      <div className="max-w-[1040px] mx-auto px-6 md:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-200/80 border border-slate-300/80 text-slate-800 font-mono text-xs font-semibold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
            <span>Architecture & Pedagogy FAQ</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 leading-[1.16]">
            Frequently Asked Questions <br />
            On Our Examination Engine.
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            Everything you need to know about our Institutional CBT simulator, Item-Response Theory grading, and curriculum alignment.
          </p>
        </div>

        {/* Beautiful Accordion */}
        <div className="space-y-4 max-w-3xl mx-auto">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIdx === idx;

            return (
              <div
                key={idx}
                className={`border rounded-xl transition-all duration-300 overflow-hidden ${
                  isOpen
                    ? 'bg-white border-[#181A1F] shadow-[0_12px_32px_rgba(0,0,0,0.06)]'
                    : 'bg-white/80 border-[#E4E4E0] hover:border-slate-350 hover:bg-white'
                }`}
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full text-left py-5 px-6 sm:px-7 flex items-center justify-between gap-4 focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <span className="font-mono text-[11px] font-bold text-amber-700 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded border border-amber-200 w-fit">
                      {item.category}
                    </span>
                    <span className="text-base sm:text-lg font-medium text-slate-900 leading-snug">
                      {item.question}
                    </span>
                  </div>

                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                      isOpen ? 'bg-[#181A1F] text-white' : 'bg-[#EFEFEA] text-slate-700'
                    }`}
                  >
                    {isOpen ? (
                      <Minus className="w-4 h-4 transition-transform duration-300" />
                    ) : (
                      <Plus className="w-4 h-4 transition-transform duration-300" />
                    )}
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="px-6 sm:px-7 pb-6 pt-1 text-slate-600 text-base leading-relaxed border-t border-[#F2F2EC]">
                        <p>{item.answer}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Support Callout */}
        <div className="mt-16 text-center">
          <p className="text-sm text-slate-500">
            Have a specific quantitative institutional query or university curriculum partnership request?{' '}
            <a href="#contact" className="font-semibold text-[#181A1F] underline underline-offset-4 hover:text-amber-700 transition-colors">
              Contact our Academic Team →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
