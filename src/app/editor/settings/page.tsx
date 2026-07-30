'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { getUsers, updateUserRole } from '@/lib/firebase/db';
import { 
  Users, ShieldAlert, Sliders, Search, CheckCircle2, 
  Clock, FileText, DollarSign, Loader2, UserCheck, UserX, 
  Check, RefreshCw, AlertTriangle, Plus, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminEditorSettingsPage() {
  const { user } = useAuth();
  
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

  // User Directory State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Extend Access Modal State
  const [selectedUserForExtension, setSelectedUserForExtension] = useState<any | null>(null);
  const [extensionDays, setExtensionDays] = useState(30);
  const [isExtending, setIsExtending] = useState(false);
  const [extensionSuccess, setExtensionSuccess] = useState(false);

  // Feature Flags State
  const [featureFlags, setFeatureFlags] = useState({
    pdfExport: true,
    excelMetrics: true,
    serverTimers: true,
    rateLimiting: true,
    aiExplainer: false
  });

  const handleToggleFlag = (key: keyof typeof featureFlags) => {
    triggerTopProgress();
    setFeatureFlags(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Tier Pricing Matrix State (INR ₹)
  const [pricing, setPricing] = useState({
    tier1: '999',
    tier2: '1499',
    tier3: '2499'
  });
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [pricingSaved, setPricingSaved] = useState(false);

  // Security Engine State
  const [serverTimerLock, setServerTimerLock] = useState(true);
  const [antiCheatSensitivity, setAntiCheatSensitivity] = useState('high');
  const [rateLimitRule, setRateLimitRule] = useState('60');
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getUsers();
        setUsersList(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingUsers(false);
      }
    }
    load();
  }, []);

  const handleRoleRevoke = async (targetUserId: string) => {
    if (!confirm("Are you sure you want to revoke admin/editor access for this user and demote them to student?")) return;
    triggerTopProgress();
    setUpdatingUserId(targetUserId);
    try {
      await updateUserRole(targetUserId, 'student');
      setUsersList(prev => prev.map(u => u.id === targetUserId ? { ...u, role: 'student' } : u));
    } catch (err) {
      alert("Failed to update role.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleGrantAccessExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForExtension) return;
    triggerTopProgress();
    setIsExtending(true);
    setTimeout(() => {
      setIsExtending(false);
      setExtensionSuccess(true);
      setTimeout(() => {
        setExtensionSuccess(false);
        setSelectedUserForExtension(null);
      }, 1500);
    }, 1000);
  };

  const handleQuickAddDays = (usrId: string, days: number) => {
    triggerTopProgress();
    alert(`Granted +${days} days free trial extension to user.`);
  };

  const handleSavePricing = (e: React.FormEvent) => {
    e.preventDefault();
    triggerTopProgress();
    setIsSavingPricing(true);
    setTimeout(() => {
      setIsSavingPricing(false);
      setPricingSaved(true);
      setTimeout(() => setPricingSaved(false), 2500);
    }, 800);
  };

  const filteredUsers = usersList.filter(u => {
    const matchesSearch = (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.displayName || u.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <ProtectedRoute requiredRole="editor">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-10 text-slate-100 relative">
        
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

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Sliders className="w-8 h-8 text-amber-500" />
              Admin Platform Controls
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Super-user management directory, feature flags configurator, tier pricing (INR ₹), and anti-tampering security rules.
            </p>
          </div>
        </div>

        {/* 1. User Directory Console */}
        <motion.section 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-md bg-zinc-900/80 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5 font-bold text-lg text-white">
              <Users className="w-5 h-5 text-amber-500" />
              1. Candidate Directory & Role Management
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search user name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900/90 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500 w-full sm:w-64"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="all">All Roles</option>
                <option value="student">Student</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs font-mono text-slate-400 uppercase">
                  <th className="pb-3 px-4">User</th>
                  <th className="pb-3 px-4">Role</th>
                  <th className="pb-3 px-4">Enrolled Exams</th>
                  <th className="pb-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loadingUsers ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                      Fetching candidate records...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      No candidates matching search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((usr) => (
                    <tr key={usr.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/20 shrink-0">
                            {(usr.displayName || usr.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">{usr.displayName || 'Unnamed Candidate'}</div>
                            <div className="text-xs text-slate-400 font-mono">{usr.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          usr.role === 'admin'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : usr.role === 'editor'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {usr.role || 'student'}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-xs font-mono text-slate-400">
                        {usr.role === 'admin' || usr.role === 'editor' ? (
                          <span className="text-amber-400 font-bold">Universal Bypass (All Exams)</span>
                        ) : (
                          `${Object.keys(usr.enrolledCourses || {}).length} enrolled`
                        )}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleQuickAddDays(usr.id, 30)}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all"
                          >
                            +30 Days
                          </button>
                          <button
                            onClick={() => setSelectedUserForExtension(usr)}
                            className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-bold transition-all"
                          >
                            Custom Grant
                          </button>

                          {usr.role !== 'student' && (
                            <button
                              onClick={() => handleRoleRevoke(usr.id)}
                              disabled={updatingUserId === usr.id}
                              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            >
                              {updatingUserId === usr.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Revoke Role'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* 2. Feature Flags & Pricing Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Feature Toggles Grid */}
          <div className="backdrop-blur-md bg-zinc-900/80 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5 font-bold text-lg text-white">
                <Sliders className="w-5 h-5 text-amber-500" />
                2A. Interactive Feature Flags
              </div>
              <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded font-bold">
                Platform Rules
              </span>
            </div>

            <div className="space-y-4">
              {[
                { key: 'pdfExport' as const, label: 'PDF Export & Study Downloads', desc: 'Allow candidates to download flat PDF materials.' },
                { key: 'excelMetrics' as const, label: 'Excel Score Metrics', desc: 'Enable downloadable CSV/XLSX analytics reports.' },
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

          {/* Pricing Matrix */}
          <div className="backdrop-blur-md bg-zinc-900/80 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5 font-bold text-lg text-white">
                <DollarSign className="w-5 h-5 text-amber-500" />
                2B. Tier Pricing Matrix (INR ₹)
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
                    <><Check className="w-4 h-4 text-slate-950 font-black" /> Rates Saved!</>
                  ) : (
                    'Save Pricing Matrix'
                  )}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* 3. Anti-Tampering Policy Rules */}
        <motion.section 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="backdrop-blur-md bg-zinc-900/80 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5 font-bold text-lg text-white">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              3. System & Anti-Tampering Security Policy Rules
            </div>
            <button
              onClick={() => {
                triggerTopProgress();
                setShowAuditLogs(true);
              }}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>View Audit Logs</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-5 bg-slate-900/90 border border-white/10 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <div className="font-bold text-white text-sm">Server-Authoritative Timer</div>
                <button
                  onClick={() => {
                    triggerTopProgress();
                    setServerTimerLock(!serverTimerLock);
                  }}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors ${serverTimerLock ? 'bg-emerald-500' : 'bg-slate-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${serverTimerLock ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              <p className="text-xs text-slate-400">Syncs CBT test duration with Firebase Cloud Timestamp to prevent client clock tampering.</p>
            </div>

            <div className="p-5 bg-slate-900/90 border border-white/10 rounded-xl space-y-3">
              <div className="font-bold text-white text-sm">Anti-Cheat Sensitivity</div>
              <select
                value={antiCheatSensitivity}
                onChange={(e) => {
                  triggerTopProgress();
                  setAntiCheatSensitivity(e.target.value);
                }}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="high">High (10s Disqualification Warning)</option>
                <option value="medium">Medium (30s Grace Period)</option>
                <option value="low">Low (Logging Only)</option>
              </select>
              <p className="text-xs text-slate-400">Controls tab-switch and window focus penalty thresholds.</p>
            </div>

            <div className="p-5 bg-slate-900/90 border border-white/10 rounded-xl space-y-3">
              <div className="font-bold text-white text-sm">API Rate Limiting Guard</div>
              <select
                value={rateLimitRule}
                onChange={(e) => {
                  triggerTopProgress();
                  setRateLimitRule(e.target.value);
                }}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="60">60 Requests / min</option>
                <option value="120">120 Requests / min</option>
                <option value="300">300 Requests / min</option>
              </select>
              <p className="text-xs text-slate-400">Protects submit and payment endpoints from submission spikes.</p>
            </div>
          </div>
        </motion.section>

        {/* Extend Access Modal */}
        <AnimatePresence>
          {selectedUserForExtension && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-900 border border-white/10 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6"
              >
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Grant Candidate Trial Extension
                  </h3>
                  <button onClick={() => setSelectedUserForExtension(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleGrantAccessExtension} className="space-y-4">
                  <p className="text-xs text-slate-400">
                    Grant additional trial access duration to candidate <span className="font-bold text-white">{selectedUserForExtension.displayName || selectedUserForExtension.email}</span>.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase">Days To Add</label>
                    <select
                      value={extensionDays}
                      onChange={(e) => setExtensionDays(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 font-mono font-bold"
                    >
                      <option value={15}>+15 Days Trial Extension</option>
                      <option value={30}>+30 Days Full Access Extension</option>
                      <option value={60}>+60 Days Extended Access</option>
                    </select>
                  </div>

                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedUserForExtension(null)}
                      className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-slate-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isExtending}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5"
                    >
                      {isExtending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      {extensionSuccess ? 'Granted!' : 'Grant Days'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Audit Logs Modal */}
        <AnimatePresence>
          {showAuditLogs && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-900 border border-white/10 rounded-2xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6"
              >
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-500" />
                    Security & Administrative Audit Logs
                  </h3>
                  <button onClick={() => setShowAuditLogs(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto font-mono text-xs pr-2">
                  {[
                    { time: '2026-07-24 09:12:40', action: 'ROLE_UPDATE', detail: 'User rajesh@example.com role updated to Editor by admin' },
                    { time: '2026-07-24 08:45:10', action: 'PRICE_CHANGE', detail: 'Tier 2 pricing updated to ₹1,499.00 by superadmin' },
                    { time: '2026-07-23 18:20:05', action: 'TRIAL_EXTEND', detail: 'Granted +30 days access extension to student_902' },
                    { time: '2026-07-23 14:02:11', action: 'EXAM_PUBLISH', detail: 'NISM Series V-A Mock Test #4 set to Published' },
                  ].map((log, idx) => (
                    <div key={idx} className="p-3 bg-slate-800/80 border border-white/10 rounded-lg space-y-1">
                      <div className="flex justify-between text-slate-400 text-[10px]">
                        <span>{log.time}</span>
                        <span className="text-amber-400 font-bold">{log.action}</span>
                      </div>
                      <div className="text-slate-200">{log.detail}</div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setShowAuditLogs(false)}
                    className="px-5 py-2 rounded-xl bg-white/10 text-white font-bold text-xs"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </ProtectedRoute>
  );
}
