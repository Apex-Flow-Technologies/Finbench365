'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { getCourse, updateCourse, getCourseTests, createMockTest, getCourseMaterials, saveCourseMaterials, saveTestOrder } from '@/lib/firebase/db';
import { PLAN_TIER_OPTIONS, normalisePlanTier } from '@/constants/pricing';
import { IN_SCOPE_PATTERNS, findExamPattern } from '@/constants/examPatterns';
import { 
  ChevronLeft, Plus, Save, Settings, UploadCloud, FileText, 
  ClipboardList, Trash2, ExternalLink, CheckCircle2, Loader2,
  GripVertical, BookMarked, ChevronUp, ChevronDown, FileCheck2
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import toast from 'react-hot-toast';
import { uploadMaterialFile, deleteMaterialFile, formatBytes } from '@/lib/materials/upload';

/**
 * One study note as the editor holds it before saving.
 *
 * `url` and `storagePath` are alternatives: a note is either a link to
 * somewhere else or a file this site holds. Uploading clears the link, and
 * detaching the file leaves the link field free again.
 */
interface MaterialDraft {
  id?: string;
  name: string;
  url: string;
  minPlanTier: number;
  storagePath?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
}

// Skeleton card for loading state
function SkeletonCard() {
  return (
    <div className="bg-slate-50 dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-2xl p-6 animate-pulse">
      <div className="h-4 w-1/3 bg-slate-200 dark:bg-[#272B33] rounded mb-4" />
      <div className="h-10 w-full bg-slate-200 dark:bg-[#272B33] rounded" />
    </div>
  );
}

export default function ExamBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const courseId = unwrappedParams.id;
  const router = useRouter();

  const [exam, setExam] = useState<any>(null);
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Index of the row being dragged. Null when nothing is in flight.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Study notes drag independently of mock tests. Shared state would let a
  // note dropped onto a test reorder the wrong list.
  const [matDragIndex, setMatDragIndex] = useState<number | null>(null);
  const [matDragOverIndex, setMatDragOverIndex] = useState<number | null>(null);

  /**
   * Reorders the mock tests and persists the arrangement.
   *
   * Optimistic: the list moves as the admin drops, and reverts if the write
   * fails. Waiting for a round trip before the row moves makes dragging feel
   * broken even when it worked.
   */
  const moveTest = async (from: number, to: number) => {
    if (from === to) return;
    const previous = tests;
    const next = [...tests];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setTests(next);
    try {
      await saveTestOrder(next.map((t: any) => t.id));
    } catch (err) {
      console.error('Could not save the new order:', err);
      setTests(previous);
      alert('Could not save the new order. Please try again.');
    }
  };

  // Materials state — flat list of {name, url}
  const [materials, setMaterials] = useState<MaterialDraft[]>([]);
  /** Upload progress per row index. Absent means that row is not uploading. */
  const [uploading, setUploading] = useState<Record<number, number>>({});

  useEffect(() => {
    async function load() {
      try {
        const [examData, testsData] = await Promise.all([
          getCourse(courseId),
          getCourseTests(courseId)
        ]);
        setExam(examData as any);
        // Study notes live in a subcollection now. Anything still on the
        // course document is from before that move and is carried across on
        // first save — it is not left behind.
        const fromSubcollection = await getCourseMaterials(courseId);
        const legacy = ((examData as any).materials || []).map((m: any) => ({
          name: m.name ?? '', url: m.url ?? '', minPlanTier: 1,
        }));
        // Normalised on the way in so a note saved against the withdrawn
        // "30-day and above" choice still selects something in the dropdown.
        setMaterials(
          (fromSubcollection.length > 0 ? fromSubcollection : legacy).map((m: any) => ({
            ...m, minPlanTier: normalisePlanTier(m.minPlanTier),
          })),
        );
        setTests(testsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCourse(courseId, {
        title: exam.title || 'Untitled Exam',
        description: exam.description || '',
        isPublished: exam.isPublished || false,
        // Links this course to an official NISM series, which is where the
        // storefront gets its duration, marks, pass mark and negative marking.
        nismSeries: exam.nismSeries || null,
      });
      await saveCourseMaterials(courseId, materials);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      alert('Failed to save exam.');
    } finally {
      setIsSaving(false);
    }
  };

  const addMaterial = () => {
    setMaterials([...materials, { name: '', url: '', minPlanTier: 1 }]);
  };

  const updateMaterial = (index: number, field: 'name' | 'url' | 'minPlanTier', value: string | number) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    setMaterials(updated);
  };

  const removeMaterial = (index: number) => {
    // The stored file goes too. Leaving it behind would keep paying to store
    // something nothing points at any more.
    const gone = materials[index];
    if (gone?.storagePath) deleteMaterialFile(gone.storagePath);
    setMaterials(materials.filter((_, i) => i !== index));
  };

  /**
   * Uploads a chosen file and attaches it to one study note.
   *
   * The file lands in storage first and the note is only pointed at it on
   * success, so a failed upload leaves the note exactly as it was rather than
   * referring to something that is not there.
   */
  const handleUpload = async (index: number, file: File) => {
    setUploading((u) => ({ ...u, [index]: 0 }));
    try {
      const uploaded = await uploadMaterialFile(courseId, file, (pct) =>
        setUploading((u) => ({ ...u, [index]: pct })));

      setMaterials((prev) => prev.map((m, i) => i === index ? {
        ...m,
        // A note is a file or a link, never both — the link is cleared so the
        // download route cannot be left with two sources to choose between.
        url: '',
        storagePath: uploaded.storagePath,
        fileName: uploaded.fileName,
        contentType: uploaded.contentType,
        sizeBytes: uploaded.sizeBytes,
        // An unnamed note takes the filename, which beats a blank row.
        name: m.name?.trim() ? m.name : uploaded.fileName.replace(/\.[^.]+$/, ''),
      } : m));
      toast.success(`${uploaded.fileName} uploaded.`);
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed.', { duration: 9000 });
    } finally {
      setUploading((u) => { const next = { ...u }; delete next[index]; return next; });
    }
  };

  /** Detaches the file so another can be chosen. Deletes the stored object. */
  const detachFile = (index: number) => {
    const current = materials[index];
    if (current?.storagePath) deleteMaterialFile(current.storagePath);
    setMaterials((prev) => prev.map((m, i) => i === index ? {
      ...m, storagePath: null, fileName: null, contentType: null, sizeBytes: null,
    } : m));
  };

  /**
   * Reorders study notes by drag.
   *
   * Nothing is written here: the order is the position in this list, and it is
   * saved with the rest of the course when Save is pressed. That differs from
   * mock tests, which live in their own records and are saved on drop.
   */
  const moveMaterial = (from: number, to: number) => {
    if (from === to) return;
    const next = [...materials];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setMaterials(next);
  };

  const moveMaterialUp = (idx: number) => {
    if (idx === 0) return;
    const updated = [...materials];
    const temp = updated[idx - 1];
    updated[idx - 1] = updated[idx];
    updated[idx] = temp;
    setMaterials(updated);
  };

  const moveMaterialDown = (idx: number) => {
    if (idx === materials.length - 1) return;
    const updated = [...materials];
    const temp = updated[idx + 1];
    updated[idx + 1] = updated[idx];
    updated[idx] = temp;
    setMaterials(updated);
  };

  const handleNavigateWithSave = async (targetUrl: string) => {
    setIsSaving(true);
    try {
      await updateCourse(courseId, {
        title: exam.title || 'Untitled Exam',
        description: exam.description || '',
        isPublished: exam.isPublished || false,
        // Links this course to an official NISM series, which is where the
        // storefront gets its duration, marks, pass mark and negative marking.
        nismSeries: exam.nismSeries || null,
      });
      await saveCourseMaterials(courseId, materials);
      router.push(targetUrl);
    } catch (err: any) {
      console.error(err);

      // Editing questions must not be held hostage by an unrelated save.
      //
      // This used to swallow the error into "check your network" and refuse to
      // navigate, so a permission failure on the study-notes subcollection —
      // exactly what happens while the new Firestore rules are still
      // undeployed — presented as the question editor being broken. The cause
      // is now named, and going on is the admin's decision rather than ours.
      const denied = err?.code === 'permission-denied';
      const reason = denied
        ? 'The database refused the write. This usually means the updated security rules have not been deployed yet.'
        : (err?.message || 'Unknown error.');

      const goAnyway = window.confirm(
        `Could not save this course before opening the question editor.\n\n${reason}\n\n` +
        'Open the question editor anyway? Any unsaved changes to the course details ' +
        'and study notes on this screen will be lost.',
      );
      setIsSaving(false);
      if (goAnyway) router.push(targetUrl);
    }
  };

  const handleCreateMockTest = async () => {
    const title = prompt('Enter Mock Test Title (e.g. "NISM Series V-A — Full Mock 1"):');
    if (!title) return;
    setIsCreatingTest(true);
    try {
      // Auto-save draft exam settings & materials first
      await updateCourse(courseId, {
        title: exam.title || 'Untitled Exam',
        description: exam.description || '',
        isPublished: exam.isPublished || false,
        // Links this course to an official NISM series, which is where the
        // storefront gets its duration, marks, pass mark and negative marking.
        nismSeries: exam.nismSeries || null,
      });
      await saveCourseMaterials(courseId, materials);

      const testId = await createMockTest({
        title,
        durationMinutes: 120,
        totalQuestions: 100,
        courseId,
        type: 'exam',
      });
      router.push(`/editor/tests/${testId}?courseId=${courseId}`);
    } catch (err) {
      alert('Failed to save draft and create test.');
      setIsCreatingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-100 dark:bg-[#0B0C10] transition-colors duration-300">
        <header className="shrink-0 bg-slate-50 dark:bg-[#121419] border-b border-slate-200 dark:border-[#282C36] p-4 flex items-center gap-4">
          <div className="w-8 h-8 rounded bg-slate-200 dark:bg-[#272B33] animate-pulse" />
          <div className="h-6 w-48 bg-slate-200 dark:bg-[#272B33] rounded animate-pulse" />
        </header>
        <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full space-y-8">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
        Exam not found. It may have been deleted.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-[#0B0C10] transition-colors duration-300 text-slate-900 dark:text-[#FBFBF9]">
      {/* Sticky Header */}
      <header className="shrink-0 bg-white dark:bg-[#121419] transition-colors duration-300 border-b border-slate-200 dark:border-[#282C36] p-4 flex justify-between items-center z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/editor')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-[#282C36] rounded-lg transition-colors text-slate-600 dark:text-slate-400"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {exam.title}
              <span className="text-amber-500 font-mono text-xs ml-2 tracking-widest">EXAM BUILDER</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              {materials.length} material{materials.length !== 1 ? 's' : ''} · {tests.length} mock test{tests.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.97] shadow-sm ${
            saveSuccess
              ? 'bg-emerald-500 text-white shadow-emerald-500/20'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-amber-500/20'
          } disabled:opacity-60`}
        >
          {isSaving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
          ) : saveSuccess ? (
            <><CheckCircle2 className="w-4 h-4" /> Saved!</>
          ) : (
            <><Save className="w-4 h-4" /> Save Exam</>
          )}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-4xl mx-auto w-full space-y-10 pb-32">

        {/* ── Section 1: Exam Settings ── */}
        <section className="space-y-5">
          <div className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#282C36] pb-3">
            <Settings className="w-5 h-5 text-amber-500" />
            1. Exam Settings
          </div>

          <div className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-2xl p-6 space-y-5 transition-colors">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Exam Title *
              </label>
              <input
                type="text"
                value={exam.title}
                onChange={(e) => setExam({ ...exam, title: e.target.value })}
                placeholder="e.g. NISM Series V-A — Mutual Fund Distributors"
                className="w-full bg-slate-50 dark:bg-[#0B0C10] border border-slate-200 dark:border-[#282C36] rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-semibold text-sm transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                NISM Series
              </label>
              <select
                value={exam.nismSeries || ''}
                onChange={(e) => {
                  const p = findExamPattern(e.target.value);
                  setExam({
                    ...exam,
                    nismSeries: e.target.value || null,
                    // Only fill an empty description — never overwrite copy
                    // someone has already written for this exam.
                    description: exam.description?.trim() ? exam.description : (p?.description ?? ''),
                  });
                }}
                className="w-full bg-slate-50 dark:bg-[#0B0C10] border border-slate-200 dark:border-[#282C36] rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-sm transition-colors"
              >
                <option value="">Not linked to a NISM series</option>
                {IN_SCOPE_PATTERNS.map((p) => (
                  <option key={p.series} value={p.series}>{p.series} — {p.name}</option>
                ))}
              </select>
              {(() => {
                const p = findExamPattern(exam.nismSeries);
                return p ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Storefront will show: {p.durationMinutes} minutes · {p.maxMarks} marks · pass {p.passPercent}%
                    {p.negativeMarkPercent > 0
                      ? ` · negative marking ${p.negativeMarkPercent}%`
                      : ' · no negative marking'}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed">
                    Without a series, the storefront card cannot show duration, marks or pass mark.
                  </p>
                );
              })()}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Description
              </label>
              <textarea
                value={exam.description}
                onChange={(e) => setExam({ ...exam, description: e.target.value })}
                placeholder="Short description visible to students on the storefront..."
                className="w-full bg-slate-50 dark:bg-[#0B0C10] border border-slate-200 dark:border-[#282C36] rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 h-24 resize-y text-sm transition-colors"
              />
            </div>
          </div>
        </section>

        {/* ── Section 2: Study Notes ── */}
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#282C36] pb-3">
            <div className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <BookMarked className="w-5 h-5 text-amber-500" />
              2. Study Notes
            </div>
            <button
              onClick={addMaterial}
              className="flex items-center gap-1.5 text-sm font-bold text-amber-600 dark:text-amber-500 hover:text-amber-500 dark:hover:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> Add PDF
            </button>
          </div>

          <div className="space-y-4">
            {materials.length === 0 ? (
              <div
                onClick={addMaterial}
                className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-[#282C36] hover:border-amber-500/50 dark:hover:border-amber-500/40 rounded-2xl text-slate-400 dark:text-slate-500 cursor-pointer transition-colors group"
              >
                <FileText className="w-8 h-8 mx-auto mb-3 group-hover:text-amber-500 transition-colors" />
                <p className="text-sm font-medium group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">No materials yet. Click to add a PDF link.</p>
              </div>
            ) : (
              materials.map((mat, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={() => setMatDragIndex(idx)}
                  onDragEnd={() => { setMatDragIndex(null); setMatDragOverIndex(null); }}
                  onDragOver={(e) => { e.preventDefault(); setMatDragOverIndex(idx); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (matDragIndex !== null) moveMaterial(matDragIndex, idx);
                    setMatDragIndex(null);
                    setMatDragOverIndex(null);
                  }}
                  className={`bg-white dark:bg-[#121419] border rounded-xl p-5 flex gap-4 items-start group transition-colors ${
                    matDragIndex === idx
                      ? 'opacity-40 border-amber-500'
                      : matDragOverIndex === idx
                      ? 'border-amber-500 border-dashed'
                      : 'border-slate-200 dark:border-[#282C36] hover:border-slate-300 dark:hover:border-[#323842]'
                  }`}
                >
                  <div className="mt-1 text-slate-400 dark:text-slate-500 shrink-0 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Material Name</label>
                      <input
                        type="text"
                        value={mat.name}
                        onChange={(e) => updateMaterial(idx, 'name', e.target.value)}
                        placeholder="e.g. NISM V-A Workbook 2024"
                        className="w-full bg-slate-50 dark:bg-[#0B0C10] border border-slate-200 dark:border-[#282C36] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                    {/* Upload, or paste a link.
                        An uploaded file is held by the site, so the plan
                        restriction covers the file itself. A link can only ever
                        be hidden from the page — anyone forwarded it can still
                        open it — so uploading is the option shown first. */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        File
                      </label>

                      {mat.storagePath ? (
                        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg px-3 py-2">
                          <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="text-sm text-slate-900 dark:text-white truncate flex-1" title={mat.fileName ?? ''}>
                            {mat.fileName}
                          </span>
                          <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                            {formatBytes(mat.sizeBytes)}
                          </span>
                          <button
                            type="button"
                            onClick={() => detachFile(idx)}
                            className="text-[10px] font-bold text-slate-500 hover:text-red-500 transition-colors shrink-0"
                            title="Remove this file and choose another"
                          >
                            Replace
                          </button>
                        </div>
                      ) : uploading[idx] !== undefined ? (
                        <div className="bg-slate-50 dark:bg-[#0B0C10] border border-slate-200 dark:border-[#282C36] rounded-lg px-3 py-2">
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-1.5">
                            <span>Uploading…</span>
                            <span className="tabular-nums">{uploading[idx]}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-[#282C36] overflow-hidden">
                            <div className="h-full bg-amber-500 transition-all" style={{ width: `${uploading[idx]}%` }} />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-[#0B0C10] border border-dashed border-slate-300 dark:border-[#3A404B] hover:border-amber-500 rounded-lg px-3 py-2 transition-colors">
                            <UploadCloud className="w-4 h-4 text-amber-500 shrink-0" />
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                              Upload a file (PDF, Excel, Word…)
                            </span>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = '';
                                if (f) handleUpload(idx, f);
                              }}
                            />
                          </label>
                          <input
                            type="url"
                            value={mat.url}
                            onChange={(e) => updateMaterial(idx, 'url', e.target.value)}
                            placeholder="…or paste a link"
                            className="w-full bg-slate-50 dark:bg-[#0B0C10] border border-slate-200 dark:border-[#282C36] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono transition-colors"
                          />
                        </div>
                      )}
                    </div>

                    {/* Which plans unlock this note. Enforced by Firestore
                        rules, not just hidden here — the document holding this
                        link is unreadable to a candidate below the tier. */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Available on</label>
                      <select
                        value={mat.minPlanTier ?? 1}
                        onChange={(e) => updateMaterial(idx, 'minPlanTier', Number(e.target.value))}
                        className="w-full bg-slate-50 dark:bg-[#0B0C10] border border-slate-200 dark:border-[#282C36] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors"
                      >
                        {PLAN_TIER_OPTIONS.map((o) => (
                          <option key={o.tier} value={o.tier}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-6 shrink-0">
                    <button
                      onClick={() => moveMaterialUp(idx)}
                      disabled={idx === 0}
                      className="p-1 text-slate-400 hover:text-amber-500 disabled:opacity-30 transition-colors"
                      title="Move Up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveMaterialDown(idx)}
                      disabled={idx === materials.length - 1}
                      className="p-1 text-slate-400 hover:text-amber-500 disabled:opacity-30 transition-colors"
                      title="Move Down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {mat.url && (
                      <a href={mat.url} target="_blank" rel="noopener noreferrer" className="p-1 text-slate-400 hover:text-amber-500 transition-colors" title="Preview URL">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button onClick={() => removeMaterial(idx)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Remove">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Section 3: Mock Tests ── */}
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#282C36] pb-3">
            <div className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <ClipboardList className="w-5 h-5 text-amber-500" />
              3. Mock Tests
            </div>
            <button
              onClick={handleCreateMockTest}
              disabled={isCreatingTest}
              className="flex items-center gap-1.5 text-sm font-bold text-amber-600 dark:text-amber-500 hover:text-amber-500 dark:hover:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {isCreatingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {isCreatingTest ? 'Creating...' : 'New Mock Test'}
            </button>
          </div>

          <div className="space-y-3">
            {tests.length === 0 ? (
              <div
                onClick={handleCreateMockTest}
                className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-[#282C36] hover:border-amber-500/50 dark:hover:border-amber-500/40 rounded-2xl text-slate-400 dark:text-slate-500 cursor-pointer transition-colors group"
              >
                <ClipboardList className="w-8 h-8 mx-auto mb-3 group-hover:text-amber-500 transition-colors" />
                <p className="text-sm font-medium group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">No mock tests yet. Click to create one.</p>
              </div>
            ) : (
              tests.map((test, tIdx) => (
                <div
                  key={test.id}
                  draggable
                  onDragStart={() => setDragIndex(tIdx)}
                  onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIndex(tIdx); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null) moveTest(dragIndex, tIdx);
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`bg-white dark:bg-[#121419] border rounded-xl p-5 flex items-center justify-between gap-4 transition-colors group ${
                    dragIndex === tIdx
                      ? 'opacity-40 border-amber-500'
                      : dragOverIndex === tIdx
                      ? 'border-amber-500 border-dashed'
                      : 'border-slate-200 dark:border-[#282C36] hover:border-slate-300 dark:hover:border-[#323842]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* The handle is the whole row, but this says so. */}
                    <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing shrink-0" />
                    <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                      <ClipboardList className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{test.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {test.totalQuestions} Qs · {test.durationMinutes} min
                        {test.isPublished ? (
                          <span className="ml-2 text-emerald-600 dark:text-emerald-500">· Published</span>
                        ) : (
                          <span className="ml-2 text-slate-400 dark:text-slate-500">· Draft</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleNavigateWithSave(`/editor/tests/${test.id}?courseId=${courseId}`)}
                    disabled={isSaving}
                    className="shrink-0 px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#272B33] hover:bg-amber-500 hover:text-slate-900 dark:hover:bg-amber-500 dark:hover:text-[#121419] text-slate-700 dark:text-slate-300 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSaving ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                    ) : (
                      'Edit Questions →'
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Section 4: Storefront Status ── */}
        <section className="space-y-5 pt-4 border-t border-slate-200 dark:border-[#282C36]">
          <div className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white mb-2">
            <UploadCloud className="w-5 h-5 text-emerald-500" />
            4. Storefront Status
          </div>
          <div className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-2xl p-6 flex items-center justify-between transition-colors">
            <div>
              <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">Make this exam live</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Turning this on makes the exam visible on the storefront immediately.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-6">
              <input
                type="checkbox"
                checked={exam.isPublished}
                onChange={(e) => setExam({ ...exam, isPublished: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-[#282C36] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 transition-colors" />
            </label>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full flex justify-center items-center gap-2 py-4 rounded-2xl bg-amber-500 text-slate-900 hover:bg-amber-400 transition-all text-base font-black shadow-[0_0_20px_rgba(245,158,11,0.25)] disabled:opacity-50 active:scale-[0.99]"
          >
            {isSaving ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Saving to Database...</>
            ) : saveSuccess ? (
              <><CheckCircle2 className="w-5 h-5" /> Saved Successfully!</>
            ) : (
              <><Save className="w-5 h-5" /> Save & Publish Exam</>
            )}
          </button>
        </section>

      </div>
    </div>
  );
}
