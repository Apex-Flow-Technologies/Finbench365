'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next-nprogress-bar';
import { auth, db } from '@/lib/firebase/config';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { getUserEntitlements } from '@/lib/firebase/db';
import toast from 'react-hot-toast';
import { 
  User, ShieldCheck, CreditCard, Lock, Phone, CheckCircle2, 
  Download, ArrowRight, Loader2, KeyRound, Sliders, Search, 
  Clock, FileText, DollarSign, UserCheck, UserX, AlertTriangle, 
  ShieldAlert, Sparkles, Layers, Check, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Top Roof Progress Bar State (YouTube / NProgress style)
  const [topLoading, setTopLoading] = useState(false);
  const [topProgress, setTopProgress] = useState(0);

  const triggerTopProgress = () => {
    setTopLoading(true);
    setTopProgress(15);
    setTimeout(() => setTopProgress(45), 150);
    setTimeout(() => setTopProgress(80), 350);
    setTimeout(() => setTopProgress(100), 550);
    setTimeout(() => {
      setTopLoading(false);
      setTopProgress(0);
    }, 850);
  };

  // ----------------------------------------------------
  // TAB 1: USER SETTINGS STATE
  // ----------------------------------------------------
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    targetExam: 'nism_va'
  });

  // Populate profile from Firebase Auth on mount
  useEffect(() => {
    if (user) {
      setProfile(prev => ({
        ...prev,
        fullName: user.displayName || '',
        email: user.email || '',
      }));
    }
  }, [user]);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Was hardcoded at 85% for everyone, including users who had filled nothing in.
  const profileCompletion = Math.round(
    ([profile.fullName, profile.email, profile.phone, profile.targetExam]
      .filter((v) => Boolean(v && String(v).trim())).length / 4) * 100
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    triggerTopProgress();
    setIsSavingProfile(true);
    try {
      // Update Firebase Auth displayName
      await updateProfile(auth.currentUser, { displayName: profile.fullName });
      // Update Firestore user document
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        name: profile.fullName,
        phone: profile.phone,
        targetExam: profile.targetExam,
        updatedAt: serverTimestamp()
      });
      setProfileSuccess(true);
      toast.success('Profile saved successfully!');
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      toast.error('Failed to save profile: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // The signed-in user's real course access, replacing hardcoded placeholders.
  const [myEntitlements, setMyEntitlements] = useState<any[]>([]);
  const [entitlementsLoading, setEntitlementsLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    getUserEntitlements(user.uid)
      .then((list) => {
        if (cancelled) return;
        const now = Date.now();
        setMyEntitlements(list.map((e: any) => ({
          courseId: e.courseId,
          title: e.course?.title || e.courseId,
          expiresAt: e.expiresAt,
          durationDays: e.durationDays || 0,
          isActive: e.isActive,
          daysLeft: Math.max(0, Math.ceil((e.expiresAt.getTime() - now) / 86400000)),
        })));
      })
      .catch((err) => console.error('Could not load entitlements:', err))
      .finally(() => { if (!cancelled) setEntitlementsLoading(false); });
    return () => { cancelled = true; };
  }, [user?.uid]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-indigo-500 selection:text-white transition-colors duration-300 pb-24 relative overflow-hidden">
        
        {/* TOP ROOF PROGRESS BAR (YouTube / NProgress style) */}
        <AnimatePresence>
          {topLoading && (
            <motion.div
              initial={{ width: '0%', opacity: 1 }}
              animate={{ width: `${topProgress}%`, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ ease: 'easeInOut', duration: 0.3 }}
              className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-400 shadow-[0_0_12px_#F59E0B] z-50 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Ambient Dark Glass Background Glows */}
        <div className="absolute top-1/4 left-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 right-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 py-8 space-y-8 relative z-10">

          {/* Page Header */}
          <div className="border-b border-white/10 pb-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <User className="w-8 h-8 text-amber-500" />
              Account &amp; User Settings
            </h1>
            <p className="text-[#475569] text-sm mt-1">
              Manage your personal candidate profile, target exam series, and subscription entitlements.
            </p>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: USER SETTINGS CONTAINER */}
          {/* ========================================================================= */}
          <motion.div
              key="user-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* 1. Profile & Contact Details Card */}
                <div className="lg:col-span-2 backdrop-blur-md bg-zinc-900/80 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl relative group">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2.5 font-bold text-lg text-white">
                      <User className="w-5 h-5 text-indigo-400" />
                      1. Profile & Contact Information
                    </div>
                    <span className="text-xs tabular-nums text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">
                      {profileCompletion}% Complete
                    </span>
                  </div>

                  {/* Profile Completion Gauge */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs tabular-nums text-[#475569]">
                      <span>Profile Setup Meter</span>
                      <span>{profileCompletion}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${profileCompletion}%` }}
                      />
                    </div>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#475569] uppercase tracking-wider">Full Name</label>
                        <input
                          type="text"
                          value={profile.fullName}
                          onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors font-medium"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#475569] uppercase tracking-wider">Email Address</label>
                        <div className="relative">
                          <input
                            type="email"
                            value={profile.email}
                            disabled
                            className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-[#475569] text-sm cursor-not-allowed tabular-nums"
                          />
                          <span className="absolute right-3 top-3 text-[10px] tabular-nums font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                            VERIFIED
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#475569] uppercase tracking-wider">Phone Number (+91)</label>
                        <input
                          type="tel"
                          value={profile.phone}
                          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                          pattern="^[6-9]\d{9}$"
                          title="Enter a valid 10-digit Indian mobile number (starts with 6-9)"
                          placeholder="+91 98765 43210"
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 tabular-nums transition-colors"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#475569] uppercase tracking-wider">Target Exam Select</label>
                        <select
                          value={profile.targetExam}
                          onChange={(e) => setProfile({ ...profile, targetExam: e.target.value })}
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                        >
                          <option value="nism_va">NISM Series V-A: Mutual Fund Distributors</option>
                          <option value="nism_xa">NISM Series X-A: Investment Adviser Level 1</option>
                          <option value="cfa_l1">CFA® Level I Examination</option>
                          <option value="frm_p1">FRM® Part I Examination</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSavingProfile ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Saving Changes...</>
                        ) : profileSuccess ? (
                          <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Profile Updated!</>
                        ) : (
                          'Save Profile Changes'
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* 2. Active Subscription Card */}
                {/* Real entitlements. This card previously displayed hardcoded
                    values — "Tier 2 — NISM V-A Pro Pack", "42 Days Left",
                    "Expires: 15 Oct 2026", a 70% progress bar — to every user
                    regardless of what they had actually bought, and its
                    Extend button only animated a progress bar. */}
                <div className="backdrop-blur-md bg-zinc-900/80 border border-white/10 rounded-2xl p-6 space-y-5 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2 font-bold text-white text-base">
                      <CreditCard className="w-5 h-5 text-amber-500" />
                      Your Access
                    </div>
                    {myEntitlements.some((e) => e.isActive) && (
                      <span className="px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold tabular-nums">
                        ● ACTIVE
                      </span>
                    )}
                  </div>

                  {entitlementsLoading ? (
                    <div className="h-20 rounded-xl bg-white/5 animate-pulse" />
                  ) : myEntitlements.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-[#94A3B8]">You have no active course access.</p>
                      <button
                        onClick={() => router.push('/exams')}
                        className="mt-4 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-colors"
                      >
                        Browse courses
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {myEntitlements.map((e) => {
                        const pct = e.durationDays > 0
                          ? Math.max(0, Math.min(100, Math.round((e.daysLeft / e.durationDays) * 100)))
                          : 0;
                        return (
                          <div key={e.courseId} className="space-y-2">
                            <div className="text-sm font-bold text-white">{e.title}</div>
                            <div className="flex justify-between text-xs tabular-nums text-[#94A3B8]">
                              <span>Access clock</span>
                              <span className={e.isActive ? 'text-amber-400 font-bold' : 'text-red-400 font-bold'}>
                                {e.isActive ? `${e.daysLeft} day${e.daysLeft === 1 ? '' : 's'} left` : 'Expired'}
                              </span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/5">
                              <div
                                className={`h-full rounded-full ${e.isActive ? 'bg-gradient-to-r from-amber-500 to-indigo-500' : 'bg-red-500/60'}`}
                                style={{ width: `${e.isActive ? pct : 100}%` }}
                              />
                            </div>
                            <div className="text-[11px] text-[#94A3B8] tabular-nums text-right">
                              {e.expiresAt
                                ? `${e.isActive ? 'Expires' : 'Expired'}: ${e.expiresAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                : ''}
                            </div>
                            <button
                              onClick={() => router.push(`/pricing?courseId=${e.courseId}`)}
                              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                              <span>{e.isActive ? 'Extend access' : 'Renew access'}</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* 3. Purchase History Table */}
              <div className="backdrop-blur-md bg-zinc-900/80 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2.5 font-bold text-lg text-white">
                    <CreditCard className="w-5 h-5 text-amber-500" />
                    Purchase History & GST Invoices
                  </div>
                  <span className="text-xs tabular-nums text-[#475569]">
                    INR (₹) Billing Records
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs tabular-nums text-[#475569] uppercase">
                        <th className="pb-3 px-4">Invoice ID</th>
                        <th className="pb-3 px-4">Date</th>
                        <th className="pb-3 px-4">Plan Name</th>
                        <th className="pb-3 px-4">Amount (INR)</th>
                        <th className="pb-3 px-4">Tax Breakdown</th>
                        <th className="pb-3 px-4">Status</th>
                        <th className="pb-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {/* `invoices` was a hardcoded empty array, so this table
                          rendered headers above nothing, with no empty state and
                          a download button that only raised a toast. Invoices are
                          emailed on purchase, so point the user at that rather
                          than implying an in-app archive that does not exist. */}
                      <tr>
                        <td colSpan={7} className="py-10 text-center">
                          <p className="text-sm text-[#94A3B8]">
                            Your GST invoice is emailed to you each time you buy or renew a course.
                          </p>
                          <p className="text-xs text-[#475569] mt-1.5">
                            Can&apos;t find one? Email{' '}
                            <a href="mailto:support@myexams365.com" className="text-amber-500 hover:underline">
                              support@myexams365.com
                            </a>{' '}
                            and we&apos;ll resend it.
                          </p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Legal Links Footer */}
              <footer className="backdrop-blur-md bg-zinc-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="text-xs tabular-nums text-[#475569]">
                    Protected under Digital Personal Data Protection (DPDP) Act 2023
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs font-semibold text-[#475569]">
                    <a href="/terms" className="hover:text-amber-400 transition-colors">Terms of Service</a>
                    <a href="/privacy" className="hover:text-amber-400 transition-colors">Privacy Policy</a>
                    <a href="/refunds" className="hover:text-amber-400 transition-colors">Refund Policy</a>
                    <a href="/disclaimer" className="hover:text-amber-400 transition-colors">NISM Disclaimer</a>
                  </div>
                </div>
                <p className="text-[11px] text-[#475569] leading-relaxed">
                  MyExams365 is an independent financial examination simulator. NISM® is a registered trademark of the National Institute of Securities Markets. MyExams365 is not affiliated with or endorsed by NISM or SEBI.
                </p>
              </footer>
            </motion.div>
          {/* The admin tab was removed from this student-facing page. User
              management now lives entirely in /admin/students, which can do
              the whole job — this tab could suspend but not change roles,
              while /admin/users could change roles but not suspend. */}

        </div>
      </div>
    </ProtectedRoute>
  );
}
