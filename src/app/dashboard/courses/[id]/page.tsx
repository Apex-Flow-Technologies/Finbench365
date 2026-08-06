'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { motion, AnimatePresence } from 'framer-motion';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { getCourse, getCourseTests, getUserEntitlements, getTestAttemptsCount } from '@/lib/firebase/db';
import { 
  BookOpen, PlayCircle, Loader2, ArrowLeft, Clock, 
  FileDown, AlertCircle, BookMarked, ClipboardList
} from 'lucide-react';

// Loading skeleton for the content area
function ContentSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-[#181A1F] border border-slate-200 dark:border-[#282C36] rounded-xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-[#272B33] shrink-0" />
            <div className="space-y-2">
              <div className="h-4 w-48 bg-slate-200 dark:bg-[#272B33] rounded" />
              <div className="h-3 w-32 bg-slate-100 dark:bg-[#222629] rounded" />
            </div>
          </div>
          <div className="h-9 w-28 bg-slate-200 dark:bg-[#272B33] rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
}

import { AdminPreviewBanner } from '@/components/AdminPreviewBanner';

export default function StudentExamPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const examId = unwrappedParams.id;
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [exam, setExam] = useState<any>(null);
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [daysLeft, setDaysLeft] = useState(0);
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'materials' | 'tests'>('materials');
  const [startingTestId, setStartingTestId] = useState<string | null>(null);

  const materials = exam?.materials || [];

  useEffect(() => {
    async function loadData() {
      if (!user) return;

      try {
        // 1. Check if Admin/Editor override applies
        if (user.role === 'admin') {
          setHasAccess(true);
          setDaysLeft(999);
        } else {
          // Verify student entitlement
          const entitlements = await getUserEntitlements(user.uid);
          const entitlement = entitlements.find((e) => e.courseId === examId);

          if (!entitlement) {
            setHasAccess(false);
            setLoading(false);
            return;
          }

          const diffDays = Math.ceil(
            (entitlement.expiresAt.getTime() - new Date().getTime()) / (1000 * 3600 * 24)
          );

          if (diffDays <= 0) {
            setHasAccess(false);
            setLoading(false);
            return;
          }

          setHasAccess(true);
          setDaysLeft(diffDays);
        }

        // 2. Load exam + tests in parallel
        const [examData, testsData] = await Promise.all([
          getCourse(examId),
          getCourseTests(examId),
        ]);

        setExam(examData);

        // Filter to published tests (admins see all tests)
        const publishedTests = user.role === 'admin'
          ? testsData
          : testsData.filter((t: any) => t.isPublished !== false);
        setTests(publishedTests);

        // 3. Fetch attempt counts for all tests
        const counts: Record<string, number> = {};
        await Promise.all(
          publishedTests.map(async (test: any) => {
            counts[test.id] = await getTestAttemptsCount(user.uid, test.id);
          })
        );
        setAttemptCounts(counts);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, examId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#0B0C10] pt-20 transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Back button skeleton */}
          <div className="h-4 w-32 bg-slate-200 dark:bg-[#272B33] rounded animate-pulse mb-8" />
          {/* Header skeleton */}
          <div className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-2xl p-8 mb-8 animate-pulse">
            <div className="h-8 w-2/3 bg-slate-200 dark:bg-[#272B33] rounded mb-3" />
            <div className="h-4 w-full bg-slate-100 dark:bg-[#222629] rounded" />
          </div>
          {/* Tab skeleton */}
          <div className="flex gap-2 mb-6">
            <div className="h-10 w-36 bg-slate-200 dark:bg-[#272B33] rounded-xl animate-pulse" />
            <div className="h-10 w-36 bg-slate-200 dark:bg-[#272B33] rounded-xl animate-pulse" />
          </div>
          <ContentSkeleton />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#121419] flex flex-col items-center justify-center text-center px-6 transition-colors duration-300">
        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-[#111B35] dark:text-white mb-3">Access Denied or Expired</h1>
        <p className="text-[#475569] dark:text-[#94A3B8] mb-8 max-w-md text-sm">
          You do not have active access to this exam. Please visit the storefront to purchase or renew your access.
        </p>
        <button
          onClick={() => router.push('/exams')}
          className="bg-amber-500 text-[#111B35] px-6 py-3 rounded-xl font-bold hover:bg-amber-400 transition-colors shadow-md shadow-amber-500/20"
        >
          View Exam Catalog
        </button>
      </div>
    );
  }

  const handleStartTest = (testId: string) => {
    setStartingTestId(testId);
    router.push(`/dashboard/exam/${testId}`);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-100 dark:bg-[#0B0C10] text-[#111B35] dark:text-[#FBFBF9] pt-28 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

          {/* Breadcrumb */}
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 text-[#475569] hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-white transition-colors mb-6 text-sm font-semibold group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to Dashboard</span>
          </button>

          {/* Header Card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-2xl p-6 sm:p-8 mb-8 shadow-sm relative overflow-hidden transition-colors"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-100/50 dark:bg-amber-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#111B35] dark:text-white mb-2">{exam?.title}</h1>
                  <p className="text-[#334155] dark:text-[#94A3B8] text-sm max-w-2xl leading-relaxed">{exam?.description}</p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  {isAdmin ? (
                    <span className="text-xs tabular-nums text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 rounded-full font-bold uppercase tracking-wider">
                      ● ADMIN ACCESS
                    </span>
                  ) : (
                    <span className="text-xs tabular-nums text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-3.5 py-1.5 rounded-full font-bold">
                      {daysLeft} days remaining
                    </span>
                  )}
                </div>
              </div>

              {/* Stat Chips */}
              <div className="flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-slate-100 dark:border-[#282C36]/60">
                <div className="flex items-center gap-2 text-xs font-medium text-[#334155] dark:text-[#E2E8F0] bg-slate-100 dark:bg-[#181A1F] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#282C36]">
                  <span>📚</span>
                  <span className="font-bold text-[#111B35] dark:text-white">{materials.length}</span> Study Note{materials.length !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-[#334155] dark:text-[#E2E8F0] bg-slate-100 dark:bg-[#181A1F] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#282C36]">
                  <span>📝</span>
                  <span className="font-bold text-[#111B35] dark:text-white">{tests.length}</span> Mock Test{tests.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Tab Switcher */}
          <div className="flex gap-2 mb-6 p-1 bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-xl w-fit transition-colors shadow-sm">
            <button
              onClick={() => setActiveTab('materials')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all ${
                activeTab === 'materials'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-[#334155] dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BookMarked className="w-4 h-4" />
              <span>Study Notes</span>
              {materials.length > 0 && (
                <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-full ${activeTab === 'materials' ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-slate-100 dark:bg-[#272B33]'}`}>
                  {materials.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('tests')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all ${
                activeTab === 'tests'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-[#334155] dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Mock Tests</span>
              {tests.length > 0 && (
                <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-full ${activeTab === 'tests' ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-slate-100 dark:bg-[#272B33]'}`}>
                  {tests.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'materials' && (
              <motion.div
                key="materials"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {materials.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-[#121419] border border-dashed border-slate-300 dark:border-[#282C36] rounded-2xl text-[#475569] dark:text-[#94A3B8] transition-colors">
                    <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No study notes have been uploaded yet.</p>
                    <p className="text-xs mt-1">Check back soon!</p>
                  </div>
                ) : (
                  materials.map((mat: any, idx: number) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-xl p-5 flex items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-neutral-700 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="font-bold text-[#111B35] dark:text-white text-sm">{mat.name}</div>
                          <div className="text-xs text-[#475569] dark:text-[#94A3B8] tabular-nums mt-0.5 truncate max-w-xs">PDF Study Note</div>
                        </div>
                      </div>
                      <a
                        href={mat.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-500 text-blue-700 dark:text-blue-400 hover:text-white rounded-xl font-bold text-xs transition-all active:scale-95"
                      >
                        <FileDown className="w-4 h-4" />
                        Download PDF
                      </a>
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'tests' && (
              <motion.div
                key="tests"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {tests.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-[#121419] border border-dashed border-slate-300 dark:border-[#282C36] rounded-2xl text-[#475569] dark:text-[#94A3B8] transition-colors">
                    <ClipboardList className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No mock tests are published for this exam yet.</p>
                    <p className="text-xs mt-1">Check back soon!</p>
                  </div>
                ) : (
                  tests.map((test, idx) => {
                    const attempts = attemptCounts[test.id] || 0;
                    const maxAttempts = 10;
                    const isExhausted = !isAdmin && attempts >= maxAttempts;
                    const progressPct = Math.min((attempts / maxAttempts) * 100, 100);
                    const isStarting = startingTestId === test.id;

                    return (
                      <motion.div
                        key={test.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-xl overflow-hidden hover:border-slate-300 dark:hover:border-neutral-700 hover:shadow-sm transition-all"
                      >
                        <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                              <ClipboardList className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                              <div className="font-bold text-[#111B35] dark:text-white text-sm">{test.title}</div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-[#475569] dark:text-[#94A3B8] tabular-nums">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" /> {test.durationMinutes} min
                                </span>
                                <span>·</span>
                                <span>{test.totalQuestions} Questions</span>
                                <span>·</span>
                                <span className={isExhausted ? 'text-red-500' : 'text-amber-600 dark:text-amber-500'}>
                                  {isAdmin ? 'Unlimited Attempts' : `${attempts}/${maxAttempts} attempts`}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleStartTest(test.id)}
                            disabled={isExhausted || isStarting}
                            className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-100 dark:disabled:bg-[#272B33] disabled:text-[#475569] dark:disabled:text-[#94A3B8] text-[#111B35] disabled:cursor-not-allowed rounded-xl font-bold text-xs shadow-md shadow-amber-500/20 disabled:shadow-none transition-all active:scale-95 disabled:pointer-events-none"
                          >
                            {isStarting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Starting...</span>
                              </>
                            ) : isExhausted ? (
                              'Attempts Exhausted'
                            ) : (
                              <>
                                <PlayCircle className="w-4 h-4" />
                                <span>Start Test</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Attempt progress bar */}
                        {!isAdmin && (
                          <div className="h-1 bg-slate-100 dark:bg-[#282C36]">
                            <div
                              className={`h-full transition-all duration-500 ${isExhausted ? 'bg-red-400' : 'bg-amber-500'}`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </ProtectedRoute>
  );
}
