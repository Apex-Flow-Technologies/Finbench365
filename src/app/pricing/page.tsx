'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Check, 
  Sparkles, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  Zap, 
  BookOpen, 
  ArrowLeft 
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

function PricingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { authenticated } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const trackTitle = searchParams?.get('track') || 'Institutional Quantitative Certification Track';
  const trackBadge = searchParams?.get('badge') || 'Professional Syllabus Access';

  const handleSelectPlan = (plan: { name: string; price: string; days: string }) => {
    setSelectedPlan(plan.name);
    setTimeout(() => {
      setSelectedPlan(null);
      const numericPrice = plan.price.replace('₹', '');
      const targetCheckoutUrl = `/checkout?track=${encodeURIComponent(trackTitle)}&plan=${encodeURIComponent(plan.name)}&days=${encodeURIComponent(plan.days)}&price=${numericPrice}`;
      
      if (!authenticated) {
        // Redirect to Login/Registration first, with exact return destination
        router.push(`/login?redirect=${encodeURIComponent(targetCheckoutUrl)}`);
      } else {
        // Proceed straight to Checkout
        router.push(targetCheckoutUrl);
      }
    }, 350);
  };

  const plans = [
    {
      id: 'plan-10',
      name: 'Plan 1 — 10 Days',
      days: '10 Days Access',
      price: '₹499',
      period: '+ GST',
      tagline: 'Best if your exam is within the next 10 days',
      popular: false,
      badge: 'Sprint Revision Tier',
      badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
      features: [
        'Access the full question bank for 10 days',
        '400+ updated questions, each with a full explanation',
        'Complete syllabus study notes',
        'Instant access — start right after payment'
      ]
    },
    {
      id: 'plan-30',
      name: 'Plan 2 — 30 Days',
      days: '30 Days Access',
      price: '₹599',
      period: '+ GST',
      tagline: 'Best for candidates who want to prepare properly, not just cram',
      popular: true,
      badge: 'Most Popular • Recommended',
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30 font-bold',
      features: [
        'Access the full question bank for 30 days',
        '400+ updated questions, each with a full explanation',
        'Complete syllabus study notes',
        'Full-length, timed mock tests that mirror the real exam pattern',
        'Chapter-wise score tracking, so you know exactly where to focus revision'
      ]
    },
    {
      id: 'plan-60',
      name: 'Plan 3 – 60 Days',
      days: '60 Days Access',
      price: '₹699',
      period: '+ GST',
      tagline: 'Best for long-term retention and high-stakes mastery',
      popular: false,
      badge: 'Comprehensive Tier',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      features: [
        'Full access to the question bank for 60 days',
        '400+ updated questions with detailed explanations',
        'Complete syllabus study notes',
        'Full-length timed mock tests aligned with the actual exam pattern & performance tracker',
        'Exclusive Formula & Metrics Tracker – all key formulas, ratios, limits, and numerical data in one place for quick revision and exam-day recall'
      ]
    }
  ];

  return (
    <div className="min-h-screen pt-20 bg-[#121419] text-[#FBFBF9]">
      {/* Top Navigation bar */}
      <div className="max-w-[1240px] mx-auto px-6 md:px-8 pt-4 pb-2 flex items-center justify-between gap-4">
        <button
          onClick={() => router.push('/exams')}
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Exams Catalog</span>
        </button>
      </div>

      {/* Top Header Section */}
      <section className="relative py-14 md:py-20 bg-[#181A1F] border-y border-[#282C36]">
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, #FFFFFF 1px, transparent 1px),
              linear-gradient(to bottom, #FFFFFF 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        <div className="max-w-4xl mx-auto relative z-10 space-y-4 px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-amber-400 font-mono text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{trackBadge}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight font-sans leading-tight text-white">
            Choose Your Access Duration <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-slate-100 to-slate-400">
              for {trackTitle}
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Select an institutional tier below. If unsigned in, you will be directed to quick candidate authentication before checkout.
          </p>
        </div>
      </section>

      {/* 3 Pricing Packages Grid */}
      <section className="py-16 md:py-24 px-6 md:px-8 max-w-[1240px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => {
            let cardBg = 'bg-[#181A1F] border-[#282C36]';
            if (plan.popular) {
              cardBg = 'bg-[#16181D] border-2 border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.18)] scale-[1.03] z-10';
            }

            let btnClass = 'bg-[#272B33] hover:bg-[#343942] text-white';
            if (plan.popular) {
              btnClass = 'bg-amber-500 hover:bg-amber-400 text-[#121419] font-extrabold shadow-lg shadow-amber-500/25 text-base';
            }

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={`rounded-3xl p-7 sm:p-8 flex flex-col justify-between relative transition-all duration-300 border ${cardBg}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-[#121419] font-extrabold text-[11px] uppercase tracking-wider px-4 py-1.5 rounded-full shadow-md flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 fill-[#121419]" />
                    <span>Most Popular Choice</span>
                  </div>
                )}

                <div>
                  {/* Plan Header */}
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <span className={`px-3 py-1 rounded-full border font-mono text-xs ${plan.badgeClass}`}>
                      {plan.badge}
                    </span>
                    <Clock className="w-4 h-4 text-slate-400" />
                  </div>

                  <h3 className="text-2xl font-bold mb-2 text-white">
                    {plan.name}
                  </h3>

                  {/* Price Display */}
                  <div className="flex items-baseline gap-2 my-5">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight font-mono text-white">
                      {plan.price}
                    </span>
                    <span className="text-sm font-medium font-sans text-slate-400">
                      {plan.period}
                    </span>
                  </div>

                  {/* Target Candidate Tagline */}
                  <div className="p-3.5 rounded-xl bg-[#121419] border border-[#282C36] mb-6">
                    <p className="text-xs font-mono leading-relaxed text-amber-300/90 flex items-start gap-2">
                      <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>{plan.tagline}</span>
                    </p>
                  </div>

                  {/* Features List */}
                  <div className="space-y-3.5 mb-8 border-t border-[#282C36] pt-6">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm leading-normal text-slate-300">
                        <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-amber-500" />
                        </div>
                        <span className={idx === plan.features.length - 1 && plan.id === 'plan-60' ? 'font-medium text-amber-200/90' : ''}>
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={selectedPlan === plan.name}
                  className={`w-full py-4 px-6 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-2.5 shadow-md focus:outline-none ${btnClass}`}
                >
                  {selectedPlan === plan.name ? (
                    <span className="animate-pulse">Checking Account Status...</span>
                  ) : (
                    <>
                      <span>{plan.popular ? 'Unlock 30-Day Access' : 'Select Plan & Checkout'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Trust & Guarantee Badges Footer Section */}
      <section className="bg-[#16181D] border-t border-[#282C36] py-14 px-6 md:px-8">
        <div className="max-w-[1240px] mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
          <div className="p-6 rounded-2xl bg-[#181A1F] border border-[#282C36] flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-500">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white mb-1">Instant Activation</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Your question bank, formula tracker, and topic notes activate instantly right after successful payment verification.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#181A1F] border border-[#282C36] flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-500">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white mb-1">Secure GST Invoicing</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Receive instant institutional GST-compliant tax invoices via email for academic or employer reimbursement.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#181A1F] border border-[#282C36] flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-500">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white mb-1">Multi-Device Access</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Practice seamlessly on desktop, laptop, tablet, or smartphone with synchronized progress and bookmarking.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#121419] pt-32 text-center text-slate-400">Loading access tiers...</div>}>
      <PricingContent />
    </Suspense>
  );
}
