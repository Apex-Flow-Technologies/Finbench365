'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { motion } from 'framer-motion';
import { getCourses, createCourse } from '@/lib/firebase/db';
import { auth } from '@/lib/firebase/config';
import toast from 'react-hot-toast';
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
  const [checkingImpact, setCheckingImpact] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string; impact: any } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
        materialCount: 0,
        isPublished: false 
      });
      router.push(`/editor/courses/${id}`);
    } catch (err) {
      alert('Failed to create exam. Please try again.');
      setIsCreating(false);
    }
  };

  /**
   * Step 1 of deleting an exam: find out what it would destroy.
   *
   * Deleting used to remove only the course document, leaving every enrolled
   * candidate holding an entitlement to something that no longer existed — their
   * dashboard kept showing the exam as a card reading "Course no longer
   * available". The tests, questions and answer keys were orphaned too.
   *
   * The impact is fetched before anything is confirmed, so nobody withdraws a
   * course from under people who have paid for it without seeing that first.
   */
  const handleDeleteExam = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    setCheckingImpact(id);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/delete-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId: id, dryRun: true }),
      });
      const impact = await res.json();
      if (!res.ok) throw new Error(impact.error || 'Could not check the exam.');
      setPendingDelete({ id, title: exams.find((x) => x.id === id)?.title ?? 'this exam', impact });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCheckingImpact(null);
    }
  };

  /** Step 2: actually delete, once the impact has been seen and accepted. */
  const confirmDeleteExam = async () => {
    if (!pendingDelete || !auth.currentUser) return;
    setIsDeleting(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/delete-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId: pendingDelete.id, dryRun: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed.');
      setExams(exams.filter((x) => x.id !== pendingDelete.id));
      toast.success(
        `Deleted. ${data.entitlementsRemoved} student enrolment(s) removed, ` +
        `${data.testsDeleted} mock test(s) and ${data.questionsDeleted} question(s) cleared. ` +
        `Payment records kept.`,
        { duration: 9000 },
      );
      setPendingDelete(null);
    } catch (err: any) {
      toast.error(err.message, { duration: 9000 });
    } finally {
      setIsDeleting(false);
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
                      disabled={checkingImpact === exam.id}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete Exam"
                    >
                      {checkingImpact === exam.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
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
                    {/* materialCount is what saving study notes writes. Reading
                        the old `materials` array reported 0 on every card once
                        notes moved into their own protected collection — the
                        notes were there, the count was reading a field nothing
                        writes to any more. The array remains as a fallback for
                        a course not yet re-saved. */}
                    {typeof (exam as any).materialCount === 'number'
                      ? (exam as any).materialCount
                      : (exam.materials || []).length} materials
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

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          onClick={() => !isDeleting && setPendingDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#181A1F] border border-slate-200 dark:border-white/10 p-6 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Delete “{pendingDelete.title}”?
            </h3>

            {pendingDelete.impact.enrolledActive > 0 ? (
              <div className="mt-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25">
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
                  {pendingDelete.impact.enrolledActive} student
                  {pendingDelete.impact.enrolledActive === 1 ? '' : 's'} currently have paid, active access.
                </p>
                <p className="text-xs text-rose-600/90 dark:text-rose-300/90 mt-1.5 leading-relaxed">
                  Deleting removes their access immediately. Consider unpublishing the exam instead,
                  or refunding them first.
                </p>
                {pendingDelete.impact.activeEmails?.length > 0 && (
                  <p className="text-[11px] text-rose-600/80 dark:text-rose-300/80 mt-2 break-all">
                    {pendingDelete.impact.activeEmails.join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                No student currently has active access to this exam.
              </p>
            )}

            <ul className="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              <li>· {pendingDelete.impact.mockTests} mock test(s), with their questions and answer keys</li>
              <li>· {pendingDelete.impact.enrolledTotal} enrolment record(s), including expired ones</li>
              <li>· Payment records are <strong>kept</strong> — they are your financial record</li>
            </ul>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 mt-6">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteExam}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-rose-500 hover:bg-rose-400 text-white transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
