'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { getCourse, getCourseChapters, getUserEntitlements, getTestAttemptsCount } from '@/lib/firebase/db';
import { BookOpen, PlayCircle, Loader2, ArrowLeft, Clock } from 'lucide-react';

export default function StudentCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const courseId = unwrappedParams.id;
  const router = useRouter();
  const { user } = useAuth();
  
  const [course, setCourse] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      
      try {
        // 1. Verify Entitlement
        const entitlements = await getUserEntitlements(user.uid);
        const entitlement = entitlements.find(e => e.courseId === courseId);
        
        if (!entitlement) {
          setHasAccess(false);
          setLoading(false);
          return;
        }
        
        const diffDays = Math.ceil((entitlement.expiresAt.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
        if (diffDays <= 0) {
          setHasAccess(false);
          setLoading(false);
          return;
        }
        
        setHasAccess(true);

        // 2. Fetch Data
        const courseData = await getCourse(courseId);
        setCourse(courseData);
        
        const chaptersData = await getCourseChapters(courseId);
        setChapters(chaptersData);
        
        // Fetch attempt counts for all tests
        const counts: Record<string, number> = {};
        
        if (courseData?.mockTestId) {
          counts[courseData.mockTestId] = await getTestAttemptsCount(user.uid, courseData.mockTestId);
        }
        
        for (const chapter of chaptersData) {
          if (chapter.mockTestId) {
            counts[chapter.mockTestId] = await getTestAttemptsCount(user.uid, chapter.mockTestId);
          }
        }
        setAttemptCounts(counts);
        
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [user, courseId]);

  if (loading) return (
    <div className="min-h-screen bg-[#121419] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
    </div>
  );

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[#121419] flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-3xl font-bold text-white mb-4">Access Denied or Expired</h1>
        <p className="text-slate-400 mb-8 max-w-md">You do not have active access to this course. Please return to the storefront to renew your access.</p>
        <button 
          onClick={() => router.push('/exams')}
          className="bg-amber-500 text-[#121419] px-6 py-3 rounded-lg font-bold"
        >
          View Storefront
        </button>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0B0C10] text-[#FBFBF9] pt-20">
        <div className="max-w-5xl mx-auto px-6 py-8">
          
          {/* Header */}
          <button 
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 text-sm font-bold"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          
          <div className="bg-[#121419] border border-[#282C36] rounded-2xl p-8 mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">{course?.title}</h1>
            <p className="text-slate-400 text-lg">{course?.description}</p>
          </div>

          {/* Chapters List */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-6">Course Content</h2>
            
            {chapters.length === 0 ? (
              <div className="text-slate-500 text-center py-12 border border-dashed border-[#282C36] rounded-xl">
                No content has been published for this course yet.
              </div>
            ) : (
              chapters.map((chapter, idx) => {
                const isExpanded = expandedChapter === chapter.id;
                return (
                  <div key={chapter.id} className="bg-[#181A1F] border border-[#282C36] rounded-xl overflow-hidden hover:border-[#323842] transition-colors">
                    {/* Chapter Header (Clickable) */}
                    <div 
                      className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer"
                      onClick={() => setExpandedChapter(isExpanded ? null : chapter.id)}
                    >
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#272B33] flex items-center justify-center shrink-0">
                          <span className="font-mono text-lg font-bold text-slate-300">{idx + 1}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">{chapter.title}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                            {chapter.materialLink && (
                              <span className="flex items-center gap-1.5">
                                <BookOpen className="w-4 h-4 text-emerald-500" /> Notes Available
                              </span>
                            )}
                            {chapter.mockTestId && (
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-amber-500" /> Practice Test Attached
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Chapter Expanded Content */}
                    {isExpanded && (
                      <div className="px-6 pb-6 pt-2 border-t border-[#282C36]/50 bg-[#121419]/50">
                        <p className="text-slate-300 mb-6 mt-4">
                          Welcome to <strong>{chapter.title}</strong>. Please ensure you have read the provided chapter notes completely before attempting the practice test. You are limited to 10 attempts for the practice test, and answers will be revealed instantly during the test to aid your learning.
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-3">
                          {chapter.materialLink && (
                            <a 
                              href={chapter.materialLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="px-6 py-2.5 bg-[#272B33] hover:bg-[#323842] text-white rounded-lg font-bold text-sm transition-colors flex items-center gap-2"
                            >
                              <BookOpen className="w-4 h-4" /> Read Chapter Notes
                            </a>
                          )}
                          
                          {chapter.mockTestId && (
                            <div className="flex flex-col items-center gap-2">
                              <button 
                                onClick={() => router.push(`/dashboard/exam/${chapter.mockTestId}`)}
                                disabled={(attemptCounts[chapter.mockTestId] || 0) >= 10}
                                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-[#121419] rounded-lg font-bold text-sm shadow-md transition-all duration-200 active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <PlayCircle className="w-4 h-4" /> 
                                {(attemptCounts[chapter.mockTestId] || 0) >= 10 ? 'Attempts Exhausted' : 'Take Practice Test'}
                              </button>
                              <div className="text-xs font-mono text-slate-500">
                                Attempts: <span className={(attemptCounts[chapter.mockTestId] || 0) >= 10 ? 'text-red-500 font-bold' : 'text-amber-500'}>{attemptCounts[chapter.mockTestId] || 0}/10</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Final Course Exam Module */}
          {course?.mockTestId && (
            <div className="mt-16 pt-10 border-t border-[#282C36]">
              <h2 className="text-2xl font-bold text-white mb-6">Final Certification Exam</h2>
              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/30 rounded-2xl p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                <div className="relative z-10 max-w-xl">
                  <h3 className="text-xl font-bold text-white mb-2">Comprehensive Final Assessment</h3>
                  <p className="text-slate-400">
                    This is the main exam for the course. Answers will only be revealed after submission. 
                    This test is strictly monitored by the Anti-Cheat Engine (Full-screen enforced, tab-switching strictly prohibited).
                  </p>
                </div>
                <div className="relative z-10 flex flex-col md:items-end gap-2">
                  <button 
                    onClick={() => router.push(`/dashboard/exam/${course.mockTestId}`)}
                    disabled={(attemptCounts[course.mockTestId] || 0) >= 10}
                    className="whitespace-nowrap px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-[#121419] rounded-xl font-bold text-sm shadow-lg shadow-amber-500/20 transition-all duration-200 active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlayCircle className="w-5 h-5" /> 
                    {(attemptCounts[course.mockTestId] || 0) >= 10 ? 'Attempts Exhausted' : 'Start Final Exam'}
                  </button>
                  <div className="text-sm font-mono text-slate-400">
                    Attempts: <span className={(attemptCounts[course.mockTestId] || 0) >= 10 ? 'text-red-500 font-bold' : 'text-amber-500'}>{attemptCounts[course.mockTestId] || 0}/10</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
