'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebase/config';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { updateUserRole } from '@/lib/firebase/db';
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

  // Active Tab State
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');

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

  const handleTabSwitch = (tab: 'user' | 'admin') => {
    if (tab === activeTab) return;
    triggerTopProgress();
    setActiveTab(tab);
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

  // Invoices & Billing State
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);

  // Real invoices are fetched from Firestore enrolledCourses payment records
  const invoices: any[] = []; // Will be populated from Firestore in a future iteration

  const handleDownloadInvoice = (invId: string) => {
    toast('Invoice generation is being set up. Please contact support@myexams365.com for your GST invoice.', {
      icon: '📄',
      duration: 5000,
    });
  };

  // ----------------------------------------------------
  // TAB 2: ADMIN CONTROLS STATE
  // ----------------------------------------------------
  // Feature Flags State
  const [featureFlags, setFeatureFlags] = useState({
    pdfExport: true,
    excelMetrics: true,
    serverTimers: true,
    rateLimiting: true,
    aiExplainer: false
  });

  const handleToggleFlag = async (key: keyof typeof featureFlags) => {
    const newValue = !featureFlags[key];
    setFeatureFlags(prev => ({ ...prev, [key]: newValue }));
    try {
      await updateDoc(doc(db, 'config', 'featureFlags'), {
        [key]: newValue,
        updatedAt: serverTimestamp()
      });
      toast.success(`Feature flag "${key}" ${newValue ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      // Revert on failure
      setFeatureFlags(prev => ({ ...prev, [key]: !newValue }));
      toast.error('Failed to update feature flag.');
    }
  };

  // Tier Pricing Matrix State (INR ₹)
  const [pricing, setPricing] = useState({ tier1: '999', tier2: '1499', tier3: '2499' });
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [pricingSaved, setPricingSaved] = useState(false);

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerTopProgress();
    setIsSavingPricing(true);
    try {
      await updateDoc(doc(db, 'config', 'pricing'), {
        tier1: Number(pricing.tier1),
        tier2: Number(pricing.tier2),
        tier3: Number(pricing.tier3),
        updatedAt: serverTimestamp()
      });
      setPricingSaved(true);
      toast.success('Pricing updated successfully!');
      setTimeout(() => setPricingSaved(false), 2500);
    } catch (err: any) {
      toast.error('Failed to save pricing: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingPricing(false);
    }
  };

  // User Management — load real users from Firestore
  const [userSearch, setUserSearch] = useState('');
  const [managedUsers, setManagedUsers] = useState<any[]>([]);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  const isAdminUser = user?.role === 'admin' || user?.role === 'editor';

  useEffect(() => {
    if (!isAdminUser) return;
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setManagedUsers(snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || 'Unknown',
        email: d.data().email || '',
        role: d.data().role || 'student',
        status: d.data().suspended ? 'Suspended' : 'Active',
        enrolledCourses: d.data().enrolledCourses || {}
      })));
    });
    return () => unsub();
  }, [isAdminUser]);

  const handleToggleUserStatus = async (id: string, currentStatus: string) => {
    setTogglingUserId(id);
    try {
      const isSuspended = currentStatus === 'Suspended';
      await updateDoc(doc(db, 'users', id), {
        suspended: !isSuspended,
        updatedAt: serverTimestamp()
      });
      toast.success(`User ${isSuspended ? 'reactivated' : 'suspended'} successfully.`);
    } catch (err: any) {
      toast.error('Failed to update user status.');
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleGrantDays = async (id: string, days: number) => {
    // Grant additional days — requires knowing which course; log for now
    toast('To grant days, use the Admin Users page to update enrollment directly.', { icon: 'ℹ️' });
  };

  const filteredUsers = managedUsers.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );



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
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-6">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <User className="w-8 h-8 text-amber-500" />
                {isAdminUser && activeTab === 'admin' ? 'Admin Platform Controls' : 'Account & User Settings'}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                {isAdminUser && activeTab === 'admin'
                  ? 'Manage candidate entitlements, feature flags, tier pricing, and anti-tampering rules.'
                  : 'Manage your personal candidate profile, target exam series, and subscription entitlements.'}
              </p>
            </div>

            {/* Tab Switcher - Only visible if user has Admin or Editor role */}
            {isAdminUser && (
              <div className="flex p-1.5 bg-zinc-900/90 border border-white/10 rounded-2xl backdrop-blur-md shadow-lg">
                <button
                  onClick={() => handleTabSwitch('user')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 ${
                    activeTab === 'user'
                      ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>User Settings</span>
                </button>

                <button
                  onClick={() => handleTabSwitch('admin')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 ${
                    activeTab === 'admin'
                      ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  <span>Admin Controls</span>
                  <span className="ml-1 px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black uppercase font-mono rounded">
                    SUPER
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: USER SETTINGS CONTAINER */}
          {/* ========================================================================= */}
          {activeTab === 'user' && (
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
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">
                      85% Complete
                    </span>
                  </div>

                  {/* Profile Completion Gauge */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono text-slate-400">
                      <span>Profile Setup Meter</span>
                      <span>85%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full w-[85%] transition-all duration-500" />
                    </div>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                        <input
                          type="text"
                          value={profile.fullName}
                          onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors font-medium"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                        <div className="relative">
                          <input
                            type="email"
                            value={profile.email}
                            disabled
                            className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-slate-400 text-sm cursor-not-allowed font-mono"
                          />
                          <span className="absolute right-3 top-3 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                            VERIFIED
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone Number (+91)</label>
                        <input
                          type="tel"
                          value={profile.phone}
                          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                          pattern="^[6-9]\d{9}$"
                          title="Enter a valid 10-digit Indian mobile number (starts with 6-9)"
                          placeholder="+91 98765 43210"
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Exam Select</label>
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
                <div className="backdrop-blur-md bg-zinc-900/80 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2 font-bold text-white text-base">
                      <CreditCard className="w-5 h-5 text-amber-500" />
                      Active Subscription
                    </div>
                    <span className="px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold font-mono">
                      ● LIVE
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-slate-400 font-mono uppercase tracking-wider">Current Tier Package</div>
                      <div className="text-lg font-extrabold text-white mt-1">
                        Tier 2 — NISM V-A Pro Pack
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono text-slate-400">
                        <span>Access Clock</span>
                        <span className="text-amber-400 font-bold">42 Days Left</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/5">
                        <div className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 rounded-full w-[70%]" />
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono text-right">Expires: 15 Oct 2026</div>
                    </div>

                    <button
                      onClick={triggerTopProgress}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95 flex items-center justify-center gap-2"
                    >
                      <span>Extend / Renew Access</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>

              {/* 3. Purchase History Table */}
              <div className="backdrop-blur-md bg-zinc-900/80 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2.5 font-bold text-lg text-white">
                    <CreditCard className="w-5 h-5 text-amber-500" />
                    Purchase History & GST Invoices
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    INR (₹) Billing Records
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs font-mono text-slate-400 uppercase">
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
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-4 px-4 font-mono font-bold text-white text-xs">{inv.id}</td>
                          <td className="py-4 px-4 text-slate-400 text-xs font-mono">{inv.date}</td>
                          <td className="py-4 px-4 font-semibold text-slate-200 text-sm">{inv.plan}</td>
                          <td className="py-4 px-4 font-mono font-bold text-amber-400 text-sm">{inv.amount}</td>
                          <td className="py-4 px-4 font-mono text-slate-400 text-xs">{inv.gst}</td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold">
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => handleDownloadInvoice(inv.id)}
                              disabled={downloadingId === inv.id}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white/10 hover:bg-amber-500 hover:text-slate-950 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            >
                              {downloadingId === inv.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : downloadSuccessId === inv.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              <span>{downloadSuccessId === inv.id ? 'Downloaded' : 'Download PDF'}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Legal Links Footer */}
              <footer className="backdrop-blur-md bg-zinc-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="text-xs font-mono text-slate-400">
                    Protected under Digital Personal Data Protection (DPDP) Act 2023
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-400">
                    <a href="/terms" className="hover:text-amber-400 transition-colors">Terms of Service</a>
                    <a href="/privacy" className="hover:text-amber-400 transition-colors">Privacy Policy</a>
                    <a href="/refunds" className="hover:text-amber-400 transition-colors">Refund Policy</a>
                    <a href="/disclaimer" className="hover:text-amber-400 transition-colors">NISM Disclaimer</a>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  MyExams365 is an independent financial examination simulator. NISM® is a registered trademark of the National Institute of Securities Markets. MyExams365 is not affiliated with or endorsed by NISM or SEBI.
                </p>
              </footer>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: ADMIN CONTROLS CONTAINER */}
          {/* ========================================================================= */}
          {activeTab === 'admin' && (
            <motion.div
              key="admin-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {/* 1. Feature Flag Configurator */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Feature Toggles Grid */}
                <div className="backdrop-blur-md bg-zinc-900/80 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2.5 font-bold text-lg text-white">
                      <Sliders className="w-5 h-5 text-amber-500" />
                      1. Interactive Feature Flags
                    </div>
                    <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded font-bold">
                      Platform Rules
                    </span>
                  </div>

                  <div className="space-y-4">
                    {[
                      { key: 'pdfExport' as const, label: 'PDF Export & Study Downloads', desc: 'Allow candidates to download flat PDF materials.' },
                      { key: 'excelMetrics' as const, label: 'Excel Score Metrics', desc: 'Enable downloadable CSV/XLSX analytics reports.' },
                      { key: 'serverTimers' as const, label: 'Server-Authoritative Timers', desc: 'Force CBT timer sync with Firebase Cloud Timestamp.' },
                      { key: 'rateLimiting' as const, label: 'API Rate Limiting Guard', desc: 'Restrict submit endpoints to 60 requests/minute.' },
                      { key: 'aiExplainer' as const, label: 'AI Question Explainer', desc: 'Automated solution breakdowns for mock exam MCQs.' },
                    ].map((flag) => {
                      const isActive = featureFlags[flag.key];
                      return (
                        <div key={flag.key} className="flex items-center justify-between p-4 bg-slate-900/90 border border-white/10 rounded-xl">
                          <div>
                            <div className="font-bold text-white text-sm">{flag.label}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{flag.desc}</div>
                          </div>
                          <button
                            onClick={() => handleToggleFlag(flag.key)}
                            className={`relative inline-flex items-center h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                              isActive ? 'bg-emerald-500' : 'bg-slate-700'
                            }`}
                          >
                            <span className={`inline-block h-5 w-5 rounded-full bg-white transform transition duration-200 ease-in-out ${
                              isActive ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pricing Matrix Configurator */}
                <div className="backdrop-blur-md bg-zinc-900/80 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2.5 font-bold text-lg text-white">
                      <DollarSign className="w-5 h-5 text-amber-500" />
                      2. Tier Pricing Matrix (INR ₹)
                    </div>
                    <span className="text-xs font-mono text-slate-400">18% GST Excl.</span>
                  </div>

                  <form onSubmit={handleSavePricing} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase">Tier 1: Starter Pack (INR ₹)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-slate-400 font-bold text-sm">₹</span>
                        <input
                          type="number"
                          value={pricing.tier1}
                          onChange={(e) => setPricing({ ...pricing, tier1: e.target.value })}
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase">Tier 2: NISM V-A Pro Pack (INR ₹)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-slate-400 font-bold text-sm">₹</span>
                        <input
                          type="number"
                          value={pricing.tier2}
                          onChange={(e) => setPricing({ ...pricing, tier2: e.target.value })}
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase">Tier 3: Institutional Suite (INR ₹)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-slate-400 font-bold text-sm">₹</span>
                        <input
                          type="number"
                          value={pricing.tier3}
                          onChange={(e) => setPricing({ ...pricing, tier3: e.target.value })}
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSavingPricing}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSavingPricing ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Saving Rates...</>
                        ) : pricingSaved ? (
                          <><CheckCircle2 className="w-4 h-4" /> Rates Saved!</>
                        ) : (
                          'Save Pricing Matrix'
                        )}
                      </button>
                    </div>
                  </form>
                </div>

              </div>

              {/* 2. Candidate User Search & Entitlement Actions */}
              <div className="backdrop-blur-md bg-zinc-900/80 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2.5 font-bold text-lg text-white">
                    <UserCheck className="w-5 h-5 text-amber-500" />
                    3. Candidate Search & User Entitlement Actions
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search name or email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="bg-slate-900/90 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500 w-full sm:w-64"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs font-mono text-slate-400 uppercase">
                        <th className="pb-3 px-4">Candidate</th>
                        <th className="pb-3 px-4">Role</th>
                        <th className="pb-3 px-4">Days Left</th>
                        <th className="pb-3 px-4">Status</th>
                        <th className="pb-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {filteredUsers.map((usr) => (
                        <tr key={usr.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-4 px-4">
                            <div>
                              <div className="font-bold text-white text-sm">{usr.name}</div>
                              <div className="text-xs text-slate-400 font-mono">{usr.email}</div>
                            </div>
                          </td>
                          <td className="py-4 px-4 font-mono text-xs font-bold text-indigo-400">{usr.role}</td>
                          <td className="py-4 px-4 font-mono text-xs text-amber-400 font-bold">{usr.daysLeft} days</td>
                          <td className="py-4 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                              usr.status === 'Active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {usr.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleGrantAccessExtension(usr.id, 15)}
                                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all"
                              >
                                +15 Days
                              </button>
                              <button
                                onClick={() => handleGrantAccessExtension(usr.id, 30)}
                                className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-bold transition-all"
                              >
                                +30 Days
                              </button>
                              <button
                                onClick={() => handleToggleUserStatus(usr.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  usr.status === 'Active'
                                    ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                }`}
                              >
                                {usr.status === 'Active' ? 'Suspend' : 'Activate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}
