'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
  Tag,
  HelpCircle,
  X,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PLAN_PRICING, GST_RATE } from '@/constants/pricing';
import { getCourse } from '@/lib/firebase/db';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const planId = searchParams?.get('planId') || 'plan-30';
  const courseId = searchParams?.get('courseId') || 'nism-va-mock-test-series';
  
  const planData = PLAN_PRICING[planId] || PLAN_PRICING['plan-30'];
  const planName = planData.name;
  const planDays = `${planData.durationDays} Days Access`;
  
  // Base price is now strictly pulled from the local constant, ignoring any spoofed url params
  const basePrice = planData.price;
  const gstRate = GST_RATE;
  
  // We'll manage discount calculations dynamically based on validated coupons
  const [discountPercent, setDiscountPercent] = useState(0);
  
  const discountedPrice = basePrice * (1 - discountPercent / 100);
  const gstAmount = Math.round((discountedPrice * gstRate) * 100) / 100;
  const finalTotal = Math.round((discountedPrice + gstAmount) * 100) / 100;

  const { user } = useAuth();

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [org, setOrg] = useState('');
  const [coupon, setCoupon] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [formError, setFormError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState('');
  const [agreeLegal, setAgreeLegal] = useState(false);
  // True when money may have moved but we haven't confirmed entitlement yet —
  // shown instead of a false "success" or false "failure" message.
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  // Track the current Razorpay order to prevent double charges and enable recovery.
  // Also mirrored to sessionStorage so a page reload/close doesn't lose the
  // ability to reconcile a payment that succeeded but never confirmed in-browser.
  const currentOrderIdRef = useRef<string | null>(null);
  const isReconciling = useRef(false);
  const clickLock = useRef(false);

  const PENDING_ORDER_STORAGE_KEY = 'finbench_pending_order';

  const rememberPendingOrder = (orderId: string) => {
    currentOrderIdRef.current = orderId;
    try {
      sessionStorage.setItem(PENDING_ORDER_STORAGE_KEY, JSON.stringify({ orderId, planId, courseId, ts: Date.now() }));
    } catch {
      // sessionStorage unavailable (private mode etc.) — in-memory tracking still works for this tab session
    }
  };

  const forgetPendingOrder = () => {
    currentOrderIdRef.current = null;
    try {
      sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
    } catch {}
  };

  const [course, setCourse] = useState<any>(null);

  useEffect(() => {
    if (courseId) {
      getCourse(courseId).then(setCourse).catch(console.error);
    }
  }, [courseId]);

  // On mount, recover a pending order from a previous tab session (e.g. the
  // user closed the tab right after seeing "Too many requests") and silently
  // re-check its real status, instead of leaving them with no path back.
  useEffect(() => {
    if (!user) return;
    try {
      const raw = sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      if (saved?.orderId && saved.courseId === courseId && Date.now() - saved.ts < ONE_DAY_MS) {
        currentOrderIdRef.current = saved.orderId;
        setIsProcessing(true);
        reconcileOrderStatus(saved.orderId).then((result) => {
          if (result !== 'paid') {
            setPendingConfirmation(true);
            setIsProcessing(false);
          }
        });
      } else {
        sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, courseId]);

  // Auto-populate from Firebase Auth (not stale localStorage)
  useEffect(() => {
    if (user) {
      setName(user.displayName || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const validatePhone = (p: string) => /^[6-9]\d{9}$/.test(p.replace(/\s+/g, '').replace('+91', ''));

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    if (!coupon.trim()) return;
    
    setIsApplyingCoupon(true);
    try {
      const res = await fetch('/api/payments/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: coupon.trim().toUpperCase() })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setCouponApplied(true);
        setDiscountPercent(data.discountPercent || 0);
      } else {
        setCouponError(data.message || 'Invalid coupon code.');
      }
    } catch {
      setCouponError('Could not validate coupon. Please try again.');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  // Reconcile: ask the server to check the real order status directly with
  // Razorpay. If paid, the server grants entitlement itself (idempotently) —
  // the client never fabricates a signature. Returns the resolved state so
  // callers can decide what to show instead of this function guessing.
  const reconcileOrderStatus = useCallback(async (orderId: string): Promise<'paid' | 'not-paid' | 'error'> => {
    if (!user) return 'error';
    if (isReconciling.current) return 'error';
    isReconciling.current = true;
    try {
      const token = await user.getIdToken(true);
      const res = await fetch('/api/payments/check-order-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'paid') {
          // Server already confirmed with Razorpay directly and granted
          // entitlement (or found it already granted) — safe to show success.
          forgetPendingOrder();
          setCompletedOrderId(orderId);
          setOrderCompleted(true);
          setIsProcessing(false);
          setPendingConfirmation(false);
          return 'paid';
        }
        return 'not-paid';
      }
      return 'error';
    } catch {
      return 'error';
    } finally {
      isReconciling.current = false;
    }
  }, [user]);

  const handleOpenRazorpay = async (e: React.FormEvent) => {
    e.preventDefault();
    // Synchronous re-entrancy guard: closes the double-click race where a
    // second click can land before React commits the disabled button state.
    if (clickLock.current) return;
    clickLock.current = true;

    setFormError('');
    setPendingConfirmation(false);

    try {
      if (!name.trim() || !email.trim() || !phone.trim()) {
        setFormError('Please fill in your Name, Email, and Phone to proceed.');
        return;
      }
      if (!validatePhone(phone)) {
        setFormError('Please enter a valid 10-digit Indian mobile number.');
        return;
      }
      if (!agreeLegal) {
        setFormError('You must agree to the Terms and the Refund & Cancellation Policy to proceed.');
        return;
      }
      if (!user) {
        setFormError('Please sign in to complete your purchase.');
        return;
      }

      setIsProcessing(true);

      // Double-charge prevention: if we already have a tracked order, check
      // its real status before doing anything else.
      if (currentOrderIdRef.current) {
        const result = await reconcileOrderStatus(currentOrderIdRef.current);
        if (result === 'paid') return; // success screen already shown
        // 'not-paid' or 'error' — safe to proceed; create-order will
        // transparently reuse the same pending order if still fresh.
      }

      const token = await user.getIdToken(true);

      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ planId, courseId, couponCode: couponApplied ? coupon.trim().toUpperCase() : undefined })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');

      if (data.bypassed) {
        // 100% Discount was applied and access was granted directly by the server
        forgetPendingOrder();
        setIsProcessing(false);
        setCompletedOrderId(data.orderId || `BYPASS-${Math.floor(1000 + Math.random() * 9000)}`);
        setOrderCompleted(true);
        setTimeout(() => {
          router.push(`/dashboard/courses/${courseId}`);
        }, 2000);
        return;
      }

      const { order } = data;
      rememberPendingOrder(order.id);

      const rzp = new (window as any).Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: 'MyExams365',
        description: planName,
        handler: async (response: any) => {
          // Razorpay's own SDK reports success here — verify with the real,
          // signed response and grant access.
          try {
            const freshToken = await user.getIdToken(true);
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${freshToken}`
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                planId,
                courseId
              })
            });

            if (verifyRes.ok) {
              forgetPendingOrder();
              setCompletedOrderId(response.razorpay_order_id);
              setOrderCompleted(true);
              setPendingConfirmation(false);
              setIsProcessing(false);
              return;
            }
            const errData = await verifyRes.json().catch(() => ({}));
            console.error('Verify failed:', errData);
          } catch (verifyErr) {
            console.error('Verify call failed:', verifyErr);
          }
          // Razorpay's SDK said success but our verify call didn't confirm —
          // this is likely transient. Don't claim success or failure; the
          // order id stays tracked so reconciliation (or a page reload) can
          // resolve it, and the webhook is still in flight as a backstop.
          setPendingConfirmation(true);
          setIsProcessing(false);
        },
        prefill: { name, email, contact: phone.replace(/\s+/g, '') },
        theme: { color: '#F59E0B' },
        modal: {
          ondismiss: async () => {
            // User closed the popup — check if payment actually went through
            // before assuming it was abandoned cleanly.
            if (currentOrderIdRef.current) {
              const result = await reconcileOrderStatus(currentOrderIdRef.current);
              if (result !== 'paid') {
                setPendingConfirmation(true);
                setIsProcessing(false);
              }
            } else {
              setIsProcessing(false);
            }
          },
        },
      });

      // Handle SDK-reported failures — check real status before showing error
      rzp.on('payment.failed', async (failedResponse: any) => {
        console.warn('Razorpay SDK reported payment.failed:', failedResponse?.error?.description);
        // Don't trust the SDK — the payment may have actually succeeded (e.g. 429 rate limit)
        if (currentOrderIdRef.current) {
          // Wait a brief moment for Razorpay to process the payment on their end
          await new Promise(resolve => setTimeout(resolve, 2000));
          const result = await reconcileOrderStatus(currentOrderIdRef.current);
          if (result !== 'paid') {
            setPendingConfirmation(true);
            setIsProcessing(false);
          }
        } else {
          setIsProcessing(false);
        }
      });

      rzp.open();
    } catch (err: any) {
      setFormError(err.message || 'Payment initialization failed. Please try again.');
      setIsProcessing(false);
    } finally {
      clickLock.current = false;
    }
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
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 tabular-nums text-xs font-bold uppercase tracking-wider">
              Razorpay Verified • Order #{completedOrderId || `FB-${Math.floor(100000 + Math.random() * 900000)}`}
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-sans text-white">
              Enrollment Successful!
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Welcome aboard, <span className="font-semibold">{name}</span>. Your {planDays} package for <span className="text-amber-500 font-semibold">{course?.title || 'Certification Track'}</span> is now active.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#121419] border border-[#282C36] text-left space-y-3 tabular-nums text-xs text-slate-300">
            <div className="flex justify-between border-b border-[#282C36] pb-2">
              <span className="text-[#475569]">Candidate Email:</span>
              <span className="font-semibold">{email}</span>
            </div>
            <div className="flex justify-between border-b border-[#282C36] pb-2">
              <span className="text-[#475569]">Plan Duration:</span>
              <span className="text-amber-500 font-semibold">{planName} ({planDays})</span>
            </div>
            <div className="flex justify-between border-b border-[#282C36] pb-2">
              <span className="text-[#475569]">Total Paid (with 18% GST):</span>
              <span className="text-emerald-500 font-bold">₹{finalTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-[#475569]">GST Invoice status:</span>
              <span className="text-emerald-500 font-semibold">Dispatched via Email</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => router.push('/exams')}
              className="flex-1 py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#121419] font-bold text-sm tracking-wide shadow-md transition-all duration-200 active:scale-[0.98]"
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

  if (pendingConfirmation) {
    return (
      <div className="min-h-screen pt-28 pb-20 px-6 flex items-center justify-center bg-[#121419] text-[#FBFBF9]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl bg-[#181A1F] border border-[#282C36]"
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-500">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold font-sans text-white">
              Confirming Your Payment
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Razorpay reported an issue completing this checkout in your browser, but if money left your account, your access will still be granted automatically — this can take a few minutes.
            </p>
            <p className="text-sm leading-relaxed text-amber-400 font-semibold">
              Please do not pay again. We are not asking you to retry payment right now.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={async () => {
                if (currentOrderIdRef.current) {
                  setIsProcessing(true);
                  const result = await reconcileOrderStatus(currentOrderIdRef.current);
                  setIsProcessing(false);
                  if (result === 'paid') return;
                }
              }}
              disabled={isProcessing}
              className="flex-1 py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-[#121419] font-bold text-sm tracking-wide shadow-md transition-all duration-200 active:scale-[0.98]"
            >
              {isProcessing ? 'Checking…' : 'Check Payment Status Again'}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 py-3.5 px-6 rounded-xl font-semibold text-sm transition-colors bg-[#272B33] hover:bg-[#343942] text-white"
            >
              Go to Dashboard
            </button>
          </div>
          <p className="text-[11px] text-[#475569] leading-relaxed">
            If this doesn&apos;t resolve within 15–20 minutes, contact support with your registered email — do not attempt payment a second time.
          </p>
        </motion.div>
      </div>
    );
  }


  return (
    <div className="min-h-screen pt-24 pb-24 px-6 md:px-8 bg-[#121419] text-[#FBFBF9]">

      <div className="max-w-[1200px] mx-auto space-y-8">
        {/* Top Back Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#282C36] pb-6">
          <div className="space-y-1">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-xs tabular-nums text-[#475569] hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Plan Selection</span>
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-sans text-white flex items-center gap-3">
              <span>Candidate Enrollment & Checkout</span>
            </h1>
          </div>

        </div>

        {/* 2-Column Grid: Left (Candidate Details + Razorpay Gateway Provision), Right (Order Summary + 18% GST Breakdown) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form & Gateway (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            {/* Step 1: Candidate Enrollment Form */}
            <div className="bg-[#181A1F] border border-[#282C36] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-[#282C36] pb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-[#121419] tabular-nums font-bold flex items-center justify-center text-sm">
                  1
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Candidate Details</h2>
                  <p className="text-xs text-[#475569]">
                    Required for CBT terminal license linking and official tax invoicing
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label htmlFor="checkout-name" className="text-xs tabular-nums text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    <span>Full Candidate Name *</span>
                  </label>
                  <input
                    id="checkout-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Siddharth Ramanathan"
                    className="w-full px-4 py-3 rounded-xl bg-[#121419] border border-[#282C36] text-white placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="checkout-email" className="text-xs tabular-nums text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-amber-500" />
                    <span>Email Address *</span>
                  </label>
                  <input
                    id="checkout-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="candidate@university.edu"
                    className="w-full px-4 py-3 rounded-xl bg-[#121419] border border-[#282C36] text-white placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="checkout-phone" className="text-xs tabular-nums text-slate-300 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-amber-500" />
                    <span>Mobile Number *</span>
                  </label>
                  <input
                    id="checkout-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 rounded-xl bg-[#121419] border border-[#282C36] text-white placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="checkout-org" className="text-xs tabular-nums text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#475569]" />
                    <span>Institution / University (Optional)</span>
                  </label>
                  <input
                    id="checkout-org"
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
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-[#121419] tabular-nums font-bold flex items-center justify-center text-sm">
                  2
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Payment Gateway (Razorpay)</h2>
                  <p className="text-xs text-[#475569]">
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
                  <div className="px-4 py-2.5 rounded-xl bg-[#181A1F] border border-[#282C36] tabular-nums text-xs text-center space-y-1 text-emerald-400">
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
                <span className="text-xs tabular-nums text-amber-500">#CBT-ORDER</span>
              </h2>

              {/* Selected Track & Plan Box */}
              <div className="p-4 rounded-2xl bg-[#121419] border border-[#282C36] space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] tabular-nums font-bold uppercase tracking-wider text-amber-500 block mb-1">
                      Target Curriculum
                    </span>
                    <h3 className="font-bold text-base leading-snug text-white">
                      {course ? course.title : 'Loading Course Details...'}
                    </h3>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#282C36] flex items-center justify-between text-xs tabular-nums">
                  <span className="text-[#475569]">Selected Plan:</span>
                  <span className="font-semibold px-2.5 py-1 rounded-md text-white bg-slate-800 border border-slate-700">
                    {planName} ({planDays})
                  </span>
                </div>
              </div>

              {/* Inclusions Checkmarks */}
              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>{course?.mockCount || 0} Full-length CBT mock exams</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>{course?.notesCount || 0} PDF formula notes & derivations</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Instant activation & progress tracking</span>
                </div>
              </div>

              {/* Coupon Form */}
              <form onSubmit={handleApplyCoupon} className="flex items-center gap-2 pt-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 text-[#475569] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    placeholder="Voucher (e.g. FINBENCH10)"
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#121419] border border-[#282C36] text-white placeholder-slate-500 text-xs uppercase focus:border-amber-500 focus:outline-none tabular-nums"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isApplyingCoupon}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#272B33] hover:bg-[#343942] disabled:opacity-50 disabled:cursor-wait text-white transition-colors flex items-center justify-center min-w-[70px]"
                >
                  {isApplyingCoupon ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Apply'
                  )}
                </button>
              </form>
              
              {/* Show Coupon Error if any */}
              {couponError && (
                <div className="text-red-400 text-xs px-1">
                  {couponError}
                </div>
              )}

              {/* Price Breakdown with exact 18% GST */}
              <div className="space-y-3 pt-4 border-t border-[#282C36] tabular-nums text-sm">
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
                    <span title="Standard 18% Goods & Services Tax on Digital Educational Software" className="cursor-help inline-flex">
                      <HelpCircle className="w-3.5 h-3.5 text-[#475569]" />
                    </span>
                  </span>
                  <span className="text-amber-500 font-semibold">+₹{gstAmount.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between pt-1 text-base font-bold text-white">
                  <span className="font-sans">Total Amount Payable</span>
                  <span className="text-emerald-500 text-xl tabular-nums">₹{finalTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 mb-2">
                <input
                  type="checkbox"
                  id="checkout-legal"
                  checked={agreeLegal}
                  onChange={(e) => setAgreeLegal(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-[#282C36] bg-[#121419] checked:bg-amber-500 checked:border-amber-500 focus:ring-amber-500 focus:ring-offset-0 transition-colors shrink-0"
                />
                <label htmlFor="checkout-legal" className="text-xs text-[#475569] leading-relaxed">
                  I agree to the <Link href="/terms" className="text-amber-500 hover:underline">Terms of Service</Link> and the <Link href="/refunds" className="text-amber-500 hover:underline">Refund & Cancellation Policy</Link>. I understand that sales are final and access activates immediately upon payment.
                </label>
              </div>

              {/* Inline Form Error */}
              {formError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Complete Payment via Razorpay Button */}
              <button
                type="button"
                onClick={handleOpenRazorpay}
                disabled={isProcessing}
                className="w-full py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-[#121419] font-extrabold text-base tracking-wide shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none"
              >
                {isProcessing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#121419] border-t-transparent rounded-full animate-spin" />
                    <span>Connecting to Razorpay...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 fill-[#121419]" />
                    <span>Pay via Razorpay • ₹{finalTotal.toFixed(2)}</span>
                  </>
                )}
              </button>

              <div className="text-center text-[11px] text-[#475569] leading-normal font-sans">
                Razorpay gateway will securely handle UPI QR scan, card authentication, or Net Banking on the next popup screen.
              </div>
            </div>

            {/* Extra Security Trust Card */}
            <div className="p-4 rounded-2xl bg-[#181A1F] border border-[#282C36] text-[#475569] flex items-center gap-3 text-xs">
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
    <Suspense fallback={<div className="min-h-screen bg-[#121419] pt-32 text-center text-[#475569]">Loading secure checkout gateway...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
