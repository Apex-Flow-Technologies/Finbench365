'use client';

import React, { useState, useEffect, useRef, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMockTest, getTestQuestions, saveQuestionsBatch, createMockTest, updateChapter, updateCourse, updateMockTest } from '@/lib/firebase/db';
import { ParsedQuestion, parseDocxTextDetailed, validateQuestionPayload } from '@/lib/parser';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { Dialog, DialogActions, Button } from '@/components/admin/primitives';
import { UploadCloud, CheckCircle2, AlertCircle, AlertTriangle, Save, Plus, Trash2, ArrowLeft, Loader2, Clock } from 'lucide-react';

type Toast = { message: string; tone: 'success' | 'error' };
type ImportPreview = { source: string; questions: ParsedQuestion[]; skipped: number };

export default function TestBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-slate-900 dark:text-white">Loading Test Builder...</div>}>
      <TestBuilderContent params={params} />
    </Suspense>
  );
}

function TestBuilderContent({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const testId = unwrappedParams.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const chapterId = searchParams.get('chapterId');
  const courseId = searchParams.get('courseId');
  const testType = searchParams.get('type') as 'practice' | 'exam' | null;

  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<number | null>(0);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [jsonImportText, setJsonImportText] = useState('');
  const [jsonErrors, setJsonErrors] = useState<string[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);

  // Every question added to the bank now passes through this preview first, so
  // the author sees what the parser guessed before it lands in the editor.
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  // Unsaved-work tracking. Anything that changes the test or its questions
  // sets this; only a successful save (or the initial load) clears it.
  const [isDirty, setIsDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ids currently persisted in Firestore, so we can (a) diff for deletions and
  // (b) write generated ids back into state — without which every save created
  // a fresh copy of every question.
  const savedIdsRef = useRef<string[]>([]);
  const effectiveCourseId = courseId || test?.courseId;

  useUnsavedChanges(isDirty && !isSaving, (href) => setPendingNav(href));

  const showToast = (message: string, tone: Toast['tone'] = 'success') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), tone === 'error' ? 6000 : 3000);
  };

  useEffect(() => {
    async function load() {
      try {
        if (testId !== 'new') {
          const testData = await getMockTest(testId);
          setTest(testData);
          const qData = await getTestQuestions(testId, true); // Load with solutions for the editor
          setQuestions(qData);
          // Remembered so a question removed in the editor can actually be
          // deleted from Firestore on the next save.
          savedIdsRef.current = (qData as any[]).map((q: any) => q.id).filter(Boolean);
        } else {
          setTest({
            title: testType === 'exam' ? 'Final Certification Exam' : 'Practice Test',
            durationMinutes: testType === 'exam' ? 180 : 120,
            totalQuestions: 0,
            type: testType || 'practice',
          });
        }
      } catch (err) {
        console.error(err);
        setBlockError('Could not load this test. Check your connection and reload — nothing has been changed.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [testId, testType]);

  /* ------------------------------------------------------------ mutations */

  const patchTest = (patch: Record<string, any>) => {
    setTest((prev: any) => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  const mutateQuestions = (next: any[]) => {
    setQuestions(next);
    setIsDirty(true);
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    mutateQuestions(updated);
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const updated = [...questions];
    const opts = [...(updated[qIndex].options || [])];
    opts[optIndex] = value;
    updated[qIndex] = { ...updated[qIndex], options: opts };
    mutateQuestions(updated);
  };

  const addNewQuestion = () => {
    mutateQuestions([...questions, {
      text: 'New Question...',
      options: ['', '', '', ''],
      correctOptionIndex: 0,
      explanation: '',
      difficulty: 'standard',
    }]);
    setActiveQuestion(questions.length);
  };

  const confirmRemoveQuestion = () => {
    if (deleteIndex === null) return;
    const updated = [...questions];
    updated.splice(deleteIndex, 1);
    mutateQuestions(updated);
    setActiveQuestion(null);
    setDeleteIndex(null);
  };

  /* --------------------------------------------------------------- import */

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset immediately so re-selecting the same file still fires onChange.
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();

    // The previous try/catch sat OUTSIDE this async callback, so nothing it
    // threw was ever caught — a corrupt or password-protected .docx failed
    // silently with no message at all.
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;

        // Lazy-load mammoth (docx parser) only when a file is actually uploaded,
        // instead of shipping it in the initial bundle for every visitor of this page.
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer });
        const { questions: parsed, skipped } = parseDocxTextDetailed(result.value);

        if (parsed.length === 0) {
          showToast(
            'No questions found in this document. Each question must start with "Question 1" and list options as "a) …".',
            'error',
          );
          return;
        }
        setImportPreview({ source: file.name, questions: parsed, skipped });
      } catch (err) {
        console.error(err);
        showToast('Could not read that .docx file. Make sure it is a real Word document and not password-protected.', 'error');
      }
    };
    reader.onerror = () => {
      console.error(reader.error);
      showToast('Could not read that file from disk. Try again.', 'error');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleJsonImportSubmit = () => {
    setJsonErrors([]);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonImportText);
    } catch {
      setJsonErrors(['That is not valid JSON. Check for a missing comma, quote or bracket.']);
      return;
    }

    const { ok, questions: valid, errors } = validateQuestionPayload(parsed);
    if (!ok) {
      setJsonErrors(errors.slice(0, 12));
      return;
    }

    setShowBulkImportModal(false);
    setJsonImportText('');
    setImportPreview({ source: 'pasted JSON', questions: valid, skipped: 0 });
  };

  const applyImport = () => {
    if (!importPreview) return;
    const startIndex = questions.length;
    // `warnings` is editor-only metadata and must not reach Firestore.
    const clean = importPreview.questions.map(({ warnings, ...q }) => q);
    mutateQuestions([...questions, ...clean]);
    setActiveQuestion(startIndex);
    showToast(`Added ${clean.length} question${clean.length === 1 ? '' : 's'}. Nothing is saved until you press Save.`);
    setImportPreview(null);
  };

  /* ----------------------------------------------------------------- save */

  const performSave = async () => {
    let currentTestId = testId;
    const durationMinutes = Number(test?.durationMinutes) > 0
      ? Math.round(Number(test.durationMinutes))
      : (test?.type === 'exam' ? 180 : 120);

    if (testId === 'new') {
      if (!effectiveCourseId) {
        setBlockError('This test is not linked to a course, so there is nowhere to save it. Open it from inside a course.');
        return null;
      }

      currentTestId = await createMockTest({
        title: test?.title?.trim() || (testType === 'exam' ? 'Final Certification Exam' : 'Practice Test'),
        durationMinutes,
        totalQuestions: questions.length,
        chapterId: chapterId || undefined,
        courseId: effectiveCourseId,
        type: test?.type || testType || 'practice',
      });

      if (chapterId) {
        await updateChapter(chapterId, { mockTestId: currentTestId });
      } else if (testType === 'exam') {
        await updateCourse(effectiveCourseId, { mockTestId: currentTestId });
      }
    } else {
      // Access to a test is resolved through the course that owns it. A test
      // with no courseId (or one pointing at a deleted course) can never be
      // entitled to, so publishing it would make it silently unreadable for
      // every candidate — including paying ones. Block that here rather than
      // letting it fail later as an unexplained "exam not found".
      if ((test?.isPublished ?? false) && !effectiveCourseId) {
        setBlockError(
          "This test isn't linked to a course, so it can't be published — candidates would be unable to open it. " +
          'Create it from inside a course, or contact support to relink it.',
        );
        return null;
      }

      await updateMockTest(currentTestId, {
        title: test?.title?.trim() || 'Mock Test',
        durationMinutes,
        totalQuestions: questions.length,
        isPublished: test?.isPublished || false,
        type: test?.type || 'practice',
        // Heal legacy rows that predate courseId being required, when we can
        // infer the owning course from how the editor was opened.
        ...(effectiveCourseId ? { courseId: effectiveCourseId } : {}),
      });
    }

    const ids = await saveQuestionsBatch(
      currentTestId,
      questions,
      test?.type || testType || 'practice',
      savedIdsRef.current,
    );
    // Write the generated ids back, so the next save UPDATES these questions
    // instead of creating duplicates.
    setQuestions((prev) => prev.map((q, i) => (q.id ? q : { ...q, id: ids[i] })));
    savedIdsRef.current = ids;
    setTest((prev: any) => ({ ...prev, durationMinutes }));
    setIsDirty(false);
    return currentTestId;
  };

  const handleSaveInPlace = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const savedId = await performSave();
      if (savedId) {
        showToast('Test saved.');
        // A brand-new test lives at /new until now; move to its real URL so a
        // second save updates it instead of creating another test.
        if (testId === 'new') {
          router.replace(`/admin/content/tests/${savedId}?courseId=${effectiveCourseId}`);
        }
      }
    } catch (err) {
      console.error(err);
      setBlockError('Saving failed, so nothing was written. Your questions are still here — check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndExit = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const savedId = await performSave();
      if (!savedId) return;
      const parentUrl = effectiveCourseId ? `/admin/content/courses/${effectiveCourseId}` : '/admin/content';
      router.push(parentUrl);
    } catch (err) {
      console.error(err);
      setBlockError('Saving failed, so nothing was written. Your questions are still here — check your connection and try again.');
    } finally {
      // Previously absent. When performSave() returned null — which it does
      // when publishing is blocked for an unlinked test — this returned with
      // isSaving still true, disabling every button including Save. The only
      // way out was a reload, which discarded every unsaved question.
      setIsSaving(false);
    }
  };

  const leaveTo = (href: string) => {
    if (isDirty) {
      setPendingNav(href);
      return;
    }
    router.push(href);
  };

  const parentUrl = effectiveCourseId ? `/admin/content/courses/${effectiveCourseId}` : '/admin/content';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveInPlace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [questions, testId, effectiveCourseId, isSaving, testType, chapterId, test]);

  if (loading) return <div className="p-8 text-slate-900 dark:text-white">Loading Test Builder...</div>;

  const warnCount = importPreview?.questions.filter((q) => q.warnings?.length).length ?? 0;

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-[#0B0C10] transition-colors duration-300 text-slate-900 dark:text-[#FBFBF9] relative">

      {/* Toast Banner */}
      {toast && (
        <div
          role="status"
          className={`fixed top-4 right-4 z-50 max-w-sm px-4 py-2.5 rounded-xl shadow-lg flex items-start gap-2 text-sm font-bold ${
            toast.tone === 'error' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-slate-900'
          }`}
        >
          {toast.tone === 'error'
            ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 bg-white dark:bg-[#121419] transition-colors duration-300 border-b border-slate-200 dark:border-[#282C36] p-4 flex flex-wrap gap-4 justify-between items-center z-10 sticky top-0 min-h-[5rem]">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => leaveTo(parentUrl)}
            className="flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-slate-100 dark:bg-[#272B33] hover:bg-slate-200 dark:hover:bg-[#323842] text-slate-700 dark:text-slate-300 transition-colors text-xs font-bold shrink-0 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Exam</span>
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="test-title" className="text-[10px] uppercase font-bold text-slate-500">Test Title</label>
                <input
                  id="test-title"
                  type="text"
                  value={test?.title || ''}
                  onChange={(e) => patchTest({ title: e.target.value })}
                  className="font-bold text-lg bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0 p-0 w-32 sm:w-48"
                  placeholder="Enter Title..."
                />
              </div>

              <div className="flex flex-col gap-1 border-l border-slate-200 dark:border-slate-800 pl-4">
                <label htmlFor="test-mode" className="text-[10px] uppercase font-bold text-slate-500">Test Mode</label>
                <div className="flex items-center gap-3">
                  <select
                    id="test-mode"
                    value={test?.type || 'practice'}
                    onChange={(e) => patchTest({ type: e.target.value })}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold rounded px-2 py-1 border-none outline-none cursor-pointer h-6"
                  >
                    <option value="practice">Practice Mode</option>
                    <option value="exam">Exam Mode</option>
                  </select>
                </div>
              </div>

              {/* Duration was hardcoded at 120 minutes with no way to change it,
                  so every test ran for the same time regardless of length. */}
              <div className="flex flex-col gap-1 border-l border-slate-200 dark:border-slate-800 pl-4">
                <label htmlFor="test-duration" className="text-[10px] uppercase font-bold text-slate-500">Duration</label>
                <div className="flex items-center gap-1.5 h-6">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    id="test-duration"
                    type="number"
                    min={1}
                    max={600}
                    value={test?.durationMinutes ?? ''}
                    onChange={(e) => patchTest({ durationMinutes: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-14 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold rounded px-2 py-1 border-none outline-none"
                  />
                  <span className="text-xs text-slate-500 font-bold">min</span>
                </div>
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              {questions.length} Questions Loaded · Press Ctrl+S to save
              {isDirty && <span className="text-amber-500 font-bold"> · Unsaved changes</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer bg-slate-100 dark:bg-[#272B33] h-10 px-4 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-[#323842] transition-colors shrink-0 whitespace-nowrap">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {test?.isPublished ? 'Published' : 'Draft'}
            </span>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={test?.isPublished || false}
                onChange={(e) => patchTest({ isPublished: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 dark:bg-[#121419] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 transition-colors" />
            </div>
          </label>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-slate-100 dark:bg-[#272B33] text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-[#323842] transition-colors text-xs font-bold shrink-0 whitespace-nowrap disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Import .docx</span>
          </button>
          <input type="file" accept=".docx" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

          <button
            onClick={() => { setJsonErrors([]); setShowBulkImportModal(true); }}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 transition-colors text-xs font-bold shrink-0 whitespace-nowrap disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Import JSON</span>
          </button>

          <button
            onClick={handleSaveInPlace}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-slate-200 dark:bg-[#272B33] hover:bg-slate-300 dark:hover:bg-[#323842] text-slate-800 dark:text-slate-200 transition-colors text-xs font-bold shrink-0 whitespace-nowrap disabled:opacity-50"
            title="Save in-place (Ctrl+S)"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save</span>
          </button>

          <button
            onClick={handleSaveAndExit}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 transition-all text-xs font-bold shrink-0 whitespace-nowrap disabled:opacity-50 active:scale-95 shadow-md shadow-amber-500/20"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{isSaving ? 'Saving...' : 'Save & Exit'}</span>
          </button>
        </div>
      </header>

      {/* Main Builder Content */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: Questions List/Grid */}
        <div className="w-1/3 min-w-[220px] border-r border-slate-200 dark:border-[#282C36] bg-slate-50 dark:bg-[#121419] transition-colors duration-300 flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-[#282C36] flex justify-between items-center">
            <h3 className="font-bold">Question Bank</h3>
            <button
              onClick={addNewQuestion}
              title="Add a question"
              className="p-1.5 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-slate-900 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {questions.length === 0 && (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-[#282C36] rounded-xl m-2">
                No questions yet. Upload a .docx or add manually.
              </div>
            )}
            {questions.map((q, idx) => (
              <button
                key={q.id || idx}
                onClick={() => setActiveQuestion(idx)}
                className={`w-full text-left p-3 rounded-lg border transition-colors flex items-start gap-3 ${
                  activeQuestion === idx
                    ? 'bg-white dark:bg-[#181A1F] border-amber-500 shadow-sm'
                    : 'bg-transparent border-transparent hover:bg-white dark:hover:bg-[#181A1F] hover:border-slate-200 dark:hover:border-[#282C36]'
                }`}
              >
                <div className={`w-6 h-6 rounded-md flex justify-center items-center font-mono text-xs font-bold shrink-0 ${activeQuestion === idx ? 'bg-amber-500 text-slate-900' : 'bg-slate-200 dark:bg-[#272B33] text-slate-600 dark:text-slate-400'}`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${activeQuestion === idx ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{q.text}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">{q.options?.length || 0} Options • {q.difficulty}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Active Question Editor */}
        <div className="flex-1 bg-slate-100 dark:bg-[#0B0C10] transition-colors duration-300 overflow-y-auto">
          {activeQuestion !== null && questions[activeQuestion] ? (
            <div className="max-w-4xl mx-auto p-8 space-y-8">

              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Edit Question {activeQuestion + 1}</h2>
                <button onClick={() => setDeleteIndex(activeQuestion)} className="flex items-center gap-1 text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded transition-colors text-sm font-bold">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>

              {/* Question Text */}
              <div className="space-y-2">
                <label htmlFor="q-text" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Question Text (Supports Rich Text/Markdown)</label>
                <textarea
                  id="q-text"
                  value={questions[activeQuestion].text}
                  onChange={(e) => updateQuestion(activeQuestion, 'text', e.target.value)}
                  className="w-full h-32 bg-slate-50 dark:bg-[#121419] transition-colors duration-300 border border-slate-200 dark:border-[#282C36] rounded-xl p-4 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 resize-y"
                  placeholder="Type the question here..."
                />
              </div>

              {/* Options */}
              <div className="space-y-4 bg-slate-50 dark:bg-[#121419] transition-colors duration-300 border border-slate-200 dark:border-[#282C36] p-6 rounded-2xl">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">Options &amp; Correct Answer</h3>

                {(questions[activeQuestion].options || []).map((opt: string, oIdx: number) => {
                  const letter = String.fromCharCode(65 + oIdx);
                  const isCorrect = questions[activeQuestion].correctOptionIndex === oIdx;

                  return (
                    <div key={oIdx} className="flex gap-4 items-start">
                      <button
                        onClick={() => updateQuestion(activeQuestion, 'correctOptionIndex', oIdx)}
                        aria-pressed={isCorrect}
                        className={`mt-2 w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold shrink-0 transition-colors ${
                          isCorrect ? 'bg-emerald-500 text-slate-900 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-white dark:bg-[#181A1F] border border-slate-200 dark:border-[#282C36] text-slate-500 dark:text-slate-400 hover:border-slate-400'
                        }`}
                        title={`Mark option ${letter} as the correct answer`}
                      >
                        {letter}
                      </button>
                      <input
                        type="text"
                        value={opt}
                        aria-label={`Option ${letter}`}
                        onChange={(e) => updateOption(activeQuestion, oIdx, e.target.value)}
                        className={`flex-1 bg-white dark:bg-[#181A1F] border rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none transition-colors ${
                          isCorrect ? 'border-emerald-500/50 focus:border-emerald-500' : 'border-slate-200 dark:border-[#282C36] focus:border-amber-500'
                        }`}
                        placeholder={`Option ${letter}`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              <div className="space-y-2">
                <label htmlFor="q-explanation" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Detailed Explanation</label>
                <textarea
                  id="q-explanation"
                  value={questions[activeQuestion].explanation || ''}
                  onChange={(e) => updateQuestion(activeQuestion, 'explanation', e.target.value)}
                  className="w-full h-40 bg-slate-50 dark:bg-[#121419] transition-colors duration-300 border border-slate-200 dark:border-[#282C36] rounded-xl p-4 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 resize-y"
                  placeholder="Explain why the correct answer is correct, and why others are wrong..."
                />
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="q-difficulty" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Difficulty Level</label>
                  <select
                    id="q-difficulty"
                    value={questions[activeQuestion].difficulty || 'standard'}
                    onChange={(e) => updateQuestion(activeQuestion, 'difficulty', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#121419] transition-colors duration-300 border border-slate-200 dark:border-[#282C36] rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="standard">Standard</option>
                    <option value="hard">Hard</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400 flex-col">
              <CheckCircle2 className="w-16 h-16 mb-4 opacity-20" />
              <p>Select a question from the bank or import a .docx file.</p>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- dialogs */}

      {/* Import preview — nothing enters the bank until this is confirmed */}
      <Dialog
        open={!!importPreview}
        title="Review before importing"
        description={importPreview
          ? `${importPreview.questions.length} question${importPreview.questions.length === 1 ? '' : 's'} read from ${importPreview.source}.`
          : undefined}
        onClose={() => setImportPreview(null)}
      >
        {importPreview && (
          <div className="space-y-4">
            {importPreview.skipped > 0 && (
              <div className="flex items-start gap-2 text-xs p-3 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {importPreview.skipped} block{importPreview.skipped === 1 ? '' : 's'} looked like a question but had no
                  options in the “a) …” format, so {importPreview.skipped === 1 ? 'it was' : 'they were'} skipped.
                </span>
              </div>
            )}

            {warnCount > 0 ? (
              <div className="flex items-start gap-2 text-xs p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>{warnCount} of {importPreview.questions.length}</strong> need checking. Where the document had no
                  answer key the importer defaults to option A — that is a guess, not an answer. Fix these in the editor
                  before you publish.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-xs p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Every question has a full set of options and an explicit answer key.</span>
              </div>
            )}

            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
              {importPreview.questions.map((q, i) => (
                <div key={i} className="p-3 text-xs">
                  <div className="flex gap-2">
                    <span className="font-mono text-slate-400 shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-700 dark:text-slate-300 line-clamp-2">{q.text || <em>(no text)</em>}</p>
                      <p className="text-slate-500 mt-1">
                        Answer: <strong>{String.fromCharCode(65 + q.correctOptionIndex)}</strong>
                        {q.options[q.correctOptionIndex] ? ` — ${q.options[q.correctOptionIndex].slice(0, 60)}` : ''}
                      </p>
                      {q.warnings?.map((w, wi) => (
                        <p key={wi} className="text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {w}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <DialogActions>
          <Button variant="secondary" onClick={() => setImportPreview(null)}>Cancel</Button>
          <Button onClick={applyImport}>
            Add {importPreview?.questions.length} question{importPreview?.questions.length === 1 ? '' : 's'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Leave-with-unsaved-work guard */}
      <Dialog
        open={!!pendingNav}
        title="Leave without saving?"
        description="Your changes to this test have not been saved. Leaving now discards them."
        onClose={() => setPendingNav(null)}
      >
        <DialogActions>
          <Button variant="secondary" onClick={() => setPendingNav(null)}>Stay here</Button>
          <Button
            onClick={async () => {
              const href = pendingNav!;
              setPendingNav(null);
              setIsSaving(true);
              try {
                const saved = await performSave();
                if (!saved) return;
                router.push(href);
              } catch (err) {
                console.error(err);
                setBlockError('Saving failed, so nothing was written and you are still on this page.');
              } finally {
                setIsSaving(false);
              }
            }}
          >
            Save, then leave
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const href = pendingNav!;
              setIsDirty(false);
              setPendingNav(null);
              // isDirty is read from a ref inside the guard, so the push has to
              // wait a tick for the state above to land.
              setTimeout(() => router.push(href), 0);
            }}
          >
            Discard
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete question */}
      <Dialog
        open={deleteIndex !== null}
        title={`Delete question ${(deleteIndex ?? 0) + 1}?`}
        description="It is removed from Firestore the next time you save."
        onClose={() => setDeleteIndex(null)}
      >
        <DialogActions>
          <Button variant="secondary" onClick={() => setDeleteIndex(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmRemoveQuestion}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Blocking errors that used to be alert() */}
      <Dialog
        open={!!blockError}
        title="Can’t do that"
        description={blockError ?? undefined}
        onClose={() => setBlockError(null)}
      >
        <DialogActions>
          <Button onClick={() => setBlockError(null)}>Got it</Button>
        </DialogActions>
      </Dialog>

      {/* Bulk JSON Import Modal */}
      {showBulkImportModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowBulkImportModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="json-import-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6"
          >
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-[#282C36] pb-4">
              <h3 id="json-import-title" className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-500" />
                Bulk Question Importer (JSON)
              </h3>
              <button onClick={() => setShowBulkImportModal(false)} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <label htmlFor="json-import" className="block text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Paste a JSON array of question objects. Example format:
              </label>
              <pre className="p-3 bg-slate-900 text-amber-400 rounded-xl text-[11px] font-mono overflow-x-auto">
{`[
  {
    "text": "What is the minimum NAV publication frequency for open-ended schemes?",
    "options": ["Daily", "Weekly", "Monthly", "Quarterly"],
    "correctOptionIndex": 0,
    "explanation": "Open-ended scheme NAVs must be published daily on AMFI site.",
    "difficulty": "standard"
  }
]`}
              </pre>

              <textarea
                id="json-import"
                value={jsonImportText}
                onChange={(e) => { setJsonImportText(e.target.value); setJsonErrors([]); }}
                placeholder="Paste JSON array string here..."
                className="w-full h-48 bg-slate-50 dark:bg-[#0B0C10] border border-slate-200 dark:border-[#282C36] rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 resize-none"
              />

              {jsonErrors.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Nothing was imported:
                  </p>
                  {jsonErrors.map((err, i) => <p key={i}>• {err}</p>)}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-[#282C36]">
              <button
                onClick={() => setShowBulkImportModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#282C36] text-xs font-bold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleJsonImportSubmit}
                disabled={!jsonImportText.trim()}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all disabled:opacity-50"
              >
                Check &amp; Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
