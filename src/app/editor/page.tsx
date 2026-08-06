'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { motion } from 'framer-motion';
import { getCourses, createCourse, deleteCourse } from '@/lib/firebase/db';
import { Plus, ClipboardList, Loader2, BookOpen, Trash2 } from 'lucide-react';

// Skeleton card for loading
function ExamSkeletonCard() {
  return (
    <div className="bg-white dark:bg-[#181A1F] border border-slate-200 dark:border-[#282C36] rounded-2xl p-6 animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-[#272B33]" />
        <div className="h-5 w-16 rounded-full bg-slate-200 dark:bg-[#272B33]" />
      </div>
      <div className="h-5 w-2/3 bg-slate-200 dark:bg-[#272B33] rounded mb-2" />
      <div className="h-4 w-full bg-slate-100 dark:bg-[#222629] rounded mb-1" />
      <div className="h-4 w-4/5 bg-slate-100 dark:bg-[#222629] rounded mb-6" />
      <div className="h-9 w-full bg-slate-200 dark:bg-[#272B33] rounded-lg" />
    </div>
  );
}

export default function EditorDashboard() {
  const router = useRouter();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getCourses();
        setExams(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCreateExam = async () => {
    const title = prompt('Enter Exam Title:\n(e.g. NISM Series V-A — Mutual Fund Distributors)');
    if (!title) return;

    setIsCreating(true);
    try {
      const id = await createCourse({ 
        title, 
        description: 'New Exam', 
        materials: [],
        isPublished: false 
      });
      router.push(`/editor/courses/${id}`);
    } catch (err) {
      alert('Failed to create exam. Please try again.');
      setIsCreating(false);
    }
  };

  const handleDeleteExam = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this exam? This action cannot be undone.')) {
      try {
        await deleteCourse(id);
        setExams(exams.filter(exam => exam.id !== id));
      } catch (error) {
        console.error("Error deleting exam:", error);
        alert('Failed to delete exam.');
      }
    }
  };

  const [pendingExamId, setPendingExamId] = useState<string | null>(null);

  const handleOpenEditor = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPendingExamId(id);
    router.push(`/editor/courses/${id}`);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Exam Manager</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Create and manage exam packages, study notes, and mock tests.
          </p>
        </div>
        <button
          onClick={handleCreateExam}
          disabled={isCreating}
          className="flex items-center gap-2 bg-amber-500 text-slate-900 font-bold px-5 py-3 rounded-xl hover:bg-amber-400 transition-all hover:shadow-lg hover:shadow-amber-500/20 active:scale-95 disabled:opacity-70 shrink-0"
        >
          {isCreating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
          ) : (
            <><Plus className="w-5 h-5" /> Create New Exam</>
          )}
        </button>
      </div>

      {/* Exam Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <>
            <ExamSkeletonCard />
            <ExamSkeletonCard />
            <ExamSkeletonCard />
          </>
        ) : exams.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full"
          >
            <div
              onClick={handleCreateExam}
              className="p-16 text-center border-2 border-dashed border-slate-200 dark:border-[#282C36] hover:border-amber-500/50 dark:hover:border-amber-500/40 rounded-2xl text-slate-400 dark:text-slate-500 cursor-pointer transition-colors group bg-white dark:bg-[#181A1F]"
            >
              <BookOpen className="w-10 h-10 mx-auto mb-4 group-hover:text-amber-500 transition-colors" />
              <p className="font-bold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                No exams yet
              </p>
              <p className="text-sm mt-1">Click to create your first exam package.</p>
            </div>
          </motion.div>
        ) : (
          exams.map((exam, idx) => {
            const isPending = pendingExamId === exam.id;
            return (
              <motion.div
                key={exam.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06, duration: 0.3 }}
                onClick={() => handleOpenEditor(exam.id)}
                className="bg-white border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] border rounded-2xl p-6 flex flex-col h-full hover:border-amber-500/40 hover:shadow-lg dark:hover:shadow-black/40 hover:shadow-amber-100 transition-all group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDeleteExam(exam.id, e)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete Exam"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      exam.isPublished
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-[#272B33] dark:text-slate-400'
                    }`}>
                      {exam.isPublished ? '● Live' : '○ Draft'}
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2 group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors line-clamp-2">
                  {exam.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 line-clamp-2">{exam.description}</p>

                <div className="flex gap-2 mt-auto pt-2">
                  <div className="flex-1 py-2 rounded-lg border border-slate-100 dark:border-[#282C36] text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5" />
                    {(exam.materials || []).length} materials
                  </div>
                  <button
                    onClick={(e) => handleOpenEditor(exam.id, e)}
                    disabled={isPending}
                    className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-[#272B33] hover:bg-amber-500 hover:text-slate-900 dark:hover:bg-amber-500 dark:hover:text-[#121419] text-slate-700 dark:text-slate-300 text-xs font-bold transition-all disabled:opacity-75 flex items-center justify-center gap-1.5"
                  >
                    {isPending ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening...</>
                    ) : (
                      'Open Editor →'
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
