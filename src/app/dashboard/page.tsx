'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { EmailVerificationBanner } from '@/components/auth/EmailVerificationBanner';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { LogOut, BookOpen, Clock, Award, Layers, Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { getUserEntitlements, getCourses, getUserAnalytics } from '@/lib/firebase/db';
import { useRouter } from 'next-nprogress-bar';
import { AdminPreviewBanner } from '@/components/AdminPreviewBanner';
import { EASE_OUT_EXPO } from '@/lib/motion';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [entitlements, setEntitlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState({ accuracy: 0, totalTimeMs: 0, attemptsCount: 0 });

  useEffect(() => {
    if (!user) return;

    if (user.role === 'admin') {
      // Admins get universal access to preview ALL courses
      getCourses().then(allCourses => {
        const previewEntitlements = allCourses.map(course => ({
          courseId: course.id,
          course: course,
          enrolledAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 10 * 86400 * 1000),
          durationDays: 3650,
          isActive: true,
          isAdminPreview: true
        }));
        setEntitlements(previewEntitlements);
        setLoading(false);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setError("Failed to load admin preview courses. Please refresh.");
        setLoading(false);
      });
      
      getUserAnalytics(user.uid).then(setAnalytics).catch(console.error);

    } else if (user.uid) {
      getUserEntitlements(user.uid).then(data => {
        setEntitlements(data);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setError("Failed to load your enrolled courses. Please refresh.");
        setLoading(false);
      });
      
      getUserAnalytics(user.uid).then(setAnalytics).catch(console.error);
    }
  }, [user?.uid, user?.role]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('myexams_session_id');
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.07, delayChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT_EXPO } }
  };

  const [pendingCourseId, setPendingCourseId] = useState<string | null>(null);

  const handleOpenCourse = (courseId: string) => {
    setPendingCourseId(courseId);
    router.push(`/dashboard/courses/${courseId}`);
  };

  return (
    <ProtectedRoute requiredRole="student">
      <div className="min-h-[calc(100vh)] relative w-full z-10 pt-28 pb-20 px-6 max-w-7xl mx-auto">

        <EmailVerificationBanner />

        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-[#111B35] dark:text-white">
              Welcome back, {user?.displayName?.split(' ')[0] || 'Student'}
            </h1>
            <p className="font-medium text-[#475569] dark:text-[#94A3B8]">
              Continue your preparation for global financial certifications.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg border transition-all duration-300 text-sm font-semibold border-slate-200 hover:bg-slate-100 text-[#334155] dark:border-white/10 dark:hover:bg-white/5 dark:text-[#E2E8F0] dark:hover:text-white active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </motion.div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content Area (2/3 width) */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#111B35] dark:text-white">Your Enrolled Exams</h2>
                {(user?.role === 'admin') && (
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 rounded-full text-xs tabular-nums font-bold uppercase tracking-wider">
                    ● Admin Universal Access
                  </span>
                )}
              </div>
              
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-72 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-100/40 dark:bg-white/5 animate-pulse"></div>
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-2xl p-8 border border-red-200 bg-red-50 text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400 flex flex-col items-center justify-center text-center">
                  <p className="font-bold mb-2">Error Loading Dashboard</p>
                  <p className="text-sm">{error}</p>
                </div>
              ) : entitlements.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl p-12 border text-center transition-all duration-300 bg-white border-slate-200 dark:bg-[#181A1F] dark:border-white/10 dark:backdrop-blur-xl shadow-sm"
                >
                  <Layers className="w-12 h-12 mx-auto mb-4 text-[#475569] dark:text-[#94A3B8]" />
                  <h3 className="text-lg font-bold mb-2 text-[#111B35] dark:text-white">No Active Enrollments</h3>
                  <p className="text-sm mb-6 text-[#475569] dark:text-[#94A3B8]">You haven't enrolled in any tracks yet.</p>
                  <button 
                    onClick={() => router.push('/exams')}
                    className="px-6 py-3 rounded-lg font-bold bg-amber-500 text-[#111B35] hover:bg-amber-400 transition-all duration-200 active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                  >
                    Browse Curriculum
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                  {entitlements.map((entitlement: any) => {
                    const diffDays = Math.ceil((entitlement.expiresAt.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                    const isExpired = !entitlement.isAdminPreview && diffDays <= 0;
                    const daysTotal = entitlement.durationDays;
                    // Start full and drain as time passes
                    const remainingPct = isExpired ? 0 : Math.min(100, Math.max(0, (diffDays / daysTotal) * 100));
                    const isPending = pendingCourseId === entitlement.courseId;

                    return (
                      <motion.div
                        variants={itemVariants}
                        whileHover={isExpired ? { scale: 1.01 } : { scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        key={entitlement.courseId}
                        className={`rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col relative group ${
                          isExpired
                            // Expired tracks are visibly retired — desaturated and
                            // dimmed — so an active course is never confused with a
                            // lapsed one at a glance.
                            ? 'bg-slate-50 border-slate-200 grayscale opacity-70 hover:opacity-100 hover:grayscale-0 dark:bg-[#141518] dark:border-white/5'
                            : 'bg-white border-slate-200 hover:shadow-xl dark:bg-[#181A1F] dark:border-white/10 dark:hover:border-white/20 dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]'
                        }`}
                      >
                        {/* Subtle glow effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/0 to-amber-500/0 group-hover:from-amber-500/5 group-hover:to-transparent transition-colors duration-500 pointer-events-none" />

                        {/* Card Header / Banner */}
                        <div className="h-24 px-6 flex items-end justify-between pb-4 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-white/5 dark:to-white/10 border-b border-slate-100 dark:border-white/5">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center -mb-10 shadow-lg bg-white dark:bg-[#121419] transition-colors duration-300 border border-slate-100 dark:border-white/10 z-10">
                            <Layers className="w-6 h-6 text-amber-600 dark:text-amber-500" />
                          </div>
                          {entitlement.isAdminPreview && (
                            <span className="px-2.5 py-1 rounded-md bg-amber-500 text-slate-950 font-black text-[10px] uppercase tabular-nums tracking-wider shadow-sm">
                              ADMIN PREVIEW
                            </span>
                          )}
                          {isExpired && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 18 }}
                              className="px-2.5 py-1 rounded-md bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 font-black text-[10px] uppercase tabular-nums tracking-wider"
                            >
                              EXPIRED
                            </motion.span>
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="p-6 pt-10 flex-1 flex flex-col z-10">
                          <h3 className="font-bold text-xl mb-1 text-[#111B35] dark:text-white">{entitlement.course.title}</h3>
                          <p className="text-sm mb-6 text-[#475569] dark:text-[#94A3B8]">
                            {entitlement.isAdminPreview ? (
                              'Unlimited Admin Preview'
                            ) : (
                              `${entitlement.durationDays} days access`
                            )}
                          </p>
                            
                          <div className="w-full rounded-full h-2 mb-3 bg-slate-100 dark:bg-black/50 dark:border dark:border-white/5 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${remainingPct}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                              className={`${isExpired ? 'bg-red-500' : 'bg-amber-500'} h-full rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]`}
                            />
                          </div>

                          <div className="flex justify-between items-center text-xs tabular-nums text-[#475569] dark:text-[#94A3B8]">
                            {entitlement.isAdminPreview ? (
                              <>
                                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded tracking-wide">
                                  UNLIMITED ACCESS
                                </span>
                                <span className="text-amber-600 dark:text-amber-500 font-bold text-[11px]">Admin Mode</span>
                              </>
                            ) : (
                              <>
                                <span>{isExpired ? 'Access Expired' : 'Active'}</span>
                                <span className={isExpired ? 'text-red-500 font-bold' : ''}>
                                  {isExpired ? 'Expired' : `Expires in ${diffDays} days`}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="mt-6 flex flex-wrap gap-3">
                            {isExpired ? (
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => router.push(`/pricing?courseId=${entitlement.courseId}&track=${encodeURIComponent(entitlement.course.title)}`)}
                                className="px-5 py-3 rounded-xl text-sm font-bold shadow-md transition-colors bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-400 w-full flex items-center justify-center gap-2"
                              >
                                <RefreshCw className="w-4 h-4" />
                                <span>Renew Access</span>
                              </motion.button>
                            ) : (
                              <button 
                                onClick={() => handleOpenCourse(entitlement.courseId)}
                                disabled={isPending}
                                className="w-full py-3 rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] bg-amber-500 text-[#111B35] hover:bg-amber-400 hover:shadow-[0_6px_20px_rgba(245,158,11,0.4)] disabled:opacity-75 disabled:pointer-events-none"
                              >
                                {isPending ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Opening Course Hub...</span>
                                  </>
                                ) : (
                                  <span>Open Course Hub</span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </section>
          </div>

          {/* Sidebar / Performance Diagnostic Analytics Area (1/3 width) */}
          {(entitlements.length > 0 || loading) && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {loading ? (
              <div className="rounded-2xl p-6 h-64 border border-slate-200 dark:border-white/5 bg-slate-100/40 dark:bg-white/5 animate-pulse"></div>
            ) : (
            <>
              {/* 1. Core Metrics */}
              <div className="rounded-2xl p-6 border transition-all duration-300 bg-white border-slate-200 shadow-sm dark:bg-[#181A1F] dark:border-white/10 dark:shadow-lg space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#282C36] pb-3">
                <h3 className="font-bold text-[#111B35] dark:text-white text-base">Performance Overview</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#121419] rounded-xl border border-slate-100 dark:border-[#282C36]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-[#475569] dark:text-[#94A3B8]">Average Accuracy</div>
                      <div className="font-extrabold text-xl text-[#111B35] dark:text-white">{analytics.accuracy}%</div>
                    </div>
                  </div>
                  {analytics.accuracy >= 70 && (
                    <span className="text-xs tabular-nums font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      QUALIFIED
                    </span>
                  )}
                  {analytics.accuracy < 70 && analytics.accuracy > 0 && (
                    <span className="text-xs tabular-nums font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                      IMPROVING
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#121419] rounded-xl border border-slate-100 dark:border-[#282C36]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-[#475569] dark:text-[#94A3B8]">Total CBT Time</div>
                      <div className="font-extrabold text-xl text-[#111B35] dark:text-white">
                        {Math.floor(analytics.totalTimeMs / (1000 * 60 * 60))}h {Math.floor((analytics.totalTimeMs / (1000 * 60)) % 60)}m
                      </div>
                    </div>
                  </div>
                  <span className="text-xs tabular-nums font-bold text-[#475569] dark:text-[#94A3B8]">
                    {analytics.attemptsCount} Mocks
                  </span>
              </div>
            </div>
            </div>
            </>
            )}
          </motion.div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}
