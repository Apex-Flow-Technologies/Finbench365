'use client';

import React, { useState, useEffect, useRef, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMockTest, getTestQuestions, saveQuestionsBatch, createMockTest, updateChapter } from '@/lib/firebase/db';
import { ParsedQuestion, parseDocxText } from '@/lib/parser';
import * as mammoth from 'mammoth';
import { UploadCloud, CheckCircle2, AlertCircle, Save, Plus, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

export default function TestBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading Test Builder...</div>}>
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

  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<number | null>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        if (testId !== 'new') {
          const testData = await getMockTest(testId);
          setTest(testData);
          const qData = await getTestQuestions(testId);
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

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      let currentTestId = testId;

      if (testId === 'new') {
        if (!chapterId) {
          alert("Error: No chapter ID provided to link this test to.");
          setIsSaving(false);
          return;
        }
        
        currentTestId = await createMockTest({
          title: `Mock Test`, 
          durationMinutes: 120,
          totalQuestions: questions.length,
          chapterId: chapterId 
        });

        await updateChapter(chapterId, { mockTestId: currentTestId });
      }

      await saveQuestionsBatch(currentTestId, questions);
      
      alert("Test created and questions saved securely to Firebase!");
      
      if (testId === 'new') {
        router.back();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-white">Loading Test Builder...</div>;

  return (
    <div className="flex flex-col h-full bg-[#0B0C10] text-[#FBFBF9]">
      
      {/* Header */}
      <header className="shrink-0 bg-[#121419] border-b border-[#282C36] p-4 flex justify-between items-center z-10">
        <div>
          <h1 className="text-xl font-bold">{test?.title} <span className="text-amber-500 font-mono text-sm ml-2">BUILDER</span></h1>
          <p className="text-slate-400 text-sm">{questions.length} Questions Loaded</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#272B33] text-white hover:bg-[#323842] transition-colors text-sm font-bold">
            <UploadCloud className="w-4 h-4" />
            Import .docx
          </button>
          <input type="file" accept=".docx" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          
          <button onClick={handleSaveAll} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-amber-500 text-[#121419] hover:bg-amber-400 transition-colors text-sm font-bold shadow-md disabled:opacity-50">
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : (testId === 'new' ? 'Save to Chapter' : 'Save Test')}
          </button>
        </div>
      </header>

      {/* Main Builder Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Questions List/Grid */}
        <div className="w-1/3 border-r border-[#282C36] bg-[#121419] flex flex-col">
          <div className="p-4 border-b border-[#282C36] flex justify-between items-center">
            <h3 className="font-bold">Question Bank</h3>
            <button onClick={addNewQuestion} className="p-1.5 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-[#121419] transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {questions.length === 0 && (
              <div className="p-6 text-center text-slate-500 border border-dashed border-[#282C36] rounded-xl m-2">
                No questions yet. Upload a .docx or add manually.
              </div>
            )}
            {questions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => setActiveQuestion(idx)}
                className={`w-full text-left p-3 rounded-lg border transition-colors flex items-start gap-3 ${
                  activeQuestion === idx 
                    ? 'bg-[#181A1F] border-amber-500 shadow-sm' 
                    : 'bg-transparent border-transparent hover:bg-[#181A1F] hover:border-[#282C36]'
                }`}
              >
                <div className={`w-6 h-6 rounded-md flex justify-center items-center font-mono text-xs font-bold shrink-0 ${activeQuestion === idx ? 'bg-amber-500 text-[#121419]' : 'bg-[#272B33] text-slate-400'}`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${activeQuestion === idx ? 'text-white' : 'text-slate-300'}`}>{q.text}</div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">{q.options?.length || 0} Options • {q.difficulty}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Active Question Editor */}
        <div className="flex-1 bg-[#0B0C10] overflow-y-auto">
          {activeQuestion !== null && questions[activeQuestion] ? (
            <div className="max-w-4xl mx-auto p-8 space-y-8">
              
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Edit Question {activeQuestion + 1}</h2>
                <button onClick={() => removeQuestion(activeQuestion)} className="flex items-center gap-1 text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded transition-colors text-sm font-bold">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>

              {/* Question Text */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Question Text (Supports Rich Text/Markdown)</label>
                <textarea
                  value={questions[activeQuestion].text}
                  onChange={(e) => updateQuestion(activeQuestion, 'text', e.target.value)}
                  className="w-full h-32 bg-[#121419] border border-[#282C36] rounded-xl p-4 text-white focus:outline-none focus:border-amber-500 resize-y"
                  placeholder="Type the question here..."
                />
              </div>

              {/* Options */}
              <div className="space-y-4 bg-[#121419] border border-[#282C36] p-6 rounded-2xl">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Options & Correct Answer</h3>
                
                {questions[activeQuestion].options.map((opt: string, oIdx: number) => {
                  const letter = String.fromCharCode(65 + oIdx);
                  const isCorrect = questions[activeQuestion].correctOptionIndex === oIdx;
                  
                  return (
                    <div key={oIdx} className="flex gap-4 items-start">
                      <button 
                        onClick={() => updateQuestion(activeQuestion, 'correctOptionIndex', oIdx)}
                        className={`mt-2 w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold shrink-0 transition-colors ${
                          isCorrect ? 'bg-emerald-500 text-[#121419] shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-[#181A1F] border border-[#282C36] text-slate-500 hover:border-slate-400'
                        }`}
                        title="Mark as correct answer"
                      >
                        {letter}
                      </button>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(activeQuestion, oIdx, e.target.value)}
                        className={`flex-1 bg-[#181A1F] border rounded-xl px-4 py-3 text-white focus:outline-none transition-colors ${
                          isCorrect ? 'border-emerald-500/50 focus:border-emerald-500' : 'border-[#282C36] focus:border-amber-500'
                        }`}
                        placeholder={`Option ${letter}`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Detailed Explanation</label>
                <textarea
                  value={questions[activeQuestion].explanation}
                  onChange={(e) => updateQuestion(activeQuestion, 'explanation', e.target.value)}
                  className="w-full h-40 bg-[#121419] border border-[#282C36] rounded-xl p-4 text-white focus:outline-none focus:border-amber-500 resize-y"
                  placeholder="Explain why the correct answer is correct, and why others are wrong..."
                />
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Difficulty Level</label>
                  <select 
                    value={questions[activeQuestion].difficulty}
                    onChange={(e) => updateQuestion(activeQuestion, 'difficulty', e.target.value)}
                    className="w-full bg-[#121419] border border-[#282C36] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
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
            <div className="h-full flex items-center justify-center text-slate-500 flex-col">
              <CheckCircle2 className="w-16 h-16 mb-4 opacity-20" />
              <p>Select a question from the bank or import a .docx file.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
