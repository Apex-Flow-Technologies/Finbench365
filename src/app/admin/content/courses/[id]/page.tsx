'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { getCourse, updateCourse, getCourseTests, createMockTest } from '@/lib/firebase/db';
import { 
  ChevronLeft, Plus, Save, Settings, UploadCloud, FileText, 
  ClipboardList, Trash2, ExternalLink, CheckCircle2, Loader2,
  GripVertical, BookMarked, ChevronUp, ChevronDown
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

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

  // Materials state — flat list of {name, url}
  const [materials, setMaterials] = useState<{ name: string; url: string }[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [examData, testsData] = await Promise.all([
          getCourse(courseId),
          getCourseTests(courseId)
        ]);
        setExam(examData as any);
        setMaterials((examData as any).materials || []);
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
        materials: materials,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      alert('Failed to save exam.');
    } finally {
      setIsSaving(false);
    }
  };

  const addMaterial = () => {
    setMaterials([...materials, { name: '', url: '' }]);
  };

  const updateMaterial = (index: number, field: 'name' | 'url', value: string) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    setMaterials(updated);
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
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
        materials: materials,
      });
      router.push(targetUrl);
    } catch (err) {
      console.error(err);
      alert('Could not save draft before navigating. Please check your network and try again.');
      setIsSaving(false);
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
        materials: materials,
      });

      const testId = await createMockTest({
        title,
        durationMinutes: 120,
        totalQuestions: 100,
        courseId,
        type: 'exam',
      });
      router.push(`/admin/content/tests/${testId}?courseId=${courseId}`);
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
            onClick={() => router.push('/admin/content')}
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

      {/* No outer padding/scroll container: the admin layout already provides
          page padding and the page itself scrolls. Keeping both nested a
          scroll area inside a scroll area. */}
      <div className="flex-1 max-w-4xl mx-auto w-full space-y-10 pt-6 pb-20">

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

        {/* ── Section 2: Study Materials ── */}
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#282C36] pb-3">
            <div className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <BookMarked className="w-5 h-5 text-amber-500" />
              2. Study Materials
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
                  className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-xl p-5 flex gap-4 items-start group transition-colors hover:border-slate-300 dark:hover:border-[#323842]"
                >
                  <div className="mt-1 text-slate-400 dark:text-slate-500 shrink-0">
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
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">PDF URL (Google Drive / S3 / Any)</label>
                      <input
                        type="url"
                        value={mat.url}
                        onChange={(e) => updateMaterial(idx, 'url', e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full bg-slate-50 dark:bg-[#0B0C10] border border-slate-200 dark:border-[#282C36] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono transition-colors"
                      />
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
              tests.map((test) => (
                <div
                  key={test.id}
                  className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-xl p-5 flex items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-[#323842] transition-colors group"
                >
                  <div className="flex items-center gap-4">
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
                    onClick={() => handleNavigateWithSave(`/admin/content/tests/${test.id}?courseId=${courseId}`)}
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
