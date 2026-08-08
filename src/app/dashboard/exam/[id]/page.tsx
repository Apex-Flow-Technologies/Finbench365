'use client';

import React, { useState, useEffect, useRef, useMemo, use } from 'react';
import { useRouter } from 'next-nprogress-bar';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { 
  getMockTest, 
  getTestQuestions, 
  startTestAttempt,
  saveTestProgress,
  getTestAttemptsCount,
  updateAttemptHeartbeat,
  getActiveAttemptForUser,
  getUserEntitlements
} from '@/lib/firebase/db';
import { Clock, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2, LayoutGrid, AlertTriangle, ShieldCheck, Calculator as CalculatorIcon } from 'lucide-react';
import { AdminPreviewBanner } from '@/components/AdminPreviewBanner';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { orderQuestionsForAttempt } from '@/lib/exams/shuffle';
import { Calculator } from '@/components/exam/Calculator';
import { ExplanationBody } from '@/components/exam/ExplanationBody';
import { CasePanel, CaseQuestionTabs } from '@/components/exam/CasePanel';

export default function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const testId = unwrappedParams.id;
  const router = useRouter();
  const { user } = useAuth();
  
  // Test Data State
  const [test, setTest] = useState<{ id: string; title: string; durationMinutes: number; totalQuestions: number; description?: string; type?: 'practice' | 'exam'; randomiseQuestions?: boolean } | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attemptsCount, setAttemptsCount] = useState<number>(0);
  const MAX_ATTEMPTS = 10;

  // Entitlement gate. The server and Firestore rules are the real enforcement;
  // this exists so an expired candidate sees "your access ran out — renew"
  // instead of a misleading "this exam could not be found".
  const [accessDenied, setAccessDenied] = useState<null | 'expired' | 'not-enrolled' | 'misconfigured'>(null);
  const [accessCourseId, setAccessCourseId] = useState<string | null>(null);
  
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
  // The graded result as returned by the server. The browser used to recompute
  // this locally from `correctOptionIndex`, which it does not even have for a
  // certification exam — and once negative marking exists, two independent
  // scorers are two chances to disagree with each other in front of a candidate.
  const [result, setResult] = useState<{
    correctCount: number; wrongCount: number; unattemptedCount: number;
    score: number; maxMarks: number; percentage: number; passed: boolean;
    marksDeducted: number; timeTakenMs: number | null; flaggedOverTime: boolean;
  } | null>(null);

  // The timer and anti-cheat effects below deliberately do NOT depend on
  // `answers` — re-registering fullscreen listeners or restarting the countdown
  // on every answer would break both. That means the submit function they close
  // over is the one from the render in which they last ran: the moment the exam
  // started, when `answers` was still empty. An auto-submit therefore graded the
  // candidate on a blank sheet. This ref gives those effects a stable handle
  // that always resolves to the current submit, with the current answers.
  const autoSubmitRef = useRef<() => void>(() => {});
  // Synchronous re-entrancy guard. `isSubmitting` is committed asynchronously,
  // so two auto-submits fired in the same tick — timer expiry landing on the
  // third anti-cheat strike — would both pass a state-based check.
  const submitInFlightRef = useRef(false);
  // Set by the anti-cheat effect, called by its overlay button. See the note at
  // the assignment for why this is not on `window`.
  const clearWarningRef = useRef<(() => void) | null>(null);
  // Set the instant submission begins, so the anti-cheat watcher stops treating
  // our own teardown (leaving fullscreen, the confirm dialog stealing focus) as
  // a violation. Must be a ref: state would not be visible to the already-
  // registered listeners until after the next render.
  const examEndedRef = useRef(false);
  const [showCalculator, setShowCalculator] = useState(false);
  // Answer review, fetched on demand after submitting. Not loaded up front:
  // for a certification exam the answer key must not be in the browser until
  // the attempt is finished.
  const [review, setReview] = useState<Record<string, any> | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');

  /**
   * The paper as this candidate sees it.
   *
   * Ordered from the attempt id, so it is identical every time this attempt is
   * opened — a refresh or a reconnect must not reshuffle the paper underneath
   * someone who is halfway through it. Answers are stored against question ids,
   * so shuffling changes only presentation, never what has been recorded.
   */
  const orderedQuestions = useMemo(
    () => orderQuestionsForAttempt(questions, attemptId, test?.randomiseQuestions),
    [questions, attemptId, test?.randomiseQuestions],
  );

  /**
   * The other questions belonging to the same case as the current one.
   *
   * Computed against the ORDERED paper so the tab positions match what the
   * candidate is actually navigating. Empty for a standalone Section A question.
   */
  const caseSiblings = useMemo(() => {
    const caseId = orderedQuestions[currentQuestionIndex]?.caseId;
    if (!caseId) return [];
    return orderedQuestions
      .map((q: any, i: number) => ({ id: q.id, caseId: q.caseId, paperIndex: i }))
      .filter((q) => q.caseId === caseId);
  }, [orderedQuestions, currentQuestionIndex]);

  // Mark current question as visited when index changes
  useEffect(() => {
    setVisitedQuestions(prev => ({ ...prev, [currentQuestionIndex]: true }));
  }, [currentQuestionIndex]);

  // Load Test Data & Restore LocalStorage Auto-Save Backup with 15-min Disconnect Check & Firestore Fallback
  useEffect(() => {
    async function loadTest() {
      try {
        // Test metadata is readable before entitlement — we need its courseId
        // to know what entitlement to look for in the first place.
        const testData: any = await getMockTest(testId);
        const isAdminRole = user?.role === 'admin';
        setAccessCourseId(testData?.courseId || null);

        if (user && !isAdminRole) {
          if (!testData?.courseId) {
            setAccessDenied('misconfigured');
            setLoading(false);
            return;
          }
          const entitlements = await getUserEntitlements(user.uid);
          const entitlement = entitlements.find((e) => e.courseId === testData.courseId);
          if (!entitlement) {
            setAccessDenied('not-enrolled');
            setLoading(false);
            return;
          }
          if (!entitlement.isActive) {
            setAccessDenied('expired');
            setLoading(false);
            return;
          }
        }

        const [questionsData, count, activeAttempt] = await Promise.all([
          getTestQuestions(testId, false),
          user ? getTestAttemptsCount(user.uid, testId) : Promise.resolve(0),
          user ? getActiveAttemptForUser(user.uid, testId) : Promise.resolve(null),
        ]);

        setTest(testData as any);
        if (user) setAttemptsCount(count as number);

        // If it's a practice test, fetch solutions securely via our backend API route
        if ((testData as any).type === 'practice' && user) {
          try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/exams/${testId}/solutions`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              const { solutions } = await res.json();
              (questionsData as any[]).forEach((q: any) => {
                if (solutions[q.id]) {
                  q.correctOptionIndex = solutions[q.id].correctOptionIndex;
                  q.explanation = solutions[q.id].explanation;
                }
              });
            }
          } catch (e) {
            console.error("Failed to fetch solutions for practice test", e);
          }
        }

        setQuestions(questionsData as any);
        setTimeRemaining((testData as any).durationMinutes * 60);

        const isAdmin = user?.role === 'admin';

        // Auto-restore backup from LocalStorage
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

        let hasActiveSession = false;
        
        if (activeAttempt) {
          setAttemptId(activeAttempt.id);
          if (!restored && activeAttempt.answers) {
            setAnswers(activeAttempt.answers);
          }
          setStatus('in_progress');
          hasActiveSession = true;
        } else if (restored) {
          // If we restored from local storage but there's no active attempt in DB, it's a stale local state.
          hasActiveSession = false; 
        }

        // ONLY enforce 15-minute disconnect if they actually have an active session!
        if (hasActiveSession && !isAdmin) {
          const lastActiveStr = localStorage.getItem(`cbt_last_active_${testId}`);
          if (lastActiveStr) {
            const lastActive = parseInt(lastActiveStr, 10);
            const elapsedMinutes = (Date.now() - lastActive) / (1000 * 60);

            if (elapsedMinutes > 15) {
              setDisconnectExpired(true);
              localStorage.removeItem(`cbt_backup_${testId}`);
              localStorage.removeItem(`cbt_last_active_${testId}`);
              return;
            }
          }
        } else if (!hasActiveSession) {
          // No active session in Firestore. Wipe out any stale browser tracking so it doesn't ban them.
          localStorage.removeItem(`cbt_backup_${testId}`);
          localStorage.removeItem(`cbt_last_active_${testId}`);
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
      // The exam is over — anything that looks like a violation from here on is
      // us, not the candidate.
      //
      // Submitting calls document.exitFullscreen(), which fires
      // `fullscreenchange`, which this very listener read as "the candidate
      // escaped fullscreen" and charged them a strike. `setStatus('completed')`
      // runs first, but React state is asynchronous, so this effect had not been
      // torn down yet when the event arrived. A candidate who answered all 100
      // questions and pressed Submit was shown an anti-cheat warning on their
      // way out. A ref is used rather than state precisely because it updates
      // synchronously.
      if (examEndedRef.current) return;
      if (isCurrentlyWarning) return;
      isCurrentlyWarning = true;
      
      setStrikes(prev => {
        const newStrikes = prev + 1;
        if (newStrikes >= 3) {
          setIsDisqualified(true);
          autoSubmitRef.current();
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
          autoSubmitRef.current();
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

    // Handed to the overlay button through a ref rather than
    // `window.clearAntiCheatWarning`. A global was both an odd channel between
    // an effect and JSX in the same component, and — on a screen whose entire
    // purpose is discouraging tampering — a documented, callable way to dismiss
    // the anti-cheat countdown from the browser console.
    clearWarningRef.current = () => {
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
      clearWarningRef.current = null;
    };
  }, [status]);

  // Aggressive Anti-Cheat (Disable Right-Click, Selection, Copy, DevTools)
  useEffect(() => {
    if (status !== 'in_progress') return;

    const preventDefault = (e: Event) => e.preventDefault();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F12
      if (e.key === 'F12') e.preventDefault();
      
      // Prevent Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+P, Ctrl+C, etc.
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (
          key === 'i' || 
          key === 'j' || 
          key === 'u' || 
          key === 'p' || 
          key === 'c' || 
          key === 'x'
        ) {
          e.preventDefault();
        }
      }
    };

    // Attach listeners
    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('selectstart', preventDefault);
    document.addEventListener('copy', preventDefault);
    document.addEventListener('cut', preventDefault);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('selectstart', preventDefault);
      document.removeEventListener('copy', preventDefault);
      document.removeEventListener('cut', preventDefault);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [status]);

  // Timer Logic — Only for 'exam' type tests (Real Exam Feel)
  useEffect(() => {
    if (status !== 'in_progress' || test?.type !== 'exam') return;
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          autoSubmitRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status, test?.type]);

  const handleStartExam = async () => {
    if (!user) {
      alert("Your session has expired. Please sign in again.");
      return;
    }
    try {
      setIsSubmitting(true);
      // Remove any lingering disconnect timer before starting a new exam
      localStorage.removeItem(`cbt_last_active_${testId}`);
      const newAttemptId = await startTestAttempt(user.uid, testId);
      setAttemptId(newAttemptId);
      setStatus('in_progress');
    } catch (err: any) {
      console.error("[StartExam] Failed to start attempt:", err);
      // Determine error type based on message or default to generic
      const errMsg = err?.message || err?.toString() || "";
      if (errMsg.includes("permission")) {
        alert("You don't have permission to start this exam. Please check your enrollment.");
      } else if (errMsg.includes("not found")) {
        alert("This exam could not be found or has been unpublished.");
      } else if (errMsg.includes("NProgress is not defined")) {
        alert("A system error occurred. Please refresh the page and try again.");
      } else {
        alert("Unable to start the exam right now. Please check your connection and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectOption = async (optionIndex: number) => {
    if (!orderedQuestions[currentQuestionIndex]) return;
    const questionId = orderedQuestions[currentQuestionIndex].id;
    
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
    if (!orderedQuestions[currentQuestionIndex]) return;
    const qId = orderedQuestions[currentQuestionIndex].id;
    setMarkedForReview(prev => ({ ...prev, [qId]: !prev[qId] }));
    if (currentQuestionIndex < orderedQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  // A local calculateScore() used to live here and drive the results screen. It
  // counted correct answers only — no negative marking, no pass mark — and for a
  // certification exam it read a `correctOptionIndex` the browser never receives,
  // so it reported 0%. The server is now the only scorer; see /api/exams/submit.

  // Re-entrancy is guarded inside performSubmit, synchronously — see
  // submitInFlightRef. Checking `isSubmitting` here would be a stale read.
  const handleAutoSubmit = async () => {
    await performSubmit();
  };

  const handleManualSubmit = async () => {
    // The confirm dialog takes focus away from the page, which some browsers
    // report as a visibility change — another way the candidate was charged a
    // strike for doing nothing wrong. Suppressed across the dialog and restored
    // if they decide not to submit after all.
    examEndedRef.current = true;
    const confirmed = window.confirm(
      "Are you sure you want to submit your exam? You cannot change your answers after submission."
    );
    if (!confirmed) {
      examEndedRef.current = false;
      return;
    }
    await performSubmit();
  };

  const performSubmit = async () => {
    if (!attemptId || !user) return;
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    examEndedRef.current = true;
    setIsSubmitting(true);
    try {
      // Every attempt — practice included — is graded server-side against the
      // protected solutions subcollection. Practice used to score itself in the
      // browser and write the result straight to Firestore, which meant a
      // candidate could set their own score, and those scores feed the
      // "Average Accuracy" figure on the dashboard. The instant per-question
      // feedback during a practice run is unaffected: it still comes from the
      // answer key this browser already holds, and only the recorded score now
      // has to come from the server.
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
      setResult(data);

      localStorage.removeItem(`cbt_backup_${testId}`);
      localStorage.removeItem(`cbt_last_active_${testId}`);
      setStatus('completed');

      // Exit fullscreen if active
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.error("Exit fullscreen error:", err));
      }
    } catch (err: any) {
      console.error("[SubmitExam] Failed to submit:", err);
      const errMsg = err?.message || err?.toString() || "";
      if (errMsg.includes("permission-denied")) {
        alert("Submission rejected. You don't have permission.");
      } else {
        alert(err.message || "Failed to submit exam. Please try again.");
      }
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Refreshed on every render (no dependency array) so the timer and anti-cheat
  // effects, which are registered once per exam, always invoke the latest
  // closure — and therefore the latest `answers` — rather than the one captured
  // when they were registered.
  useEffect(() => {
    autoSubmitRef.current = handleAutoSubmit;
  });

  const loadReview = async () => {
    if (!user || review) { return; }
    setReviewLoading(true);
    setReviewError('');
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/exams/${testId}/solutions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load the answers.');
      setReview(data.solutions ?? {});
    } catch (err: any) {
      setReviewError(err.message);
    } finally {
      setReviewLoading(false);
    }
  };

  /**
   * Countdown clock, as h:mm:ss.
   *
   * It used to read mm:ss, so a 3-hour paper began at "180:00" — a number that
   * tells a candidate nothing about how long they have left in the terms they
   * actually think in.
   */
  const formatTime = (seconds: number) => {
    const total = Math.max(0, seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${h}:${pad(m)}:${pad(s)}`;
  };

  /** Elapsed time on the results screen, which can run past an hour. */
  const formatDuration = (ms: number) => {
    const total = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] flex items-center justify-center text-[#111B35] dark:text-white">
          <AlertCircle className="w-8 h-8 animate-spin text-amber-500 mb-2" />
        </div>
      </ProtectedRoute>
    );
  }

  if (accessDenied) {
    const copy = {
      expired: {
        title: 'Your Access Has Expired',
        body: 'Your enrolment for this course has ended, so this exam is no longer available. Renewing restores access to every test in the track along with your existing progress.',
        cta: 'Renew Access',
      },
      'not-enrolled': {
        title: 'Access Required',
        body: 'This exam is part of a paid certification track you are not currently enrolled in.',
        cta: 'View Plans',
      },
      misconfigured: {
        title: 'Exam Unavailable',
        body: 'This exam is not currently linked to a course, so access cannot be verified. Please contact support and quote this exam link.',
        cta: 'Back to Dashboard',
      },
    }[accessDenied];

    return (
      <ProtectedRoute requiredRole="student">
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] text-[#111B35] dark:text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5 text-amber-500">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-3">{copy.title}</h2>
          <p className="text-[#94A3B8] mb-7 max-w-md text-sm leading-relaxed">{copy.body}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() =>
                accessDenied === 'misconfigured'
                  ? router.push('/dashboard')
                  : router.push(accessCourseId ? `/pricing?courseId=${accessCourseId}` : '/pricing')
              }
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg transition-colors active:scale-[0.98]"
            >
              {copy.cta}
            </button>
            {accessDenied !== 'misconfigured' && (
              <button
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 bg-[#272B33] hover:bg-[#343942] text-[#111B35] dark:text-white font-semibold rounded-xl transition-colors"
              >
                Back to Dashboard
              </button>
            )}
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (disconnectExpired) {
    return (
      <ProtectedRoute requiredRole="student">
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] text-[#111B35] dark:text-white flex flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="w-16 h-16 text-amber-500 mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold mb-2">15-Minute Disconnect Window Exceeded</h2>
          <p className="text-[#475569] dark:text-[#94A3B8] mb-6 max-w-md">
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
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] text-[#111B35] dark:text-white flex flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Error Loading Exam</h2>
          <p className="text-[#475569] dark:text-[#94A3B8] mb-6">{error || "Exam not found."}</p>
          <button onClick={() => router.push('/dashboard')} className="px-6 py-2.5 bg-amber-500 text-slate-950 font-bold rounded-xl">
            Return to Dashboard
          </button>
        </div>
      </ProtectedRoute>
    );
  }

  // --- Completed Screen ---
  if (status === 'completed') {
    const passed = result?.passed ?? false;
    const cell = 'p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80';
    const label = 'text-[#475569] dark:text-[#94A3B8]';

    return (
      <ProtectedRoute requiredRole="student">
        <div className="min-h-[calc(100vh)] bg-slate-50 dark:bg-[#0B0C10] text-[#111B35] dark:text-white transition-colors duration-300 relative z-20 w-full pt-28 pb-20 px-6 flex flex-col items-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 border ${
            passed
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
          }`}>
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-extrabold mb-2">
            {isDisqualified ? 'Exam Disqualified' : 'Exam Submitted'}
          </h2>
          <p className={`${label} mb-8 text-center max-w-md`}>
            {result
              ? `You scored ${result.score} out of ${result.maxMarks}.`
              : 'Your submission was recorded.'}
          </p>

          {result && (
            <div className="bg-white dark:bg-[#181A1F] border border-slate-200 dark:border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center mb-8 space-y-6">
              <div>
                <div className={`text-xs tabular-nums ${label} mb-1 uppercase tracking-wider`}>Final Score</div>
                <div className={`text-6xl font-extrabold ${passed ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {result.percentage}%
                </div>
                <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  passed
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                }`}>
                  {passed ? 'PASSED' : 'NOT CLEARED'}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs tabular-nums pt-4 border-t border-slate-200 dark:border-white/10">
                <div className={cell}>
                  <div className={label}>Correct</div>
                  <div className="text-emerald-500 font-bold text-base">{result.correctCount}</div>
                </div>
                <div className={cell}>
                  <div className={label}>Wrong</div>
                  <div className="text-rose-500 font-bold text-base">{result.wrongCount}</div>
                </div>
                <div className={cell}>
                  {/* Called out separately: with negative marking on, leaving a
                      question blank is a deliberate strategy, not an oversight. */}
                  <div className={label}>Skipped</div>
                  <div className="text-slate-500 font-bold text-base">{result.unattemptedCount}</div>
                </div>
              </div>

              {result.marksDeducted > 0 && (
                <div className="text-xs tabular-nums text-rose-500 pt-1">
                  −{result.marksDeducted} marks deducted for wrong answers
                </div>
              )}

              {result.timeTakenMs !== null && (
                <div className={`flex items-center justify-center gap-2 text-xs tabular-nums pt-1 ${
                  result.flaggedOverTime ? 'text-amber-600 dark:text-amber-400' : label
                }`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Time taken {formatDuration(result.timeTakenMs)}
                    {test?.durationMinutes ? ` of ${formatDuration(test.durationMinutes * 60000)} allowed` : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            {/* A mock exists to be learnt from. Finishing at a bare score gave a
                candidate no way to find out what they got wrong. */}
            <button
              onClick={loadReview}
              disabled={reviewLoading}
              className="px-8 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold shadow-lg hover:bg-amber-400 transition-colors disabled:opacity-60"
            >
              {reviewLoading ? 'Loading answers…' : 'Review answers'}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-3 rounded-xl bg-slate-200 dark:bg-[#272B33] text-slate-800 dark:text-white font-bold hover:bg-slate-300 dark:hover:bg-[#343942] transition-colors"
            >
              Return to Dashboard
            </button>
          </div>

          {reviewError && (
            <p className="mt-4 text-sm text-rose-500">{reviewError}</p>
          )}

          {review && (
            <div className="w-full max-w-3xl mt-10 space-y-4 text-left">
              <h3 className="text-lg font-bold text-[#111B35] dark:text-white">
                Answer review
              </h3>
              {orderedQuestions.map((q: any, i: number) => {
                const sol = review[q.id];
                if (!sol) return null;
                const chosen = answers[q.id];
                const correct = sol.correctOptionIndex;
                const gotIt = chosen === correct;
                const skipped = chosen === undefined || chosen === null;

                return (
                  <div
                    key={q.id}
                    className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#181A1F] p-5"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
                        Question {i + 1}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        skipped ? 'bg-slate-500/10 text-slate-500'
                          : gotIt ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}>
                        {skipped ? 'Not attempted' : gotIt ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>

                    <p className="text-sm text-[#111B35] dark:text-white font-medium mb-3">{q.text}</p>

                    <div className="space-y-1.5 mb-3">
                      {q.options?.map((opt: string, oi: number) => (
                        <div
                          key={oi}
                          className={`text-sm px-3 py-2 rounded-lg border ${
                            oi === correct
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                              : oi === chosen
                              ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                              : 'border-slate-200 dark:border-white/10 text-[#475569] dark:text-[#94A3B8]'
                          }`}
                        >
                          {String.fromCharCode(65 + oi)}. {opt}
                          {oi === correct && <span className="ml-2 text-xs">← correct answer</span>}
                          {oi === chosen && oi !== correct && <span className="ml-2 text-xs">← your answer</span>}
                        </div>
                      ))}
                    </div>

                    {/* Only the correct option is explained. Walking a candidate
                        through why each distractor fails was asked to be removed —
                        the reasoning that matters is for the right answer. */}
                    {sol.explanation && (
                      <div className="rounded-lg bg-slate-50 dark:bg-[#0B0C10] border border-slate-200 dark:border-white/10 p-3">
                        <div className="text-xs font-bold text-[#475569] dark:text-[#94A3B8] mb-1">
                          Explanation
                        </div>
                        <ExplanationBody text={sol.explanation} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ProtectedRoute>
    );
  }

  // Pre-exam instructions screen
  if (status === 'pre_exam') {
    const isAdmin = user?.role === 'admin';
    const isExhausted = !isAdmin && attemptsCount >= MAX_ATTEMPTS;

    return (
      <ProtectedRoute requiredRole="student">
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] text-[#111B35] dark:text-white pt-28 pb-16 px-6">
          {isAdmin && <AdminPreviewBanner />}
          <div className="max-w-3xl mx-auto bg-white dark:bg-[#181A1F] border border-slate-200 dark:border-white/10 rounded-2xl p-8 space-y-6 shadow-2xl">
            <h1 className="text-2xl font-bold text-amber-500">{test.title} — CBT Simulator</h1>
            <p className="text-[#334155] dark:text-slate-300 text-sm">{test.description || "NISM Series V-A Official Standard Mock Exam."}</p>
            
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-200 dark:border-y-white/10 text-xs tabular-nums">
              <div>
                <div className="text-[#475569] dark:text-[#94A3B8]">Duration</div>
                <div className="font-bold text-[#111B35] dark:text-white text-sm">{test.durationMinutes} Minutes</div>
              </div>
              <div>
                <div className="text-[#475569] dark:text-[#94A3B8]">Total Questions</div>
                <div className="font-bold text-[#111B35] dark:text-white text-sm">{questions.length} Items</div>
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2 text-xs">
              <div className="font-bold text-amber-400">Institutional CBT Rules:</div>
              <ul className="list-disc pl-5 space-y-1 text-[#334155] dark:text-slate-300">
                <li>Full-screen mode is required throughout the examination.</li>
                <li>Tab switching triggers an anti-cheat countdown warning.</li>
                <li>4-Color Palette indicates Visited, Answered, Marked for Review, and Unanswered items.</li>
              </ul>
            </div>

            <LoadingButton
              onClick={handleStartExam}
              isLoading={isSubmitting}
              disabled={isExhausted || questions.length === 0}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-base transition-all h-14"
            >
              I Am Ready, Start CBT Exam
            </LoadingButton>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Active CBT Simulator Screen
  const currentQuestion = orderedQuestions[currentQuestionIndex] || {};

  return (
    <ProtectedRoute requiredRole="student">
      <div className="min-h-screen bg-slate-950 text-white flex flex-col select-none relative z-20">
        
        {showCalculator && <Calculator onClose={() => setShowCalculator(false)} />}

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
              <div className="text-5xl tabular-nums font-extrabold text-amber-500">{antiCheatWarning}s</div>
            </div>
            
            <button 
              onClick={() => clearWarningRef.current?.()}
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
              <span className={`ml-4 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${strikes > 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' : 'bg-white/5 text-[#475569] border border-white/10'}`}>
                WARNINGS: {strikes}/3
              </span>
            )}
          </div>
          <div className="flex items-center gap-6">
            <div className={`tabular-nums text-base font-bold flex items-center gap-2 ${test?.type === 'exam' ? (timeRemaining < 300 ? 'text-red-400 animate-pulse' : 'text-amber-400') : 'text-emerald-400'}`}>
              <Clock className="w-4 h-4" />
              {test?.type === 'exam' ? formatTime(timeRemaining) : 'Practice Mode'}
            </div>
            {/* NISM provides a basic calculator in the real exam, so a mock
                without one is harder than the test it simulates. */}
            <button
              type="button"
              onClick={() => setShowCalculator((v) => !v)}
              title="Calculator"
              aria-pressed={showCalculator}
              className={`px-3 py-2 h-9 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                showCalculator
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <CalculatorIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Calculator</span>
            </button>

            <LoadingButton
              onClick={handleManualSubmit}
              isLoading={isSubmitting}
              className="px-4 py-2 h-9 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all"
            >
              Submit Exam
            </LoadingButton>
          </div>
        </div>

        {/* CBT Main Split Screen */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Question View */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-6">
            <div className="max-w-3xl mx-auto space-y-6">
              
              <div className="flex justify-between items-center text-xs tabular-nums text-[#475569] border-b border-white/10 pb-3">
                <span>QUESTION {currentQuestionIndex + 1} OF {orderedQuestions.length}</span>
                {markedForReview[currentQuestion.id] && (
                  <span className="px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                    ● MARKED FOR REVIEW
                  </span>
                )}
              </div>

              {/* Case scenario. Laid out as cards rather than a paragraph:
                  four questions share this passage and a candidate scans it for
                  a figure rather than reading it through. */}
              {currentQuestion.casePassage && (
                <div className="space-y-3">
                  <CasePanel
                    passage={currentQuestion.casePassage}
                    title={currentQuestion.caseTitle}
                  />
                  <CaseQuestionTabs
                    questions={caseSiblings}
                    currentIndex={currentQuestionIndex}
                    answers={answers}
                    onSelect={setCurrentQuestionIndex}
                  />
                </div>
              )}

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
                  let iconStyle = 'bg-slate-800 text-[#475569]';
                  
                  if (test?.type === 'practice') {
                    if (isAnswered) {
                      if (isCorrectOption) {
                        buttonStyle = 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)] text-emerald-400 font-bold';
                        iconStyle = 'bg-emerald-500 text-slate-950';
                      } else if (isSelected) {
                        buttonStyle = 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.15)] text-red-400 font-bold';
                        iconStyle = 'bg-red-500 text-slate-950';
                      } else {
                        buttonStyle = 'border-white/5 bg-zinc-900/40 text-[#475569] opacity-50 cursor-not-allowed';
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
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold tabular-nums text-sm shrink-0 transition-colors ${iconStyle}`}>
                        {letter}
                      </div>
                      <div className="text-sm">{option}</div>
                    </button>
                  );
                })}
              </div>

              {/* Instant feedback, practice mode only.
                  Shows the reasoning for the CORRECT option only. Explaining
                  every distractor was tried and removed at the client's
                  request: a candidate who picks B wants to know why A is right,
                  not a walkthrough of why B, C and D are each wrong. The
                  per-option text is still captured on import, so this is a
                  display decision and can be reversed without re-importing. */}
              {test?.type === 'practice' && answers[currentQuestion.id] !== undefined && (
                <div className="mt-6 p-5 rounded-xl bg-slate-800/50 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 space-y-3">
                  <div className="flex items-center gap-2">
                    {answers[currentQuestion.id] === currentQuestion.correctOptionIndex ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    )}
                    <h3 className="font-bold text-slate-200">
                      {answers[currentQuestion.id] === currentQuestion.correctOptionIndex ? 'Correct' : 'Incorrect'}
                    </h3>
                  </div>

                  {answers[currentQuestion.id] !== currentQuestion.correctOptionIndex
                    && currentQuestion.options?.[currentQuestion.correctOptionIndex] && (
                    <p className="text-sm text-emerald-400 font-semibold">
                      Correct answer: {String.fromCharCode(65 + currentQuestion.correctOptionIndex)}.{' '}
                      {currentQuestion.options[currentQuestion.correctOptionIndex]}
                    </p>
                  )}

                  {(currentQuestion.optionExplanations?.[currentQuestion.correctOptionIndex]
                    || currentQuestion.explanation) && (
                    <ExplanationBody
                      text={currentQuestion.optionExplanations?.[currentQuestion.correctOptionIndex]
                        || currentQuestion.explanation}
                    />
                  )}
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
                  onClick={() => setCurrentQuestionIndex(prev => Math.min(orderedQuestions.length - 1, prev + 1))}
                  disabled={currentQuestionIndex === orderedQuestions.length - 1}
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
                Question Palette ({orderedQuestions.length} Items)
              </div>

              <div className="grid grid-cols-4 gap-2.5 max-h-96 overflow-y-auto pr-1">
                {orderedQuestions.map((q, idx) => {
                  const isAnswered = answers[q.id] !== undefined;
                  const isMarked = markedForReview[q.id];
                  const isVisited = visitedQuestions[idx];
                  const isCurrent = idx === currentQuestionIndex;

                  let badgeStyle = 'bg-slate-800 text-[#475569] border border-white/10'; // Not Visited
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
                      className={`h-10 rounded-lg text-xs tabular-nums transition-all ${badgeStyle} ${
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
            <div className="pt-4 border-t border-white/10 text-xs tabular-nums space-y-2">
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
