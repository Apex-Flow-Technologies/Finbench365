'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { 
  getMockTest, 
  getTestQuestions, 
  startTestAttempt, 
  saveTestProgress, 
  submitTestAttempt 
} from '@/lib/firebase/db';
import { Clock, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2, LayoutGrid } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

export default function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const testId = unwrappedParams.id;
  const router = useRouter();
  const { user } = useAuth();
  
  // Test Data State
  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Attempt State
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [status, setStatus] = useState<'pre_exam' | 'in_progress' | 'completed'>('pre_exam');
  
  // UI State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  // Load Test Data
  useEffect(() => {
    async function loadTest() {
      try {
        const testData = await getMockTest(testId);
        setTest(testData);
        
        // In a real scenario, we might only load questions AFTER starting the test
        // but for UX, loading them now is fine.
        const questionsData = await getTestQuestions(testId);
        setQuestions(questionsData);
        
        // Initial time remaining based on test duration
        setTimeRemaining(testData.durationMinutes * 60);
      } catch (err: any) {
        console.error(err);
        setError("Could not load exam data. It may not exist or is not published.");
      } finally {
        setLoading(false);
      }
    }
    loadTest();
  }, [testId]);

  // Timer Logic (Strict One-Sitting)
  // In a production app, the remaining time should be calculated against the 
  // serverTimestamp of the attempt's startTime to prevent local manipulation.
  // We simulate that strictly here by decrementing every second once started.
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === 'in_progress' && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status, timeRemaining]);

  const handleStartExam = async () => {
    if (!user) return;
    try {
      setIsSubmitting(true);
      const newAttemptId = await startTestAttempt(user.uid, testId);
      setAttemptId(newAttemptId);
      setStatus('in_progress');
    } catch (err) {
      console.error(err);
      alert("Failed to start exam. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectOption = async (optionIndex: number) => {
    const questionId = questions[currentQuestionIndex].id;
    const newAnswers = { ...answers, [questionId]: optionIndex };
    setAnswers(newAnswers);
    
    // Auto-save progress in background
    if (attemptId) {
      saveTestProgress(attemptId, newAnswers).catch(err => console.error("Auto-save failed", err));
    }
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correctOptionIndex) {
        correct++;
      }
    });
    return correct;
  };

  const handleAutoSubmit = async () => {
    if (isSubmitting) return;
    await performSubmit();
  };

  const handleManualSubmit = async () => {
    if (window.confirm("Are you sure you want to submit your exam? You cannot change your answers after submission.")) {
      await performSubmit();
    }
  };

  const performSubmit = async () => {
    if (!attemptId) return;
    setIsSubmitting(true);
    try {
      const finalScore = calculateScore();
      await submitTestAttempt(attemptId, answers, finalScore);
      setScore(finalScore);
      setStatus('completed');
    } catch (err) {
      console.error(err);
      alert("Failed to submit exam.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121419] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#121419] flex flex-col items-center justify-center p-6">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Exam Unavailable</h2>
        <p className="text-slate-400">{error}</p>
        <button onClick={() => router.push('/dashboard')} className="mt-6 px-6 py-2 bg-[#272B33] text-white rounded-lg">Return to Dashboard</button>
      </div>
    );
  }

  // --- Pre Exam Screen ---
  if (status === 'pre_exam') {
    return (
      <ProtectedRoute requiredRole="student">
        <div className="min-h-[calc(100vh)] bg-[#121419] text-[#FBFBF9] relative z-20 w-full flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-[#181A1F] border border-[#282C36] rounded-2xl p-8 shadow-xl">
            <h1 className="text-3xl font-bold text-white mb-2">{test?.title}</h1>
            <p className="text-slate-400 mb-8">{test?.description || "Institutional Computer-Based Testing Environment"}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-[#121419] border border-[#282C36] rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-mono">DURATION</div>
                  <div className="font-bold text-lg text-white">{test?.durationMinutes} Minutes</div>
                </div>
              </div>
              <div className="bg-[#121419] border border-[#282C36] rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-mono">QUESTIONS</div>
                  <div className="font-bold text-lg text-white">{test?.totalQuestions || questions.length} Items</div>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-8 text-sm text-amber-500/90 flex gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p><strong>Strict One-Sitting Rule:</strong> Once you start the exam, the timer cannot be paused. If you leave this page, the timer will continue running on the server. Ensure you have a stable connection.</p>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 rounded-xl border border-[#282C36] text-white font-bold hover:bg-[#272B33] transition-colors"
              >
                Go Back
              </button>
              <button 
                onClick={handleStartExam}
                disabled={isSubmitting || questions.length === 0}
                className="flex-1 px-6 py-3 rounded-xl bg-amber-500 text-[#121419] font-bold shadow-md hover:bg-amber-400 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Starting...' : 'I am ready, Start Exam'}
              </button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // --- Completed Screen ---
  if (status === 'completed') {
    const percentage = score !== null ? Math.round((score / questions.length) * 100) : 0;
    return (
      <ProtectedRoute requiredRole="student">
        <div className="min-h-[calc(100vh)] bg-[#121419] text-[#FBFBF9] relative z-20 w-full pt-28 pb-20 px-6 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Exam Submitted Successfully</h2>
          <p className="text-slate-400 mb-8">Your institutional performance report has been generated.</p>
          
          <div className="bg-[#181A1F] border border-[#282C36] rounded-2xl p-8 max-w-md w-full shadow-xl text-center mb-8">
            <div className="text-sm font-mono text-slate-500 mb-2">FINAL SCORE</div>
            <div className="text-5xl font-bold text-amber-500 mb-4">{percentage}%</div>
            <div className="text-slate-300">
              You answered <strong className="text-white">{score}</strong> out of <strong className="text-white">{questions.length}</strong> questions correctly.
            </div>
          </div>

          <button 
            onClick={() => router.push('/dashboard')}
            className="px-8 py-3 rounded-xl bg-amber-500 text-[#121419] font-bold shadow-md hover:bg-amber-400 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </ProtectedRoute>
    );
  }

  // --- CBT Interface ---
  const currentQuestion = questions[currentQuestionIndex];
  
  return (
    <ProtectedRoute requiredRole="student">
      <div className="min-h-[calc(100vh)] bg-[#0B0C10] text-[#FBFBF9] relative z-20 w-full flex flex-col">
        {/* Top Navbar for CBT */}
        <div className="h-16 border-b border-[#282C36] bg-[#121419] flex items-center justify-between px-6 shrink-0">
          <div className="font-bold text-white tracking-tight">{test?.title}</div>
          <div className="flex items-center gap-6">
            <div className={`font-mono text-lg font-bold flex items-center gap-2 ${timeRemaining < 300 ? 'text-red-500' : 'text-amber-500'}`}>
              <Clock className="w-5 h-5" />
              {formatTime(timeRemaining)}
            </div>
            <button 
              onClick={handleManualSubmit}
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-sm font-bold hover:bg-emerald-500 hover:text-[#121419] transition-all"
            >
              Submit Exam
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Question Area */}
          <div className="flex-1 overflow-y-auto p-8 lg:p-12">
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between text-xs font-mono text-slate-500 mb-6">
                <span>QUESTION {currentQuestionIndex + 1} OF {questions.length}</span>
                <span>{currentQuestion?.difficulty?.toUpperCase() || 'STANDARD'} DIFFICULTY</span>
              </div>
              
              <div className="text-lg text-white mb-10 leading-relaxed font-sans">
                {currentQuestion?.text}
              </div>

              <div className="space-y-3">
                {currentQuestion?.options?.map((option: string, index: number) => {
                  const isSelected = answers[currentQuestion.id] === index;
                  const letter = String.fromCharCode(65 + index); // A, B, C, D
                  return (
                    <button
                      key={index}
                      onClick={() => handleSelectOption(index)}
                      className={`w-full text-left p-4 rounded-xl border flex items-center gap-4 transition-all ${
                        isSelected 
                          ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.1)]' 
                          : 'border-[#282C36] bg-[#181A1F] hover:border-slate-500 hover:bg-[#272B33]'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold font-mono text-sm shrink-0 ${
                        isSelected ? 'bg-amber-500 text-[#121419]' : 'bg-[#121419] text-slate-400 border border-[#282C36]'
                      }`}>
                        {letter}
                      </div>
                      <div className={`font-medium text-sm ${isSelected ? 'text-amber-500' : 'text-slate-300'}`}>
                        {option}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Navigation Footer */}
              <div className="mt-12 flex items-center justify-between border-t border-[#282C36] pt-6">
                <button
                  onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#282C36] text-white font-bold hover:bg-[#272B33] disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <button
                  onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  disabled={currentQuestionIndex === questions.length - 1}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-[#121419] font-bold hover:bg-slate-200 disabled:opacity-30 transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Navigation Grid */}
          <div className="w-80 bg-[#121419] border-l border-[#282C36] flex flex-col hidden lg:flex">
            <div className="p-4 font-bold text-white border-b border-[#282C36] text-sm flex justify-between items-center">
              <span>Question Navigator</span>
            </div>
            <div className="p-4 grid grid-cols-4 gap-2 overflow-y-auto">
              {questions.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined;
                const isCurrent = idx === currentQuestionIndex;
                
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`h-10 rounded-lg text-xs font-bold font-mono border transition-all ${
                      isCurrent 
                        ? 'border-amber-500 text-amber-500' 
                        : isAnswered
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                          : 'border-[#282C36] bg-[#181A1F] text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            
            <div className="mt-auto p-4 border-t border-[#282C36] text-xs font-mono text-slate-500 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-500/10 border border-emerald-500/50"></div>
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-[#181A1F] border border-[#282C36]"></div>
                <span>Unanswered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded border border-amber-500"></div>
                <span>Current</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
