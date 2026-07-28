'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { 
  getMockTest, 
  getTestQuestions, 
  startTestAttempt, 
  saveTestProgress, 
  submitTestAttempt,
  getTestAttemptsCount,
  updateAttemptHeartbeat,
  expireAttemptDueToDisconnect,
  getActiveAttemptForUser
} from '@/lib/firebase/db';
import { Clock, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2, LayoutGrid, AlertTriangle, ShieldCheck } from 'lucide-react';
import { AdminPreviewBanner } from '@/components/AdminPreviewBanner';

export default function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const testId = unwrappedParams.id;
  const router = useRouter();
  const { user } = useAuth();
  
  // Test Data State
  const [test, setTest] = useState<{ id: string; title: string; durationMinutes: number; totalQuestions: number; description?: string; type?: 'practice' | 'exam' } | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attemptsCount, setAttemptsCount] = useState<number>(0);
  const MAX_ATTEMPTS = 10;
  
  // Anti-Cheat & Disconnect State
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [antiCheatWarning, setAntiCheatWarning] = useState<number | null>(null);
  const [strikes, setStrikes] = useState(0);
  const [disconnectExpired, setDisconnectExpired] = useState(false);
  
  // Attempt State
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [status, setStatus] = useState<'pre_exam' | 'in_progress' | 'completed'>('pre_exam');
  
  // CBT UI & 4-State Navigation State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Record<number, boolean>>({ 0: true });
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  // Mark current question as visited when index changes
  useEffect(() => {
    setVisitedQuestions(prev => ({ ...prev, [currentQuestionIndex]: true }));
  }, [currentQuestionIndex]);

  // Load Test Data & Restore LocalStorage Auto-Save Backup with 15-min Disconnect Check & Firestore Fallback
  useEffect(() => {
    async function loadTest() {
      try {
        const testData = await getMockTest(testId) as any;
        setTest(testData);
        
        if (user) {
          const count = await getTestAttemptsCount(user.uid, testId);
          setAttemptsCount(count);
        }
        
        const questionsData = await getTestQuestions(testId, true);
        setQuestions(questionsData);
        setTimeRemaining(testData.durationMinutes * 60);

        // 15-Minute Disconnection Grace Period Enforcement
        const lastActiveStr = localStorage.getItem(`cbt_last_active_${testId}`);
        const isAdminOrEditor = user?.role === 'admin' || user?.role === 'editor';

        if (lastActiveStr && !isAdminOrEditor) {
          const lastActive = parseInt(lastActiveStr, 10);
          const elapsedMinutes = (Date.now() - lastActive) / (1000 * 60);

          if (elapsedMinutes > 15) {
            setDisconnectExpired(true);
            localStorage.removeItem(`cbt_backup_${testId}`);
            localStorage.removeItem(`cbt_last_active_${testId}`);
            return;
          }
        }

        // Auto-restore backup from LocalStorage if stashed within 15 mins
        const cached = localStorage.getItem(`cbt_backup_${testId}`);
        let restored = false;
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.answers && Object.keys(parsed.answers).length > 0) {
              setAnswers(parsed.answers);
              restored = true;
            }
            if (parsed.markedForReview) setMarkedForReview(parsed.markedForReview);
          } catch (e) {
            console.error("Error restoring cached attempt", e);
          }
        }

        // Firestore Backup Recovery (if localStorage was cleared by student)
        if (!restored && user) {
          const activeAttempt = await getActiveAttemptForUser(user.uid, testId);
          if (activeAttempt) {
            setAttemptId(activeAttempt.id);
            if (activeAttempt.answers) setAnswers(activeAttempt.answers);
            setStatus('in_progress');
          }
        }
      } catch (err) {
        console.error(err);
        setError("Could not load exam data. It may not exist or is not published.");
      } finally {
        setLoading(false);
      }
    }
    loadTest();
  }, [testId, user]);

  // LocalStorage Auto-Save & Disconnect Heartbeat Synchronization (every 10s)
  useEffect(() => {
    if (status === 'in_progress' && testId) {
      const now = Date.now();
      localStorage.setItem(`cbt_backup_${testId}`, JSON.stringify({ answers, markedForReview }));
      localStorage.setItem(`cbt_last_active_${testId}`, now.toString());

      if (attemptId) {
        updateAttemptHeartbeat(attemptId).catch(() => {});
      }

      const heartbeatTimer = setInterval(() => {
        const timestamp = Date.now();
        localStorage.setItem(`cbt_last_active_${testId}`, timestamp.toString());
        if (attemptId) {
          updateAttemptHeartbeat(attemptId).catch(() => {});
        }
      }, 10000);

      return () => clearInterval(heartbeatTimer);
    }
  }, [answers, markedForReview, status, testId, attemptId]);

  // Anti-Cheat Logic (3 Strikes + 15s Timer)
  useEffect(() => {
    if (status !== 'in_progress') return;

    // Graceful check for browsers without requestFullscreen (e.g. iOS Safari)
    if (typeof document !== 'undefined' && 'requestFullscreen' in document.documentElement && document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error("Fullscreen error:", err));
    }

    let warningTimer: NodeJS.Timeout | null = null;
    let secondsLeft = 15;
    let isCurrentlyWarning = false; // Prevent double-triggering strikes

    const triggerWarning = () => {
      if (isCurrentlyWarning) return;
      isCurrentlyWarning = true;
      
      setStrikes(prev => {
        const newStrikes = prev + 1;
        if (newStrikes >= 3) {
          setIsDisqualified(true);
          handleAutoSubmit();
        }
        return newStrikes;
      });

      // Start 15s countdown
      setAntiCheatWarning(15);
      secondsLeft = 15;
      
      warningTimer = setInterval(() => {
        secondsLeft--;
        setAntiCheatWarning(secondsLeft);
        if (secondsLeft <= 0) {
          if (warningTimer) clearInterval(warningTimer);
          setIsDisqualified(true);
          handleAutoSubmit();
        }
      }, 1000);
    };

    // Note: We no longer clear the warning automatically. The user MUST click a button to clear it.
    // The button click handler is implemented in the render block.

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerWarning();
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        triggerWarning();
      }
    };

    // Expose a global function for the UI button to call to clear the warning and re-enter fullscreen
    (window as any).clearAntiCheatWarning = () => {
      if (warningTimer) clearInterval(warningTimer);
      warningTimer = null;
      isCurrentlyWarning = false;
      setAntiCheatWarning(null);
      
      if (typeof document !== 'undefined' && 'requestFullscreen' in document.documentElement && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.error("Fullscreen error:", err));
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (warningTimer) clearInterval(warningTimer);
      delete (window as any).clearAntiCheatWarning;
    };
  }, [status]);

  // Timer Logic — Only for 'exam' type tests (Real Exam Feel)
  useEffect(() => {
    if (status !== 'in_progress' || test?.type !== 'exam') return;
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status, test?.type]);

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
    if (!questions[currentQuestionIndex]) return;
    const questionId = questions[currentQuestionIndex].id;
    
    if (test?.type === 'practice' && answers[questionId] !== undefined) {
      return;
    }

    const newAnswers = { ...answers, [questionId]: optionIndex };
    setAnswers(newAnswers);
    
    if (attemptId) {
      saveTestProgress(attemptId, newAnswers).catch(err => console.error("Auto-save failed", err));
    }
  };

  const toggleMarkForReview = () => {
    if (!questions[currentQuestionIndex]) return;
    const qId = questions[currentQuestionIndex].id;
    setMarkedForReview(prev => ({ ...prev, [qId]: !prev[qId] }));
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    let incorrect = 0;
    questions.forEach(q => {
      if (answers[q.id] !== undefined) {
        if (answers[q.id] === q.correctOptionIndex) {
          correct++;
        } else {
          incorrect++;
        }
      }
    });
    return { correct, incorrect, scorePct: questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0 };
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
    if (!attemptId || !user) return;
    setIsSubmitting(true);
    try {
      if (test?.type === 'practice') {
        const { correct } = calculateScore();
        await submitTestAttempt(attemptId, answers, correct);
        setScore(correct);
      } else {
        let token = '';
        try {
          token = await user.getIdToken(true);
        } catch (tokenErr) {
          console.warn("Retrying force ID token fetch...", tokenErr);
          token = await user.getIdToken(true);
        }

        const res = await fetch('/api/exams/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            attemptId,
            testId,
            answers
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to grade exam');
        setScore(data.score);
      }
      
      localStorage.removeItem(`cbt_backup_${testId}`);
      setStatus('completed');
      
      // Exit fullscreen if active
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.error("Exit fullscreen error:", err));
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to submit exam.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
          <AlertCircle className="w-8 h-8 animate-spin text-amber-500 mb-2" />
        </div>
      </ProtectedRoute>
    );
  }

  if (disconnectExpired) {
    return (
      <ProtectedRoute requiredRole="student">
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="w-16 h-16 text-amber-500 mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold mb-2">15-Minute Disconnect Window Exceeded</h2>
          <p className="text-slate-400 mb-6 max-w-md">
            You were disconnected from the exam session for more than 15 minutes. 
            In accordance with testing regulations, this attempt has been finalized and recorded as 1 attempt.
          </p>
          <button 
            onClick={() => router.push('/dashboard')} 
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !test) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Error Loading Exam</h2>
          <p className="text-slate-400 mb-6">{error || "Exam not found."}</p>
          <button onClick={() => router.push('/dashboard')} className="px-6 py-2.5 bg-amber-500 text-slate-950 font-bold rounded-xl">
            Return to Dashboard
          </button>
        </div>
      </ProtectedRoute>
    );
  }

  // --- Completed Screen ---
  if (status === 'completed') {
    const stats = calculateScore();

    return (
      <ProtectedRoute requiredRole="student">
        <div className="min-h-[calc(100vh)] bg-slate-900 text-white transition-colors duration-300 relative z-20 w-full pt-28 pb-20 px-6 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-extrabold mb-2">
            {isDisqualified ? 'Exam Disqualified' : 'Exam Submitted Successfully'}
          </h2>
          <p className="text-slate-400 mb-8 text-center max-w-md">
            Your performance breakdown has been computed.
          </p>
          
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center mb-8 space-y-6">
            <div>
              <div className="text-xs font-mono text-slate-400 mb-1 uppercase tracking-wider">OVERALL ACCURACY</div>
              <div className="text-6xl font-extrabold text-amber-500">
                {stats.scorePct}%
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-4 border-t border-white/10">
              <div className="p-3 bg-slate-800/80 rounded-xl">
                <div className="text-slate-400">Correct Answers</div>
                <div className="text-emerald-400 font-bold text-base">{stats.correct}</div>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl">
                <div className="text-slate-400">Incorrect Answers</div>
                <div className="text-red-400 font-bold text-base">{stats.incorrect}</div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => router.push('/dashboard')}
            className="px-8 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold shadow-lg hover:bg-amber-400 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </ProtectedRoute>
    );
  }

  // Pre-exam instructions screen
  if (status === 'pre_exam') {
    const isAdminOrEditor = user?.role === 'admin' || user?.role === 'editor';
    const isExhausted = !isAdminOrEditor && attemptsCount >= MAX_ATTEMPTS;

    return (
      <ProtectedRoute requiredRole="student">
        <div className="min-h-screen bg-slate-900 text-white pt-28 pb-16 px-6">
          {isAdminOrEditor && <AdminPreviewBanner />}
          <div className="max-w-3xl mx-auto bg-zinc-900 border border-white/10 rounded-2xl p-8 space-y-6 shadow-2xl">
            <h1 className="text-2xl font-bold text-amber-500">{test.title} — CBT Simulator</h1>
            <p className="text-slate-300 text-sm">{test.description || "NISM Series V-A Official Standard Mock Exam."}</p>
            
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/10 text-xs font-mono">
              <div>
                <div className="text-slate-400">Duration</div>
                <div className="font-bold text-white text-sm">{test.durationMinutes} Minutes</div>
              </div>
              <div>
                <div className="text-slate-400">Total Questions</div>
                <div className="font-bold text-white text-sm">{questions.length} Items</div>
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2 text-xs">
              <div className="font-bold text-amber-400">Institutional CBT Rules:</div>
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                <li>Full-screen mode is required throughout the examination.</li>
                <li>Tab switching triggers an anti-cheat countdown warning.</li>
                <li>4-Color Palette indicates Visited, Answered, Marked for Review, and Unanswered items.</li>
              </ul>
            </div>

            <button
              onClick={handleStartExam}
              disabled={isExhausted || isSubmitting || questions.length === 0}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-base transition-all"
            >
              {isSubmitting ? 'Initializing Engine...' : 'I Am Ready, Start CBT Exam'}
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Active CBT Simulator Screen
  const currentQuestion = questions[currentQuestionIndex] || {};

  return (
    <ProtectedRoute requiredRole="student">
      <div className="min-h-screen bg-slate-950 text-white flex flex-col select-none relative z-20">
        
        {/* Anti-Cheat Overlay */}
        {antiCheatWarning !== null && (
          <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <AlertTriangle className="w-24 h-24 text-red-500 mb-6 animate-pulse" />
            <h2 className="text-4xl font-extrabold text-red-500 mb-4">ANTI-CHEAT WARNING</h2>
            <p className="text-xl text-slate-300 max-w-2xl mb-8 leading-relaxed">
              You have left the exam window or exited full-screen mode. This is a violation of the exam rules.
            </p>
            
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-8 max-w-md w-full shadow-lg">
              <div className="text-sm text-red-400 font-bold mb-2 uppercase tracking-widest">Strikes Recorded</div>
              <div className="text-3xl font-extrabold text-red-500">{strikes} / 3</div>
              <div className="text-xs text-red-400/80 mt-2">3 strikes will result in immediate disqualification.</div>
            </div>
            
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 mb-10 max-w-md w-full shadow-lg">
              <div className="text-sm text-amber-400 font-bold mb-2 uppercase tracking-widest">Time to Return</div>
              <div className="text-5xl font-mono font-extrabold text-amber-500">{antiCheatWarning}s</div>
            </div>
            
            <button 
              onClick={() => (window as any).clearAntiCheatWarning?.()}
              className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-lg shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all hover:scale-105 active:scale-95"
            >
              I Understand, Return to Fullscreen
            </button>
          </div>
        )}

        {/* Top Roof Header */}
        <div className="h-16 border-b border-white/10 bg-zinc-900 px-6 flex items-center justify-between shrink-0">
          <div className="font-bold text-white text-sm flex items-center gap-2">
            <span className="text-amber-500">NISM V-A</span> · {test?.title}
            {test?.type === 'exam' && (
              <span className={`ml-4 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${strikes > 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
                WARNINGS: {strikes}/3
              </span>
            )}
          </div>
          <div className="flex items-center gap-6">
            <div className={`font-mono text-base font-bold flex items-center gap-2 ${test?.type === 'exam' ? (timeRemaining < 300 ? 'text-red-400 animate-pulse' : 'text-amber-400') : 'text-emerald-400'}`}>
              <Clock className="w-4 h-4" />
              {test?.type === 'exam' ? formatTime(timeRemaining) : 'Practice Mode'}
            </div>
            <button 
              onClick={handleManualSubmit}
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all"
            >
              Submit Exam
            </button>
          </div>
        </div>

        {/* CBT Main Split Screen */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Question View */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-6">
            <div className="max-w-3xl mx-auto space-y-6">
              
              <div className="flex justify-between items-center text-xs font-mono text-slate-400 border-b border-white/10 pb-3">
                <span>QUESTION {currentQuestionIndex + 1} OF {questions.length}</span>
                {markedForReview[currentQuestion.id] && (
                  <span className="px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                    ● MARKED FOR REVIEW
                  </span>
                )}
              </div>

              <div className="text-base text-white leading-relaxed font-medium">
                {currentQuestion.text || "Loading question..."}
              </div>

              <div className="space-y-3 pt-2">
                {currentQuestion.options?.map((option: string, index: number) => {
                  const isAnswered = answers[currentQuestion.id] !== undefined;
                  const isSelected = answers[currentQuestion.id] === index;
                  const isCorrectOption = currentQuestion.correctOptionIndex === index;
                  
                  // Styles for instant feedback (Only for Practice tests)
                  let buttonStyle = 'border-white/10 bg-zinc-900/80 text-slate-300 hover:border-white/20 hover:bg-white/5';
                  let iconStyle = 'bg-slate-800 text-slate-400';
                  
                  if (test?.type === 'practice') {
                    if (isAnswered) {
                      if (isCorrectOption) {
                        buttonStyle = 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)] text-emerald-400 font-bold';
                        iconStyle = 'bg-emerald-500 text-slate-950';
                      } else if (isSelected) {
                        buttonStyle = 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.15)] text-red-400 font-bold';
                        iconStyle = 'bg-red-500 text-slate-950';
                      } else {
                        buttonStyle = 'border-white/5 bg-zinc-900/40 text-slate-500 opacity-50 cursor-not-allowed';
                      }
                    }
                  } else {
                    // Exam Mode Styling (No feedback, just select)
                    if (isSelected) {
                      buttonStyle = 'border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)] text-amber-400 font-bold';
                      iconStyle = 'bg-amber-500 text-slate-950';
                    }
                  }

                  const letter = String.fromCharCode(65 + index);
                  
                  return (
                    <button
                      key={index}
                      onClick={() => (test?.type === 'practice' && isAnswered) ? null : handleSelectOption(index)}
                      disabled={test?.type === 'practice' && isAnswered}
                      className={`w-full text-left p-4 rounded-xl border flex items-center gap-4 transition-all ${buttonStyle}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold font-mono text-sm shrink-0 transition-colors ${iconStyle}`}>
                        {letter}
                      </div>
                      <div className="text-sm">{option}</div>
                    </button>
                  );
                })}
              </div>

              {/* Instant Feedback Explanation (Only for Practice Tests) */}
              {test?.type === 'practice' && answers[currentQuestion.id] !== undefined && currentQuestion.explanation && (
                <div className="mt-6 p-5 rounded-xl bg-slate-800/50 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2 mb-2">
                    {answers[currentQuestion.id] === currentQuestion.correctOptionIndex ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    )}
                    <h3 className="font-bold text-slate-200">
                      {answers[currentQuestion.id] === currentQuestion.correctOptionIndex ? 'Correct!' : 'Incorrect'}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </div>
              )}

              {/* Navigation Actions */}
              <div className="flex items-center justify-between border-t border-white/10 pt-6 gap-3 flex-wrap">
                <button
                  onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="px-5 py-2.5 rounded-xl border border-white/10 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-xs font-bold flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                <button
                  onClick={toggleMarkForReview}
                  className="px-5 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all"
                >
                  {markedForReview[currentQuestion.id] ? 'Unmark Review & Next' : 'Mark for Review & Next'}
                </button>

                <button
                  onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  disabled={currentQuestionIndex === questions.length - 1}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5"
                >
                  Save & Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>

          {/* Right Palette Grid (4-State Legend) */}
          <div className="w-80 bg-zinc-900 border-l border-white/10 p-5 hidden lg:flex flex-col justify-between shrink-0">
            <div>
              <div className="font-bold text-white text-sm border-b border-white/10 pb-3 mb-4">
                NISM Question Palette ({questions.length} Items)
              </div>

              <div className="grid grid-cols-4 gap-2.5 max-h-96 overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const isAnswered = answers[q.id] !== undefined;
                  const isMarked = markedForReview[q.id];
                  const isVisited = visitedQuestions[idx];
                  const isCurrent = idx === currentQuestionIndex;

                  let badgeStyle = 'bg-slate-800 text-slate-400 border border-white/10'; // Not Visited
                  if (isMarked) {
                    badgeStyle = 'bg-purple-600 text-white font-bold border border-purple-400';
                  } else if (isAnswered) {
                    badgeStyle = 'bg-emerald-500 text-slate-950 font-bold';
                  } else if (isVisited) {
                    badgeStyle = 'bg-red-500 text-white font-bold';
                  }

                  return (
                    <button
                      key={q.id || idx}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`h-10 rounded-lg text-xs font-mono transition-all ${badgeStyle} ${
                        isCurrent ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-900' : ''
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="pt-4 border-t border-white/10 text-xs font-mono space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-500" />
                <span>Answered ({Object.keys(answers).length})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-purple-600" />
                <span>Marked for Review ({Object.values(markedForReview).filter(Boolean).length})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-red-500" />
                <span>Visited (Unanswered)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-slate-800" />
                <span>Not Visited</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
