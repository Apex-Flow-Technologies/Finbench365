'use client';

import React, { useState } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { motion } from 'framer-motion';
import { createCourse, deleteCourse } from '@/lib/firebase/db';
import { useAdminContent, type AdminCourse } from '@/hooks/useAdminContent';
import {
  PageHeader, Card, Badge, Dialog, DialogActions, Button, ErrorNotice,
} from '@/components/admin/primitives';
import {
  Plus, ClipboardList, Loader2, BookOpen, Trash2, FileText, AlertTriangle, PenTool,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminContentPage() {
  const router = useRouter();
  const { content, loading } = useAdminContent();

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminCourse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localHidden, setLocalHidden] = useState<string[]>([]);

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setIsCreating(true);
    try {
      const id = await createCourse({
        title,
        description: '',
        materials: [],
        isPublished: false,
      });
      router.push(`/admin/content/courses/${id}`);
    } catch (err) {
      console.error(err);
      toast.error('Could not create the exam. Please try again.');
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    try {
      await deleteCourse(confirmDelete.id);
      setLocalHidden((prev) => [...prev, confirmDelete.id]);
      toast.success(`"${confirmDelete.title}" deleted.`);
      setConfirmDelete(null);
    } catch (err) {
      console.error(err);
      toast.error('Could not delete the exam.');
    } finally {
      setIsDeleting(false);
    }
  };

  const courses = (content?.courses ?? []).filter((c) => !localHidden.includes(c.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        subtitle="Exam packages, study materials and mock tests."
        icon={PenTool}
        actions={
          <Button onClick={() => { setNewTitle(''); setShowCreate(true); }}>
            <span className="flex items-center gap-2"><Plus className="w-4 h-4" /> New exam</span>
          </Button>
        }
      />

      {content && content.orphanedTests.length > 0 && (
        <ErrorNotice
          message={`${content.orphanedTests.length} mock test${content.orphanedTests.length === 1 ? ' is' : 's are'} not linked to an existing course. Access is resolved through the owning course, so ${content.orphanedTests.length === 1 ? 'it cannot' : 'they cannot'} be opened by any student — even if published.`}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          [0, 1, 2].map((i) => (
            <Card key={i}>
              <div className="animate-pulse space-y-3">
                <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-white/10" />
                <div className="h-5 w-2/3 rounded bg-slate-200 dark:bg-white/10" />
                <div className="h-4 w-full rounded bg-slate-100 dark:bg-white/5" />
                <div className="h-9 w-full rounded-lg bg-slate-200 dark:bg-white/10" />
              </div>
            </Card>
          ))
        ) : courses.length === 0 ? (
          <div className="col-span-full">
            <button
              onClick={() => { setNewTitle(''); setShowCreate(true); }}
              className="w-full p-16 text-center border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-amber-500/50 rounded-2xl text-slate-400 dark:text-slate-500 transition-colors group bg-white dark:bg-[#121419]"
            >
              <BookOpen className="w-10 h-10 mx-auto mb-4 group-hover:text-amber-500 transition-colors" />
              <p className="font-bold text-slate-600 dark:text-slate-300">No exams yet</p>
              <p className="text-sm mt-1">Create your first exam package.</p>
            </button>
          </div>
        ) : (
          courses.map((course, idx) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.28 }}
            >
              <Card className="flex flex-col h-full group hover:border-amber-500/40 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfirmDelete(course)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Delete exam"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Badge tone={course.isPublished ? 'success' : 'neutral'}>
                      {course.isPublished ? 'Live' : 'Draft'}
                    </Badge>
                  </div>
                </div>

                <h3 className="font-bold text-base text-slate-900 dark:text-white mb-3 line-clamp-2">
                  {course.title}
                </h3>

                {/* A live course with nothing to sit is the most damaging
                    content mistake here — it is purchasable and empty. */}
                {course.publishedWithoutTests && (
                  <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 mb-3">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Live but has no published test — students can buy this and get nothing.</span>
                  </div>
                )}

                <div className="flex gap-2 mt-auto pt-2">
                  <div className="flex-1 py-2 rounded-lg border border-slate-100 dark:border-white/10 text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    {course.publishedTestCount}/{course.testCount} test{course.testCount === 1 ? '' : 's'}
                  </div>
                  <div className="flex-1 py-2 rounded-lg border border-slate-100 dark:border-white/10 text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    {course.materialCount} material{course.materialCount === 1 ? '' : 's'}
                  </div>
                </div>

                <button
                  onClick={() => { setPendingId(course.id); router.push(`/admin/content/courses/${course.id}`); }}
                  disabled={pendingId === course.id}
                  className="mt-2 w-full py-2.5 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-amber-500 hover:text-[#111B35] dark:hover:bg-amber-500 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all disabled:opacity-75 flex items-center justify-center gap-1.5"
                >
                  {pendingId === course.id
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening…</>
                    : 'Open editor →'}
                </button>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Replaces the browser prompt() that previously asked for the title. */}
      <Dialog
        open={showCreate}
        title="Create a new exam"
        description="You can change the title and everything else afterwards. It starts as a draft, so nothing is visible to students until you publish it."
        onClose={() => !isCreating && setShowCreate(false)}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
          <label htmlFor="new-exam-title" className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Exam title
          </label>
          <input
            id="new-exam-title"
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. NISM Series V-A — Mutual Fund Distributors"
            className="mt-1.5 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#121419] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500 transition-colors"
          />
          <DialogActions>
            <Button type="submit" disabled={!newTitle.trim() || isCreating}>
              {isCreating ? 'Creating…' : 'Create exam'}
            </Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={isCreating}>
              Cancel
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(confirmDelete)}
        title={`Delete "${confirmDelete?.title ?? ''}"?`}
        description="This removes the exam package permanently. Its mock tests are not deleted, but they will no longer belong to a course — which means no student can open them. This cannot be undone."
        onClose={() => !isDeleting && setConfirmDelete(null)}
      >
        <DialogActions>
          <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete permanently'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={isDeleting}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
