'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export function AmbientBackground() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Soft architectural grid movement at 3.5% opacity */}
      <div 
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #1F242D 1px, transparent 1px),
            linear-gradient(to bottom, #1F242D 1px, transparent 1px)
          `,
          backgroundSize: '72px 72px'
        }}
      />

      {/* Extremely slow floating network lines & financial yield curves (SVG) */}
      {!shouldReduceMotion && (
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.045]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="yieldCurveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
              <stop offset="50%" stopColor="#1E293B" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="quantGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0F172A" stopOpacity="0" />
              <stop offset="50%" stopColor="#334155" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Drifting Financial Graph Line 1: Yield Curve / Moving Average */}
          <motion.path
            d="M -100 650 Q 300 450 700 620 T 1500 400 T 2200 300"
            fill="none"
            stroke="url(#yieldCurveGrad)"
            strokeWidth="1.5"
            initial={{ pathOffset: 0, opacity: 0.6 }}
            animate={{
              pathOffset: [0, 1],
              opacity: [0.5, 0.8, 0.5]
            }}
            transition={{
              duration: 48,
              repeat: Infinity,
              ease: 'linear'
            }}
          />

          {/* Drifting Quantitative Curve 2 */}
          <motion.path
            d="M -200 300 C 400 600, 800 200, 1400 480 C 1800 650, 2100 350, 2400 500"
            fill="none"
            stroke="url(#quantGrad)"
            strokeWidth="1.2"
            strokeDasharray="6 8"
            initial={{ pathOffset: 0 }}
            animate={{
              pathOffset: [1, 0]
            }}
            transition={{
              duration: 64,
              repeat: Infinity,
              ease: 'linear'
            }}
          />

          {/* Tiny moving connection points / nodes */}
          <motion.g
            initial={{ y: 0, x: 0 }}
            animate={{ y: [-15, 15, -15], x: [-20, 20, -20] }}
            transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
          >
            <circle cx="18%" cy="28%" r="2" fill="#334155" />
            <circle cx="68%" cy="22%" r="2.5" fill="#334155" />
            <circle cx="82%" cy="64%" r="2" fill="#334155" />
            <circle cx="34%" cy="74%" r="2" fill="#334155" />
            <line x1="18%" y1="28%" x2="34%" y2="74%" stroke="#334155" strokeWidth="0.5" strokeDasharray="4 4" />
            <line x1="68%" y1="22%" x2="82%" y2="64%" stroke="#334155" strokeWidth="0.5" strokeDasharray="4 4" />
          </motion.g>
        </svg>
      )}

      {/* Subtle floating dots across viewport */}
      {!shouldReduceMotion && (
        <div className="absolute inset-0">
          {[
            { top: '15%', left: '12%', size: '3px', delay: 0, duration: 24 },
            { top: '42%', left: '85%', size: '2.5px', delay: 4, duration: 28 },
            { top: '78%', left: '25%', size: '3.5px', delay: 8, duration: 32 },
            { top: '65%', left: '72%', size: '2px', delay: 2, duration: 26 },
            { top: '25%', left: '55%', size: '2.5px', delay: 6, duration: 30 },
          ].map((dot, index) => (
            <motion.div
              key={index}
              className="absolute rounded-full bg-slate-500/30"
              style={{
                top: dot.top,
                left: dot.left,
                width: dot.size,
                height: dot.size,
              }}
              animate={{
                y: [0, -24, 0],
                x: [0, 16, 0],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: dot.duration,
                delay: dot.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
