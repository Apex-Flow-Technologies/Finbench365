'use client';

import React, { useState, useEffect, useRef, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMockTest, getTestQuestions, saveQuestionsBatch, createMockTest, updateChapter, updateCourse, updateMockTest } from '@/lib/firebase/db';
import { ParsedQuestion, parseDocxText } from '@/lib/parser';
import * as mammoth from 'mammoth';
import { UploadCloud, CheckCircle2, AlertCircle, Save, Plus, ChevronDown, ChevronUp, Trash2, ArrowLeft, Loader2 } from 'lucide-react';

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

  const handleJsonImportSubmit = () => {
    try {
      const parsed = JSON.parse(jsonImportText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setQuestions(prev => [...prev, ...parsed]);
        alert(`Successfully imported ${parsed.length} questions!`);
        setShowBulkImportModal(false);
        setJsonImportText('');
      } else {
        alert("Invalid JSON format. Must be an array of question objects.");
      }
    } catch (e) {
      alert("JSON Syntax Error. Please check your formatted JSON.");
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        if (testId !== 'new') {
          const testData = await getMockTest(testId);
          setTest(testData);
          const qData = await getTestQuestions(testId, true); // Load with solutions for the editor
          setQuestions(qData);
        } else {
          setTest({ title: 'New Mock Test', durationMinutes: 120, totalQuestions: 0 });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [testId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        
        // Use mammoth to extract raw text
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        
        // Pass to our smart parser
        const parsed = parseDocxText(text);
        
        if (parsed.length > 0) {
          // Merge with existing
          setQuestions(prev => [...prev, ...parsed]);
          alert(`Successfully parsed ${parsed.length} questions!`);
        } else {
          alert("Could not find any standard questions in this document. Please ensure it follows the format.");
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      alert("Error reading .docx file.");
    }
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = value;
    setQuestions(updated);
  };

  const addNewQuestion = () => {
    setQuestions([...questions, {
      text: "New Question...",
      options: ["", "", "", ""],
      correctOptionIndex: 0,
      explanation: "",
      difficulty: "standard"
    }]);
    setActiveQuestion(questions.length);
  };

  const removeQuestion = (index: number) => {
    if(confirm("Delete this question?")) {
      const updated = [...questions];
      updated.splice(index, 1);
      setQuestions(updated);
      setActiveQuestion(null);
    }
  }

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const effectiveCourseId = courseId || test?.courseId;

  const performSave = async () => {
    let currentTestId = testId;

    if (testId === 'new') {
      if (!effectiveCourseId) {
        alert("Error: No course ID provided to link this test to.");
        return null;
      }
      
      currentTestId = await createMockTest({
        title: testType === 'exam' ? `Final Certification Exam` : `Practice Test`, 
        durationMinutes: testType === 'exam' ? 180 : 120,
        totalQuestions: questions.length,
        chapterId: chapterId || undefined,
        courseId: effectiveCourseId,
        type: testType || 'practice'
      });

      if (chapterId) {
        await updateChapter(chapterId, { mockTestId: currentTestId });
      } else if (testType === 'exam') {
        await updateCourse(effectiveCourseId, { mockTestId: currentTestId });
      }
    } else {
      await updateMockTest(currentTestId, {
        title: test?.title || 'Mock Test',
        durationMinutes: test?.durationMinutes || 120,
        totalQuestions: questions.length,
        isPublished: test?.isPublished || false,
        type: test?.type || 'practice'
      });
    }

    await saveQuestionsBatch(currentTestId, questions, test?.type || testType || 'practice');
    return currentTestId;
  };

  const handleSaveInPlace = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const savedId = await performSave();
      if (savedId) {
        setToastMessage("Test saved successfully!");
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save test.");
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
      const parentUrl = effectiveCourseId ? `/editor/courses/${effectiveCourseId}` : '/editor';
      router.push(parentUrl);
    } catch (err) {
      console.error(err);
      alert("Failed to save test.");
      setIsSaving(false);
    }
  };

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

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-[#0B0C10] transition-colors duration-300 text-slate-900 dark:text-[#FBFBF9] relative">
      
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-slate-900 font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 bg-white dark:bg-[#121419] transition-colors duration-300 border-b border-slate-200 dark:border-[#282C36] p-4 flex flex-wrap gap-4 justify-between items-center z-10 sticky top-0 overflow-x-auto min-h-[5rem]">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => {
              const parentUrl = effectiveCourseId ? `/editor/courses/${effectiveCourseId}` : '/editor';
              router.push(parentUrl);
            }}
            className="flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-slate-100 dark:bg-[#272B33] hover:bg-slate-200 dark:hover:bg-[#323842] text-slate-700 dark:text-slate-300 transition-colors text-xs font-bold shrink-0 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Exam</span>
          </button>

          <div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-slate-500">Test Title</label>
                <input 
                  type="text" 
                  value={test?.title || ''} 
                  onChange={(e) => setTest({...test, title: e.target.value})}
                  className="font-bold text-lg bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0 p-0 w-32 sm:w-48"
                  placeholder="Enter Title..."
                />
              </div>
              
              <div className="flex flex-col gap-1 border-l border-slate-200 dark:border-slate-800 pl-4 ml-2">
                <label className="text-[10px] uppercase font-bold text-slate-500">Test Mode</label>
                <div className="flex items-center gap-3">
                  <select
                    value={test?.type || 'exam'}
                    onChange={(e) => setTest({...test, type: e.target.value})}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold rounded px-2 py-1 border-none outline-none cursor-pointer h-6"
                  >
                    <option value="practice">Practice Mode</option>
                    <option value="exam">Exam Mode</option>
                  </select>
                  <span className="text-amber-500 font-mono text-[10px] tracking-widest px-2 py-1 bg-amber-500/10 rounded h-6 flex items-center">BUILDER</span>
                </div>
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              {questions.length} Questions Loaded · Press Ctrl+S to save
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
                onChange={(e) => setTest({ ...test, isPublished: e.target.checked })}
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
            onClick={() => setShowBulkImportModal(true)}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 transition-colors text-xs font-bold shrink-0 whitespace-nowrap disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Import JSON/CSV</span>
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
        <div className="w-1/3 border-r border-slate-200 dark:border-[#282C36] bg-slate-50 dark:bg-[#121419] transition-colors duration-300 flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-[#282C36] flex justify-between items-center">
            <h3 className="font-bold">Question Bank</h3>
            <button onClick={addNewQuestion} className="p-1.5 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-slate-900 dark:text-[#121419] transition-colors">
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
                key={idx}
                onClick={() => setActiveQuestion(idx)}
                className={`w-full text-left p-3 rounded-lg border transition-colors flex items-start gap-3 ${
                  activeQuestion === idx 
                    ? 'bg-white dark:bg-[#181A1F] transition-colors duration-300 border-amber-500 shadow-sm' 
                    : 'bg-transparent border-transparent hover:bg-white dark:bg-[#181A1F] transition-colors duration-300 hover:border-slate-200 dark:border-[#282C36]'
                }`}
              >
                <div className={`w-6 h-6 rounded-md flex justify-center items-center font-mono text-xs font-bold shrink-0 ${activeQuestion === idx ? 'bg-amber-500 text-slate-900 dark:text-[#121419]' : 'bg-slate-200 dark:bg-[#272B33] text-slate-600 dark:text-slate-400'}`}>
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
                <button onClick={() => removeQuestion(activeQuestion)} className="flex items-center gap-1 text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded transition-colors text-sm font-bold">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>

              {/* Question Text */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Question Text (Supports Rich Text/Markdown)</label>
                <textarea
                  value={questions[activeQuestion].text}
                  onChange={(e) => updateQuestion(activeQuestion, 'text', e.target.value)}
                  className="w-full h-32 bg-slate-50 dark:bg-[#121419] transition-colors duration-300 border border-slate-200 dark:border-[#282C36] rounded-xl p-4 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 resize-y"
                  placeholder="Type the question here..."
                />
              </div>

              {/* Options */}
              <div className="space-y-4 bg-slate-50 dark:bg-[#121419] transition-colors duration-300 border border-slate-200 dark:border-[#282C36] p-6 rounded-2xl">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">Options & Correct Answer</h3>
                
                {questions[activeQuestion].options.map((opt: string, oIdx: number) => {
                  const letter = String.fromCharCode(65 + oIdx);
                  const isCorrect = questions[activeQuestion].correctOptionIndex === oIdx;
                  
                  return (
                    <div key={oIdx} className="flex gap-4 items-start">
                      <button 
                        onClick={() => updateQuestion(activeQuestion, 'correctOptionIndex', oIdx)}
                        className={`mt-2 w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold shrink-0 transition-colors ${
                          isCorrect ? 'bg-emerald-500 text-slate-900 dark:text-[#121419] shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-white dark:bg-[#181A1F] transition-colors duration-300 border border-slate-200 dark:border-[#282C36] text-slate-500 dark:text-slate-400 hover:border-slate-400'
                        }`}
                        title="Mark as correct answer"
                      >
                        {letter}
                      </button>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(activeQuestion, oIdx, e.target.value)}
                        className={`flex-1 bg-white dark:bg-[#181A1F] transition-colors duration-300 border rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none transition-colors ${
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
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Detailed Explanation</label>
                <textarea
                  value={questions[activeQuestion].explanation}
                  onChange={(e) => updateQuestion(activeQuestion, 'explanation', e.target.value)}
                  className="w-full h-40 bg-slate-50 dark:bg-[#121419] transition-colors duration-300 border border-slate-200 dark:border-[#282C36] rounded-xl p-4 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 resize-y"
                  placeholder="Explain why the correct answer is correct, and why others are wrong..."
                />
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Difficulty Level</label>
                  <select 
                    value={questions[activeQuestion].difficulty}
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

      {/* Bulk JSON/CSV Import Modal */}
      {showBulkImportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-[#282C36] pb-4">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-500" />
                Bulk Question Importer (JSON / Array)
              </h3>
              <button onClick={() => setShowBulkImportModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Paste a JSON array of question objects. Example format:
              </p>
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
                value={jsonImportText}
                onChange={(e) => setJsonImportText(e.target.value)}
                placeholder="Paste JSON array string here..."
                className="w-full h-48 bg-slate-50 dark:bg-[#0B0C10] border border-slate-200 dark:border-[#282C36] rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 resize-none"
              />
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
                Import Questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
