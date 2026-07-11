'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, CheckCircle } from 'lucide-react';
import { HeroExamSimulator } from './hero-exam-simulator';

export function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-[92vh] pt-32 pb-24 md:pt-40 md:pb-32 flex items-center justify-center overflow-hidden bg-[#16181D] text-[#FBFBF9] border-b border-[#282C36]"
    >
      {/* Subtle background architectural pattern specific to Hero */}
      <div
        className="absolute inset-0 opacity-[0.045] pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 2px 2px, rgba(255,255,255,0.4) 1px, transparent 0)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      <div className="relative max-w-[1240px] w-full mx-auto px-6 md:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center z-10">
        {/* Left Column: Headline, Subtitle, CTAs, Trust Indicators */}
        <motion.div
          className="lg:col-span-6 space-y-8 text-left"
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Large Headline (Three lines, very bold, very clean) */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.14] font-sans"
          >
            One platform. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-slate-100 to-slate-400">
              Every certification.
            </span> <br />
            No exam left to chance.
          </motion.h1>

          {/* Supporting Paragraph (Three lines, explaining value clearly) */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-slate-300/90 text-lg sm:text-xl font-normal leading-relaxed max-w-xl font-sans"
          >
            Exam-pattern mock tests, comprehensive topic-wise notes, and in-depth explanations that build confidence with every attempt. Get wider coverage and richer study resources than most prep platforms without the premium price tag.
          </motion.p>

          {/* Primary and Secondary CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2"
          >
            <a
              href="/exams"
              className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-white text-[#16181D] font-semibold text-base shadow-[0_4px_24px_rgba(255,255,255,0.18)] hover:bg-[#EFEFEA] hover:scale-[1.01] transition-all duration-300"
            >
              <span>Explore Exams</span>
              <ArrowUpRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 text-[#16181D]" />
            </a>
          </motion.div>

          {/* Optional Trust Indicators underneath */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="pt-6 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs text-slate-400"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span><strong>14,800+</strong> Algorithmic Qs</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Real <strong>CBT Exam</strong> Pattern</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span><strong>IRT</strong> Performance Analytics</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Column: Custom Animated Examination Simulator */}
        <div className="lg:col-span-6 w-full">
          <HeroExamSimulator />
        </div>
      </div>

      {/* Intentional transition divider at bottom connecting slate hero to warm white body */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-emerald-500 to-blue-500 opacity-80" />
    </section>
  );
}
