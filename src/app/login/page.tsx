'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next-nprogress-bar';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, 
  Mail, 
  User, 
  Key, 
  ArrowRight,
  Building2,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  ChevronDown
} from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { useAuth } from '@/context/AuthContext';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { friendlyAuthError } from '@/lib/auth/authErrors';
import toast from 'react-hot-toast';

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const redirectUrl = searchParams?.get('redirect') || '/dashboard';
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [org, setOrg] = useState('');
  const [role, setRole] = useState<'student'>('student'); // always student, admin assigned manually

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [agreeLegal, setAgreeLegal] = useState(false);

  // Signup is two-step: 'form' collects details and requests a code,
  // 'otp' redeems it. No account exists until the code is redeemed.
  const [signupStep, setSignupStep] = useState<'form' | 'otp'>('form');
  const [otpCode, setOtpCode] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [isResendingOtp, setIsResendingOtp] = useState(false);

  // Password reset flow
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  
  const { user, loading } = useAuth();

  useEffect(() => {
    // If the user is already logged in, redirect based on role
    if (!loading && user) {
      if (user.role === 'admin' || user.role === 'editor') {
        router.push('/admin');
      } else {
        // Use explicit dashboard route or the redirectUrl search param, falling back to /dashboard
        const target = redirectUrl === '/' ? '/dashboard' : redirectUrl;
        router.push(target);
      }
    }
  }, [user, loading, router, redirectUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password || (activeTab === 'signup' && !name)) {
      setErrorMsg('Please fill in all required credentials.');
      return;
    }
    
    if (activeTab === 'signup' && !agreeLegal) {
      setErrorMsg('You must agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      localStorage.removeItem('myexams_session_id'); // FORCE new session on explicit login
      if (activeTab === 'signin') {
        // Sign In — useEffect handles role-based redirect
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Signup step 1: request a verification code. No Firebase account and
        // no Firestore document is created here — the account only comes into
        // existence in /api/auth/verify-otp once the emailed code is redeemed,
        // so an unreachable address can never produce an account.
        const res = await fetch('/api/auth/request-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorMsg(data.error || 'Could not send the verification code.');
          if (data.accountExists) setActiveTab('signin');
          setIsSubmitting(false);
          return;
        }
        setSignupStep('otp');
        setOtpCooldown(60);
        setIsSubmitting(false);
        toast.success(`Verification code sent to ${email.trim()}`);
        return;
      }
      toast.success('Login successful. Redirecting...');
      // We intentionally do not set isSubmitting(false) here so the button stays in the loading state until the redirect happens.
    } catch (error: any) {
      console.error("Auth error:", error);
      setErrorMsg(friendlyAuthError(error));
      setIsSubmitting(false);
    }
  };

  // Countdown for the "resend code" cooldown.
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (otpCode.trim().length !== 6) {
      setErrorMsg('Enter the 6-digit code from your email.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(), otp: otpCode.trim(), name, password, organization: org,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not verify the code.');
        if (data.accountExists) { setActiveTab('signin'); setSignupStep('form'); }
        setIsSubmitting(false);
        return;
      }
      // The account now exists and is already marked verified. Sign in to
      // establish the session; the redirect effect takes it from here.
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast.success('Account verified. Welcome aboard!');
    } catch (error: any) {
      console.error('OTP verify error:', error);
      setErrorMsg(friendlyAuthError(error));
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCooldown > 0 || isResendingOtp) return;
    setIsResendingOtp(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not resend the code.');
      } else {
        setOtpCooldown(60);
        toast.success('A new code is on its way.');
      }
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = resetEmail.trim();
    if (!target) return;

    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, target);
      setResetSent(true);
    } catch (error: any) {
      // Deliberately show the same confirmation whether or not an account
      // exists — reporting "no such user" would let anyone test which email
      // addresses are registered. Genuine faults (bad format, rate limit,
      // offline) are still surfaced, since those are the user's to fix.
      const code = error?.code;
      if (code === 'auth/user-not-found') {
        setResetSent(true);
      } else {
        toast.error(friendlyAuthError(error));
      }
      console.error('Password reset error:', error);
    } finally {
      setIsSendingReset(false);
    }
  };

  const openReset = () => {
    setResetEmail(email);
    setResetSent(false);
    setShowReset(true);
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('myexams_session_id');
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] flex items-center justify-center transition-colors duration-300">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // We removed the blocking "Authentication Confirmed" screen to prevent UI freezing
  // and instead use a toast notification and keep the loading button active.

  return (
    <div className="min-h-screen pt-24 pb-20 px-6 flex flex-col justify-between bg-slate-50 dark:bg-[#0B0C10] text-[#111B35] dark:text-[#FBFBF9] transition-colors duration-300">
      {/* Header bar with Back Button */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-4 pb-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs tabular-nums text-[#475569] hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return</span>
        </button>
      </div>

      {/* Main Authentication Box */}
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-7 sm:p-9 border border-slate-200 bg-white shadow-xl dark:border-[#282C36] dark:bg-[#181A1F] dark:shadow-black/40 transition-colors duration-300"
        >
          <div className="text-center space-y-2 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-500">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold font-sans tracking-tight text-[#111B35] dark:text-white">
              Candidate Portal Access
            </h1>
            <p className="text-xs font-sans text-[#475569] dark:text-[#94A3B8]">
              Please sign in or create your institutional account to proceed with your course enrollment and checkout.
            </p>
          </div>

              <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scaleY: 0.95 }}
                  animate={{ opacity: 1, y: 0, scaleY: 1 }}
                  exit={{ opacity: 0, y: -4, scaleY: 0.97 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="p-3 bg-red-50 border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/20 border dark:text-red-400 rounded-lg text-xs tabular-nums mb-4 text-center origin-top"
                >
                  {errorMsg}
                </motion.div>
              )}
            </AnimatePresence>
              {/* Tabs */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 border-slate-200 dark:bg-[#121419] border dark:border-[#282C36] mb-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('signin')}
                  className={`py-2 px-4 rounded-lg font-bold text-xs transition-all ${
                    activeTab === 'signin'
                      ? 'bg-white text-[#111B35] shadow-sm dark:bg-[#272B33] dark:text-white'
                      : 'text-[#475569] hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('signup')}
                  className={`py-2 px-4 rounded-lg font-bold text-xs transition-all ${
                    activeTab === 'signup'
                      ? 'bg-white text-[#111B35] shadow-sm dark:bg-[#272B33] dark:text-white'
                      : 'text-[#475569] hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-white'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Step 2 of signup: redeem the emailed code. Shown instead of the
                  form once a code has been sent. */}
              {activeTab === 'signup' && signupStep === 'otp' ? (
                <motion.form
                  key="otp-step"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleVerifyOtp}
                  className="space-y-5"
                >
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-500">
                      <Mail className="w-7 h-7" />
                    </div>
                    <h3 className="text-lg font-bold text-[#111B35] dark:text-white">Check your email</h3>
                    <p className="text-sm text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                      We sent a 6-digit code to<br />
                      <span className="font-semibold text-[#111B35] dark:text-white">{email.trim()}</span>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="otp-input" className="text-xs font-medium text-[#334155] dark:text-[#E2E8F0]">
                      Verification Code
                    </label>
                    <input
                      id="otp-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border-slate-200 text-[#111B35] dark:bg-[#121419] border dark:border-[#282C36] dark:text-white placeholder-slate-300 dark:placeholder-slate-600 text-center text-2xl font-bold tracking-[0.5em] font-mono focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    <p className="text-[11px] text-[#475569] dark:text-[#64748B] text-center pt-1">
                      The code expires in 10 minutes.
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                      {errorMsg}
                    </div>
                  )}

                  <LoadingButton
                    type="submit"
                    isLoading={isSubmitting}
                    loadingText="Verifying..."
                    className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-75 disabled:pointer-events-none text-[#111B35] font-bold text-sm shadow-[0_4px_14px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <span>Verify &amp; Create Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </LoadingButton>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => { setSignupStep('form'); setOtpCode(''); setErrorMsg(''); }}
                      className="text-[#475569] dark:text-[#94A3B8] hover:underline"
                    >
                      ← Change email
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={otpCooldown > 0 || isResendingOtp}
                      className="text-amber-600 dark:text-amber-500 hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed font-medium"
                    >
                      {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : isResendingOtp ? 'Sending...' : 'Resend code'}
                    </button>
                  </div>
                </motion.form>
              ) : (
              /* Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence mode="wait">
                  {activeTab === 'signup' && (
                    <motion.div
                      key="signup-name"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5 overflow-hidden"
                    >
                      <label className="text-xs tabular-nums font-medium text-[#334155] dark:text-[#E2E8F0]">
                        Full Candidate Name *
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Siddharth Ramanathan"
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-slate-200 text-[#111B35] dark:bg-[#121419] border dark:border-[#282C36] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-sans focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-1.5">
                  <label className="text-xs tabular-nums font-medium text-[#334155] dark:text-[#E2E8F0]">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="candidate@university.edu"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-slate-200 text-[#111B35] dark:bg-[#121419] border dark:border-[#282C36] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-sans focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs tabular-nums font-medium text-[#334155] dark:text-[#E2E8F0] flex justify-between">
                    <span>Password *</span>
                    {activeTab === 'signin' && (
                      <button
                        type="button"
                        onClick={openReset}
                        className="text-amber-600 dark:text-amber-500 hover:underline text-[11px] font-medium"
                      >
                        Forgot?
                      </button>
                    )}
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-slate-200 text-[#111B35] dark:bg-[#121419] border dark:border-[#282C36] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-sans focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>

                {activeTab === 'signup' && (
                  <>
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs tabular-nums font-medium text-[#334155] dark:text-[#E2E8F0]">
                        Institution / University (Optional)
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={org}
                          onChange={(e) => setOrg(e.target.value)}
                          placeholder="e.g. Global Institute of Finance"
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-slate-200 text-[#111B35] dark:bg-[#121419] border dark:border-[#282C36] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-sans focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
                        />
                      </div>
                    </div>
                  </>
                )}
                
                {activeTab === 'signup' && (
                  <div className="flex items-start gap-3 mt-4 mb-2">
                    <input
                      type="checkbox"
                      id="legal-agreement"
                      checked={agreeLegal}
                      onChange={(e) => setAgreeLegal(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-slate-300 bg-white dark:border-[#282C36] dark:bg-[#121419] checked:bg-amber-500 checked:border-amber-500 focus:ring-amber-500 focus:ring-offset-0 transition-colors"
                    />
                    <label htmlFor="legal-agreement" className="text-xs text-[#334155] dark:text-[#94A3B8] leading-relaxed">
                      I agree to the <Link href="/terms" className="text-amber-600 dark:text-amber-500 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-amber-600 dark:text-amber-500 hover:underline">Privacy Policy</Link>.
                    </label>
                  </div>
                )}

                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText={activeTab === 'signin' ? 'Signing In...' : 'Creating Account...'}
                  className="w-full mt-3 py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-75 disabled:pointer-events-none text-[#111B35] font-bold text-sm shadow-[0_4px_14px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 active:scale-[0.98]"
                >
                  <span>{activeTab === 'signin' ? 'Sign In & Proceed to Checkout' : 'Send Verification Code'}</span>
                  <ArrowRight className="w-4 h-4" />
                </LoadingButton>
              </form>
              )}

          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-[#282C36]/50 flex items-center justify-center gap-2 text-[11px] tabular-nums text-[#475569] dark:text-[#94A3B8]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
            <span>256-Bit SSL Encrypted Institutional Session</span>
          </div>
        </motion.div>
      </div>

      <div className="text-center text-xs tabular-nums text-[#475569] py-4">
        © {new Date().getFullYear()} MyExams365 CBT Portal. All rights reserved.
      </div>

      {/* Password reset */}
      <AnimatePresence>
        {showReset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowReset(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border bg-white border-slate-200 dark:bg-[#181A1F] dark:border-white/10 p-6 sm:p-7 shadow-2xl"
            >
              {resetSent ? (
                <div className="text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-[#111B35] dark:text-white">Check your inbox</h3>
                  <p className="text-sm leading-relaxed text-[#475569] dark:text-[#94A3B8]">
                    If an account exists for <span className="font-semibold text-[#111B35] dark:text-white">{resetEmail}</span>,
                    a password reset link is on its way. The link expires in about an hour.
                  </p>
                  <p className="text-[11px] text-[#475569] dark:text-[#64748B]">
                    Not seeing it after a few minutes? Check your spam folder.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowReset(false)}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#111B35] font-bold text-sm transition-colors active:scale-[0.98]"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendReset} className="space-y-5">
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-[#111B35] dark:text-white">Reset your password</h3>
                    <p className="text-sm text-[#475569] dark:text-[#94A3B8]">
                      Enter the email you registered with and we&apos;ll send you a link to set a new password.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="reset-email" className="text-xs font-medium text-[#334155] dark:text-[#E2E8F0]">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reset-email"
                        type="email"
                        required
                        autoFocus
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="candidate@university.edu"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm bg-slate-50 border-slate-200 text-[#111B35] dark:bg-[#121419] dark:border-[#282C36] dark:text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <LoadingButton
                      type="submit"
                      isLoading={isSendingReset}
                      loadingText="Sending..."
                      className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-75 disabled:pointer-events-none text-[#111B35] font-bold text-sm transition-all active:scale-[0.98]"
                    >
                      Send Reset Link
                    </LoadingButton>
                    <button
                      type="button"
                      onClick={() => setShowReset(false)}
                      className="flex-1 py-3 rounded-xl font-semibold text-sm transition-colors bg-slate-100 hover:bg-slate-200 text-[#334155] dark:bg-[#272B33] dark:hover:bg-[#343942] dark:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] pt-32 text-center text-[#475569]">Loading candidate login...</div>}>
      <LoginContent />
    </Suspense>
  );
}
