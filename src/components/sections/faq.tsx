'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, HelpCircle } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

/**
 * FAQ copy, supplied by the client (MyExams365_FAQ_Content_Final).
 *
 * What was here before described a different product entirely — CFA and FRM
 * exams, an "Item-Response Theory diagnostic engine", a "Two-Parameter Logistic
 * model", an algorithmic question bank that randomised par values and yields,
 * and a pass guarantee. None of that exists. This platform sells NISM mock
 * tests and study notes, and the answers below say so.
 */
const FAQ_ITEMS: FaqItem[] = [
  {
    category: 'CBT Exam Simulation',
    question: 'How does MyExams365 replicate the actual NISM CBT exam experience?',
    answer: "MyExams365 closely mirrors the real NISM exam — the exact exam duration, the actual CBT interface, and the same look and feel you'll see on exam day. Questions are conceptualized to match the real exam pattern, and every mock comes with a key metrics tracker so you can measure your performance for each exam.",
  },
  {
    category: 'Exam Coverage',
    question: 'Which exams does MyExams365 currently support?',
    answer: "Right now, MyExams365 offers mock tests and study material for Mutual Fund Distributors (V-A), Mutual Fund Foundation (V-B), Mutual Fund – Specialized Investment Fund Distributors (V-D), Research Analyst (XV), Securities Markets Foundation (XII), and Equity Derivatives (VIII). We're actively expanding to cover more NISM certifications, as well as other non-NISM finance exams in India.",
  },
  {
    category: 'Exam Blueprint Accuracy',
    question: 'How closely do the mocks follow the real NISM exam pattern?',
    answer: 'Every mock test is built on the actual NISM exam blueprint — matching the chapter-wise and topic-wise weightage of the real exam. This helps you get familiar with the exam GUI in advance, so you walk in on exam day without anxiety or surprises.',
  },
  {
    category: 'Validity & Access',
    question: 'How long will I have access to my study material and mock tests after purchase?',
    answer: "MyExams365 offers three plans to choose from — a 10-day plan, a 30-day plan, and a 60-day plan. Once you reach your plan's validity period, access automatically expires.",
  },
  {
    category: 'Reattempt Policy',
    question: 'Can I retake a mock test multiple times, or is each attempt final?',
    answer: 'Every mock test comes with 10 attempts, across all three plans.',
  },
  {
    category: 'Study Material',
    question: "What's included in the study material, and is it enough on its own?",
    answer: 'We recommend pairing the NISM study workbook with our study notes for deeper conceptual and applicative understanding — especially if your goal is to pass with flying colours, not just clear the exam. Our study material includes 400+ updated questions with full explanations, along with complete syllabus notes. The 60-day plan additionally includes an Excel-based Formula & Metrics Tracker for every exam.',
  },
  {
    category: 'Device Compatibility',
    question: 'Can I attempt mock tests on mobile and tablet, or is a laptop required?',
    answer: 'Yes. You can log in from your mobile, laptop, or tablet — with a one-device login limit at a time.',
  },
  {
    category: 'Refund & Cancellation',
    question: "Is there a refund if I don't end up using all my mock tests?",
    answer: 'No. MyExams365 follows a strict no-refund policy — once an exam plan is purchased, it cannot be refunded.',
  },
];

export function Faq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-24 md:py-32 bg-transparent transition-colors duration-300 text-[#111B35] dark:text-[#FBFBF9] border-b border-[#E4E4E0] dark:border-[#282C36] relative">
      <div className="max-w-[1040px] mx-auto px-6 md:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300/80 dark:border-slate-700 text-[#111B35] dark:text-amber-400 tabular-nums text-xs font-semibold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            <span>Architecture & Pedagogy FAQ</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#111B35] dark:text-white leading-[1.16]">
            Frequently Asked Questions <br />
            On Our Examination Engine.
          </h2>
          <p className="text-[#334155] text-lg leading-relaxed">
            Everything you need to know about our NISM mock tests, study notes, plans and access.
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
                    ? 'bg-white dark:bg-[#121419] border-[#181A1F] dark:border-amber-500/60 shadow-[0_12px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_32px_rgba(245,158,11,0.1)]'
                    : 'bg-white/80 dark:bg-[#181A1F]/80 border-[#E4E4E0] dark:border-[#2D323E] hover:border-slate-350 dark:hover:border-[#3a4150] hover:bg-white dark:hover:bg-[#181A1F]'
                }`}
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full text-left py-5 px-6 sm:px-7 flex items-center justify-between gap-4 focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <span className="tabular-nums text-[11px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-wider bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/50 w-fit">
                      {item.category}
                    </span>
                    <span className="text-base sm:text-lg font-medium text-[#111B35] dark:text-white leading-snug">
                      {item.question}
                    </span>
                  </div>

                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                      isOpen ? 'bg-[#181A1F] dark:bg-amber-500 text-white dark:text-[#181A1F]' : 'bg-slate-100 dark:bg-[#282C36] text-[#475569] dark:text-[#94A3B8]'
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
                      <div className="px-6 sm:px-7 pb-6 pt-1 text-[#334155] text-base leading-relaxed border-t border-[#F2F2EC]">
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
          <p className="text-sm text-[#475569] dark:text-[#94A3B8]">
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
