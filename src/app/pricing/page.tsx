'use client';

import React, { useState, useEffect, Suspense } from 'react';
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
  ArrowLeft,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PLAN_PRICING } from '@/constants/pricing';
import { getUserEntitlements } from '@/lib/firebase/db';

function PricingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const courseId = searchParams?.get('courseId');
  const trackTitle = searchParams?.get('track') || 'Institutional Quantitative Certification Track';
  const trackBadge = searchParams?.get('badge') || 'Professional Syllabus Access';

  /**
   * Live access this candidate already has to the exam being priced.
   *
   * Plan selection is where a repeat purchase actually begins: a candidate
   * signed out on one device, sent to log in, and returned here was shown three
   * plans for an exam they had already paid for. Checkout and the order route
   * both refuse the sale now, but being offered the plans at all is the part
   * that reads as "you need to buy this again".
   *
   * Only unexpired access counts — renewing after expiry is deliberate.
   */
  const [alreadyEnrolled, setAlreadyEnrolled] = useState<{ expiresAt: Date } | null>(null);

  useEffect(() => {
    if (!user?.uid || !courseId) return;
    let cancelled = false;
    getUserEntitlements(user.uid)
      .then((list) => {
        const ent = list.find((e) => e.courseId === courseId);
        if (cancelled || !ent) return;
        if (ent.expiresAt.getTime() > Date.now()) setAlreadyEnrolled({ expiresAt: ent.expiresAt });
      })
      // A failed check must not block a legitimate purchase; checkout and the
      // server both refuse a duplicate regardless.
      .catch((err) => console.error('Could not check existing access:', err));
    return () => { cancelled = true; };
  }, [user?.uid, courseId]);

  const handleSelectPlan = async (plan: { id: string; name: string; price: string; days: string }) => {
    if (!user || !courseId) {
      router.push('/exams');
      return;
    }
    if (alreadyEnrolled) {
      router.push(`/dashboard/courses/${courseId}`);
      return;
    }

    setSelectedPlan(plan.name);
    
    // Redirect to real checkout page securely using planId
    const checkoutUrl = `/checkout?planId=${encodeURIComponent(plan.id)}&courseId=${encodeURIComponent(courseId)}`;
    router.push(checkoutUrl);
  };

  /**
   * Marketing copy only. Price, plan name and duration are NOT repeated here —
   * they come from PLAN_PRICING below, the same constant the server prices the
   * order from. They used to be duplicated as display strings ("₹499"), so this
   * page could advertise one price while checkout charged another, with nothing
   * to catch the drift.
   */
  const planCopy: Record<string, {
    tagline: string; popular: boolean; badge: string; badgeClass: string; features: string[];
  }> = {
    'plan-10': {
      tagline: 'Best if your exam is within the next 10 days',
      popular: false,
      badge: 'Sprint Revision Tier',
      badgeClass: 'bg-slate-200 text-[#334155] border-slate-300 dark:bg-slate-800 dark:text-[#E2E8F0] dark:border-slate-700',
      features: [
        'Access the full question bank for 10 days',
        '400+ updated questions, each with a full explanation',
        'Complete syllabus study notes',
        'Instant access — start right after payment'
      ]
    },
    'plan-30': {
      tagline: 'Best for candidates who want to prepare properly, not just cram',
      popular: false,
      badge: 'Extended Preparation Tier',
      badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
      features: [
        'Access the full question bank for 30 days',
        '400+ updated questions, each with a full explanation',
        'Complete syllabus study notes',
        'Full-length, timed mock tests that mirror the real exam pattern',
        'Chapter-wise score tracking, so you know exactly where to focus revision'
      ]
    },
    'plan-60': {
      tagline: 'Best for long-term retention and high-stakes mastery',
      popular: false,
      badge: 'Comprehensive Tier',
      badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
      features: [
        'Full access to the question bank for 60 days',
        '400+ updated questions with detailed explanations',
        'Complete syllabus study notes',
        'Full-length timed mock tests aligned with the actual exam pattern & performance tracker',
        'Exclusive Formula & Metrics Tracker – all key formulas, ratios, limits, and numerical data in one place for quick revision and exam-day recall'
      ]
    }
  };

  // Driven by the plan catalogue, so adding or repricing a plan there is enough.
  const plans = Object.entries(PLAN_PRICING).map(([id, plan]) => ({
    id,
    name: plan.name,
    days: `${plan.durationDays} Days Access`,
    price: `₹${plan.price}`,
    period: '+ GST',
    ...planCopy[id],
  }));

  // Shown instead of the plans. A candidate who already owns this exam is sent
  // to it rather than asked to choose how to pay for it a second time.
  if (alreadyEnrolled) {
    const daysLeft = Math.max(0, Math.ceil(
      (alreadyEnrolled.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    return (
      <div className="min-h-screen pt-20 bg-slate-50 dark:bg-[#121419] text-[#111B35] dark:text-[#FBFBF9] transition-colors duration-300 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl bg-white dark:bg-[#181A1F] border border-slate-200 dark:border-[#282C36]"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">You already have this exam</h1>
            <p className="text-[#475569] dark:text-[#94A3B8] text-sm leading-relaxed">
              Your access is active for another{' '}
              <span className="font-bold text-[#111B35] dark:text-white">
                {daysLeft} day{daysLeft === 1 ? '' : 's'}
              </span>. There is nothing to pay &mdash; carry on where you left off.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push(`/dashboard/courses/${courseId}`)}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#111B35] font-bold transition-colors shadow-md shadow-amber-500/20"
            >
              Open the exam
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 rounded-xl bg-slate-200 dark:bg-[#272B33] text-slate-800 dark:text-white font-bold hover:bg-slate-300 dark:hover:bg-[#343942] transition-colors"
            >
              My courses
            </button>
          </div>
          <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
            You can renew once your access runs out.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 bg-slate-50 dark:bg-[#121419] text-[#111B35] dark:text-[#FBFBF9] transition-colors duration-300">
      {/* Top Navigation bar */}
      <div className="max-w-[1240px] mx-auto px-6 md:px-8 pt-4 pb-2 flex items-center justify-between gap-4">
        <button
          onClick={() => router.push('/exams')}
          className="inline-flex items-center gap-2 text-xs tabular-nums text-[#475569] hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Exams Catalog</span>
        </button>
      </div>

      {/* Top Header Section */}
      <section className="relative py-14 md:py-20 bg-white border-y border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] transition-colors duration-300">
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        <div className="max-w-4xl mx-auto relative z-10 space-y-4 px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border-slate-200 text-amber-600 dark:bg-slate-800/80 border dark:border-slate-700 dark:text-amber-400 tabular-nums text-xs font-semibold tracking-wide transition-colors">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{trackBadge}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight font-sans leading-tight text-[#111B35] dark:text-white transition-colors">
            Choose Your Access Duration <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-slate-600 to-slate-900 dark:from-amber-200 dark:via-slate-100 dark:to-slate-400">
              for {trackTitle}
            </span>
          </h1>

          <p className="text-[#334155] dark:text-[#E2E8F0] text-sm sm:text-base max-w-2xl mx-auto leading-relaxed transition-colors">
            Select an institutional tier below. If unsigned in, you will be directed to quick candidate authentication before checkout.
          </p>
        </div>
      </section>

      {/* 3 Pricing Packages Grid */}
      <section className="py-16 md:py-24 px-6 md:px-8 max-w-[1240px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => {
            // Every plan is presented identically. Singling one out as
            // "most popular" is a claim we are not in a position to make
            // while starting out, and pre-highlighting one nudges the choice
            // before the candidate has read the other two.
            //
            // The lift happens on hover instead, so whichever plan the
            // candidate is actually considering is the one that stands out.
            const cardBg = 'bg-white border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] '
              + 'hover:border-amber-500 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] '
              + 'dark:hover:shadow-[0_0_50px_rgba(245,158,11,0.18)] hover:-translate-y-1';

            const btnClass = 'bg-amber-500 hover:bg-amber-400 text-[#111B35] dark:text-[#121419] '
              + 'font-extrabold shadow-lg shadow-amber-500/25 text-base';

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={`rounded-3xl p-7 sm:p-8 flex flex-col justify-between relative transition-all duration-300 border ${cardBg}`}
              >
                <div>
                  {/* Plan Header */}
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <span className={`px-3 py-1 rounded-full border tabular-nums text-xs transition-colors ${plan.badgeClass}`}>
                      {plan.badge}
                    </span>
                    <Clock className="w-4 h-4 text-[#475569]" />
                  </div>

                  <h3 className="text-2xl font-bold mb-2 text-[#111B35] dark:text-white transition-colors">
                    {plan.name}
                  </h3>

                  {/* Price Display */}
                  <div className="flex items-baseline gap-2 my-5">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight tabular-nums text-[#111B35] dark:text-white transition-colors">
                      {plan.price}
                    </span>
                    <span className="text-sm font-medium font-sans text-[#475569] dark:text-[#94A3B8] transition-colors">
                      {plan.period}
                    </span>
                  </div>

                  {/* Target Candidate Tagline */}
                  <div className="p-3.5 rounded-xl bg-amber-50/50 border-amber-100 dark:bg-[#121419] border dark:border-[#282C36] mb-6 transition-colors">
                    <p className="text-xs tabular-nums leading-relaxed text-amber-700 dark:text-amber-300/90 flex items-start gap-2">
                      <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>{plan.tagline}</span>
                    </p>
                  </div>

                  {/* Features List */}
                  <div className="space-y-3.5 mb-8 border-t border-slate-200 dark:border-[#282C36] pt-6 transition-colors">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm leading-normal text-[#334155] dark:text-[#E2E8F0]">
                        <div className="w-5 h-5 rounded-full bg-amber-100 border-amber-200 dark:bg-amber-500/10 border dark:border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors">
                          <Check className="w-3 h-3 text-amber-500" />
                        </div>
                        <span className={idx === plan.features.length - 1 && plan.id === 'plan-60' ? 'font-medium text-amber-700 dark:text-amber-200/90' : ''}>
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
                  className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 ${btnClass}`}
                >
                  {selectedPlan === plan.name ? (
                     <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Select Plan &amp; Checkout
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-8 text-center text-sm text-[#475569] dark:text-[#94A3B8] tabular-nums transition-colors">
          * All prices are in Indian Rupees (INR) and are exclusive of GST. 18% GST is added at checkout, and the total payable is shown before you pay.
        </div>
      </section>

      {/* Trust & Guarantee Badges Footer Section */}
      <section className="bg-slate-100 border-t border-slate-200 dark:bg-[#16181D] dark:border-[#282C36] py-14 px-6 md:px-8 transition-colors duration-300">
        <div className="max-w-[1240px] mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] flex flex-col sm:flex-row items-center sm:items-start gap-4 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-600 dark:text-amber-500 transition-colors">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#111B35] dark:text-white mb-1 transition-colors">Instant Activation</h4>
              <p className="text-[#475569] dark:text-[#94A3B8] text-xs leading-relaxed transition-colors">
                Your question bank, formula tracker, and topic notes activate instantly right after successful payment verification.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] flex flex-col sm:flex-row items-center sm:items-start gap-4 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-500 transition-colors">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#111B35] dark:text-white mb-1 transition-colors">Secure GST Invoicing</h4>
              <p className="text-[#475569] dark:text-[#94A3B8] text-xs leading-relaxed transition-colors">
                Receive instant institutional GST-compliant tax invoices via email for academic or employer reimbursement.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] flex flex-col sm:flex-row items-center sm:items-start gap-4 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-600 dark:text-emerald-500 transition-colors">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#111B35] dark:text-white mb-1 transition-colors">Multi-Device Access</h4>
              <p className="text-[#475569] dark:text-[#94A3B8] text-xs leading-relaxed transition-colors">
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
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-[#121419] pt-32 text-center text-[#475569] transition-colors">Loading access tiers...</div>}>
      <PricingContent />
    </Suspense>
  );
}
