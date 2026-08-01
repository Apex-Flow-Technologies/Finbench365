'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MailWarning, CheckCircle2, Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { sendEmailVerification } from 'firebase/auth';
import { friendlyAuthError } from '@/lib/auth/authErrors';
import toast from 'react-hot-toast';

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Prompts a candidate to confirm their email address.
 *
 * Deliberately a banner rather than a hard block: enrolment and the GST invoice
 * are emailed, so an unverified address is a real problem worth surfacing — but
 * locking someone out of content they have already paid for because a message
 * landed in spam would be worse than the problem it solves.
 */
export function EmailVerificationBanner() {
  const [visible, setVisible] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [justVerified, setJustVerified] = useState(false);

  // Firebase caches emailVerified on the local user object, so a candidate who
  // clicks the link in another tab still looks unverified here until reloaded.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        await user.reload();
      } catch {
        // Offline or token expired — fall back to the cached flag.
      }
      if (!cancelled) setVisible(!auth.currentUser?.emailVerified);
    };
    check();

    // Catch verification completed in another tab while this one is open.
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    const user = auth.currentUser;
    if (!user || cooldown > 0) return;
    setIsSending(true);
    try {
      await sendEmailVerification(user);
      toast.success(`Verification email sent to ${user.email}`);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setIsSending(false);
    }
  };

  const handleCheck = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setIsSending(true);
    try {
      await user.reload();
      if (auth.currentUser?.emailVerified) {
        setJustVerified(true);
        setTimeout(() => setVisible(false), 1800);
      } else {
        toast('Not verified yet — open the link in the email we sent.', { icon: '📩' });
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden mb-6"
        >
          {justVerified ? (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="text-sm font-semibold">Email verified — thank you.</span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25">
              <MailWarning className="w-5 h-5 shrink-0 text-amber-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#111B35] dark:text-white">
                  Confirm your email address
                </p>
                <p className="text-xs mt-0.5 text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                  Your enrolment confirmation and GST invoice are sent to{' '}
                  <span className="font-medium">{auth.currentUser?.email}</span>. Verify it so nothing gets lost.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleResend}
                  disabled={isSending || cooldown > 0}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#111B35] transition-colors flex items-center gap-1.5"
                >
                  {isSending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
                </button>
                <button
                  onClick={handleCheck}
                  disabled={isSending}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors bg-slate-100 hover:bg-slate-200 text-[#334155] dark:bg-white/10 dark:hover:bg-white/20 dark:text-white disabled:opacity-50"
                >
                  I&apos;ve verified
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
