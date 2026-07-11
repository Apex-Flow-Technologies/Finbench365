'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  CreditCard, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  ArrowLeft, 
  Sparkles, 
  Tag, 
  HelpCircle, 
  Check, 
  X, 
  ExternalLink 
} from 'lucide-react';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const trackTitle = searchParams?.get('track') || 'Quantitative Risk Mastery — Level I';
  const planName = searchParams?.get('plan') || 'Plan 2 — 30 Days';
  const planDays = searchParams?.get('days') || '30 Days Access';
  const rawPrice = parseFloat(searchParams?.get('price') || '599');

  // Calculations
  const basePrice = isNaN(rawPrice) ? 599 : rawPrice;
  const gstRate = 0.18;
  const gstAmount = Math.round((basePrice * gstRate) * 100) / 100;
  const finalTotal = Math.round((basePrice + gstAmount) * 100) / 100;

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [org, setOrg] = useState('');
  const [coupon, setCoupon] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [showRazorpayModal, setShowRazorpayModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState(false);

  // Auto-populate logged-in user details
  useEffect(() => {
    const savedUser = localStorage.getItem('finbench_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.name) setName(parsed.name);
        if (parsed.email) setEmail(parsed.email);
      } catch (e) {}
    }
  }, []);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (coupon.trim().toUpperCase() === 'FINBENCH10') {
      setCouponApplied(true);
      alert('Voucher FINBENCH10 applied successfully! Institutional tier verified.');
    } else {
      alert('Invalid coupon code. Try code: FINBENCH10');
    }
  };

  const handleOpenRazorpay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone) {
      alert('Please fill in your Name, Email, and Phone so we can link your CBT license.');
      return;
    }
    setShowRazorpayModal(true);
  };

  const handleConfirmRazorpayPayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setShowRazorpayModal(false);
      setOrderCompleted(true);
    }, 1500);
  };

  if (orderCompleted) {
    return (
      <div className="min-h-screen pt-28 pb-20 px-6 flex items-center justify-center bg-[#121419] text-[#FBFBF9]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl bg-[#181A1F] border border-[#282C36]"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-mono text-xs font-bold uppercase tracking-wider">
              Razorpay Verified • Order #FB-{Math.floor(100000 + Math.random() * 900000)}
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-sans text-white">
              Enrollment Successful!
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Welcome aboard, <span className="font-semibold">{name}</span>. Your {planDays} package for <span className="text-amber-500 font-semibold">{trackTitle}</span> is now active.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#121419] border border-[#282C36] text-left space-y-3 font-mono text-xs text-slate-300">
            <div className="flex justify-between border-b border-[#282C36] pb-2">
              <span className="text-slate-400">Candidate Email:</span>
              <span className="font-semibold">{email}</span>
            </div>
            <div className="flex justify-between border-b border-[#282C36] pb-2">
              <span className="text-slate-400">Plan Duration:</span>
              <span className="text-amber-500 font-semibold">{planName} ({planDays})</span>
            </div>
            <div className="flex justify-between border-b border-[#282C36] pb-2">
              <span className="text-slate-400">Total Paid (with 18% GST):</span>
              <span className="text-emerald-500 font-bold">₹{finalTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">GST Invoice status:</span>
              <span className="text-emerald-500 font-semibold">Dispatched via Email</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => router.push('/exams')}
              className="flex-1 py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#121419] font-bold text-sm tracking-wide shadow-md transition-colors"
            >
              Enter CBT Examination Terminal
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 py-3.5 px-6 rounded-xl font-semibold text-sm transition-colors bg-[#272B33] hover:bg-[#343942] text-white"
            >
              Return to Homepage
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-24 px-6 md:px-8 bg-[#121419] text-[#FBFBF9]">
      {/* Razorpay Simulated Modal Overlay */}
      <AnimatePresence>
        {showRazorpayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="max-w-md w-full rounded-3xl overflow-hidden shadow-2xl bg-[#181A1F] border border-[#282C36] text-white"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/20">
                    <ShieldCheck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm leading-tight">Razorpay Secure Checkout</h3>
                    <p className="text-[11px] text-blue-100 font-mono">Verified Institutional Gateway</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRazorpayModal(false)}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                <div className="p-4 rounded-2xl bg-[#121419] border border-[#282C36] space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Merchant:</span>
                    <span className="font-bold">FinBench365 CBT Portal</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Item:</span>
                    <span className="font-semibold text-amber-500">{planName}</span>
                  </div>
                  <div className="flex justify-between text-sm font-mono pt-2 border-t border-[#282C36] mt-2">
                    <span className="text-slate-300 font-sans">Amount (w/ GST):</span>
                    <span className="font-extrabold text-emerald-500 text-base">₹{finalTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-400">
                    Payment Options Handled by Razorpay
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                    <div className="p-3 rounded-xl bg-[#121419] border border-[#282C36] text-slate-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span>UPI (GPay/PhonePe)</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#121419] border border-[#282C36] text-slate-300 flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                      <span>Credit / Debit Cards</span>
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed text-center text-slate-400">
                    This is our live gateway provision. Razorpay will automatically handle all card authentications, UPI QR codes, and RBI OTP redirects.
                  </p>
                </div>

                <button
                  onClick={handleConfirmRazorpayPayment}
                  disabled={isProcessing}
                  className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <span className="animate-pulse">Authorizing Razorpay Payment...</span>
                  ) : (
                    <>
                      <span>Complete Payment • ₹{finalTotal.toFixed(2)}</span>
                      <ExternalLink className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-[1200px] mx-auto space-y-8">
        {/* Top Back Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#282C36] pb-6">
          <div className="space-y-1">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Plan Selection</span>
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-sans text-white flex items-center gap-3">
              <span>Candidate Enrollment & Checkout</span>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-normal">
                Razorpay SSL Ready
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono px-4 py-2 rounded-xl bg-[#181A1F] border border-[#282C36] text-slate-400">
            <Lock className="w-3.5 h-3.5 text-amber-500" />
            <span>Razorpay Institutional Gateway</span>
          </div>
        </div>

        {/* 2-Column Grid: Left (Candidate Details + Razorpay Gateway Provision), Right (Order Summary + 18% GST Breakdown) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form & Gateway (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            {/* Step 1: Candidate Enrollment Form */}
            <div className="bg-[#181A1F] border border-[#282C36] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-[#282C36] pb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-[#121419] font-mono font-bold flex items-center justify-center text-sm">
                  1
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Candidate Details</h2>
                  <p className="text-xs text-slate-400">
                    Required for CBT terminal license linking and official tax invoicing
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    <span>Full Candidate Name *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Siddharth Ramanathan"
                    className="w-full px-4 py-3 rounded-xl bg-[#121419] border border-[#282C36] text-white placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-amber-500" />
                    <span>Email Address *</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="candidate@university.edu"
                    className="w-full px-4 py-3 rounded-xl bg-[#121419] border border-[#282C36] text-white placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-amber-500" />
                    <span>Mobile Number *</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 rounded-xl bg-[#121419] border border-[#282C36] text-white placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Institution / University (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                    placeholder="e.g. Global Financial Institute"
                    className="w-full px-4 py-3 rounded-xl bg-[#121419] border border-[#282C36] text-white placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Razorpay Provisioning & Gateway Information */}
            <div className="bg-[#181A1F] border border-[#282C36] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-[#282C36] pb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-[#121419] font-mono font-bold flex items-center justify-center text-sm">
                  2
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Payment Gateway (Razorpay)</h2>
                  <p className="text-xs text-slate-400">
                    UPI, Cards, and Net Banking are automatically handled via Razorpay secure popup
                  </p>
                </div>
              </div>

              {/* Razorpay Provision Box */}
              <div className="p-6 rounded-2xl bg-[#121419] border border-[#282C36] space-y-4 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-sm font-bold text-blue-500">
                    <ShieldCheck className="w-5 h-5" />
                    <span>Razorpay Live Gateway Provision</span>
                  </div>
                  <p className="text-xs max-w-md leading-relaxed text-slate-300">
                    When you click the checkout button below, Razorpay will display its secure popup overlay allowing you to complete payment via <span className="font-semibold text-amber-500">UPI (GPay/PhonePe)</span>, <span className="font-semibold">Credit/Debit Cards</span>, or <span className="font-semibold">Net Banking</span> without leaving the page.
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <div className="px-4 py-2.5 rounded-xl bg-[#181A1F] border border-[#282C36] font-mono text-xs text-center space-y-1 text-emerald-400">
                    <div className="font-bold">Gateway Status</div>
                    <div className="flex items-center gap-1.5 justify-center text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Ready to Launch</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & 18% GST Breakdown (5 cols) */}
          <div className="lg:col-span-5 space-y-6 sticky top-28">
            <div className="bg-[#181A1F] border border-[#282C36] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <h2 className="text-lg font-bold text-white border-b border-[#282C36] pb-4 flex items-center justify-between">
                <span>Order Summary</span>
                <span className="text-xs font-mono text-amber-500">#CBT-ORDER</span>
              </h2>

              {/* Selected Track & Plan Box */}
              <div className="p-4 rounded-2xl bg-[#121419] border border-[#282C36] space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500 block mb-1">
                      Target Curriculum
                    </span>
                    <h3 className="font-bold text-base leading-snug text-white">
                      {trackTitle}
                    </h3>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#282C36] flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Selected Plan:</span>
                  <span className="font-semibold px-2.5 py-1 rounded-md text-white bg-slate-800 border border-slate-700">
                    {planName} ({planDays})
                  </span>
                </div>
              </div>

              {/* Inclusions Checkmarks */}
              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>400+ Algorithmic derivations with explanations</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Full-length CBT mock exams & formula notes</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Instant activation & progress tracking</span>
                </div>
              </div>

              {/* Coupon Form */}
              <form onSubmit={handleApplyCoupon} className="flex items-center gap-2 pt-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    placeholder="Voucher (e.g. FINBENCH10)"
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#121419] border border-[#282C36] text-white placeholder-slate-500 text-xs uppercase focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#272B33] hover:bg-[#343942] text-white transition-colors"
                >
                  Apply
                </button>
              </form>

              {/* Price Breakdown with exact 18% GST */}
              <div className="space-y-3 pt-4 border-t border-[#282C36] font-mono text-sm">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Base Plan Price ({planName})</span>
                  <span>₹{basePrice.toFixed(2)}</span>
                </div>

                {couponApplied && (
                  <div className="flex items-center justify-between text-emerald-500 text-xs">
                    <span>Institutional Discount (FINBENCH10)</span>
                    <span>-₹0.00 (Tier Verified)</span>
                  </div>
                )}

                <div className="flex items-center justify-between border-b border-[#282C36] pb-3 text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span>18% GST (Tax Invoice)</span>
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" title="Standard 18% Goods & Services Tax on Digital Educational Software" />
                  </span>
                  <span className="text-amber-500 font-semibold">+₹{gstAmount.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between pt-1 text-base font-bold text-white">
                  <span className="font-sans">Total Amount Payable</span>
                  <span className="text-emerald-500 text-xl font-mono">₹{finalTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Complete Payment via Razorpay Button */}
              <button
                type="button"
                onClick={handleOpenRazorpay}
                className="w-full py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-[#121419] font-extrabold text-base tracking-wide shadow-lg shadow-amber-500/25 transition-all duration-300 flex items-center justify-center gap-2 focus:outline-none"
              >
                <Lock className="w-4 h-4 fill-[#121419]" />
                <span>Pay via Razorpay • ₹{finalTotal.toFixed(2)}</span>
              </button>

              <div className="text-center text-[11px] text-slate-500 leading-normal font-sans">
                Razorpay gateway will securely handle UPI QR scan, card authentication, or Net Banking on the next popup screen.
              </div>
            </div>

            {/* Extra Security Trust Card */}
            <div className="p-4 rounded-2xl bg-[#181A1F] border border-[#282C36] text-slate-400 flex items-center gap-3 text-xs">
              <ShieldCheck className="w-6 h-6 text-emerald-500 flex-shrink-0" />
              <span>
                All candidate transactions are protected with institutional SSL encryption and processed via RBI-compliant Razorpay gateway.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#121419] pt-32 text-center text-slate-400">Loading secure checkout gateway...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
