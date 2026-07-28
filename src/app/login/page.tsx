'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, 
  Mail, 
  User, 
  Key, 
  ArrowRight,
  Building2,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  ChevronDown
} from 'lucide-react';
import { auth, db } from '@/lib/firebase/config';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const redirectUrl = searchParams?.get('redirect') || '/dashboard';
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [org, setOrg] = useState('');
  const [role, setRole] = useState<'student'>('student'); // always student, admin assigned manually

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [agreeLegal, setAgreeLegal] = useState(false);
  
  const { user, loading } = useAuth();

  useEffect(() => {
    // If the user is already logged in, redirect based on role
    if (!loading && user) {
      if (user.role === 'admin' || user.role === 'editor') {
        router.push('/admin');
      } else {
        router.push(redirectUrl);
      }
    }
  }, [user, loading, router, redirectUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password || (activeTab === 'signup' && !name)) {
      setErrorMsg('Please fill in all required credentials.');
      return;
    }
    
    if (activeTab === 'signup' && !agreeLegal) {
      setErrorMsg('You must agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (activeTab === 'signin') {
        // Sign In — useEffect handles role-based redirect
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Sign Up
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        
        // Update display name
        await updateProfile(newUser, {
          displayName: name
        });
        
        // Create user document in Firestore — role always 'student' (admin assigned manually by super-admin)
        await setDoc(doc(db, 'users', newUser.uid), {
          email: newUser.email,
          name: name,
          organization: org,
          role: 'student', // SECURITY: never trust client-supplied role
          createdAt: serverTimestamp()
        });

        
        // On success, the useEffect above will redirect them based on role
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      setErrorMsg(error.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] flex items-center justify-center transition-colors duration-300">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If user is logged in, show a brief connecting screen before redirect happens
  if (user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] flex flex-col items-center justify-center space-y-6 transition-colors duration-300">
        <div className="w-16 h-16 rounded-2xl bg-white border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] border flex items-center justify-center shadow-lg">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Authentication Confirmed</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">Routing to secure portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-6 flex flex-col justify-between bg-slate-50 dark:bg-[#0B0C10] text-slate-900 dark:text-[#FBFBF9] transition-colors duration-300">
      {/* Header bar with Back Button */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-4 pb-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return</span>
        </button>
      </div>

      {/* Main Authentication Box */}
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-7 sm:p-9 border border-slate-200 bg-white shadow-xl dark:border-[#282C36] dark:bg-[#181A1F] dark:shadow-black/40 transition-colors duration-300"
        >
          <div className="text-center space-y-2 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-500">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold font-sans tracking-tight text-slate-900 dark:text-white">
              Candidate Portal Access
            </h1>
            <p className="text-xs font-sans text-slate-500 dark:text-slate-400">
              Please sign in or create your institutional account to proceed with your course enrollment and checkout.
            </p>
          </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/20 border dark:text-red-400 rounded-lg text-xs font-mono mb-4 text-center">
                  {errorMsg}
                </div>
              )}
              {/* Tabs */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 border-slate-200 dark:bg-[#121419] border dark:border-[#282C36] mb-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('signin')}
                  className={`py-2 px-4 rounded-lg font-bold text-xs transition-all ${
                    activeTab === 'signin'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-[#272B33] dark:text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('signup')}
                  className={`py-2 px-4 rounded-lg font-bold text-xs transition-all ${
                    activeTab === 'signup'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-[#272B33] dark:text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence mode="wait">
                  {activeTab === 'signup' && (
                    <motion.div
                      key="signup-name"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5 overflow-hidden"
                    >
                      <label className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                        Full Candidate Name *
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Siddharth Ramanathan"
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-slate-200 text-slate-900 dark:bg-[#121419] border dark:border-[#282C36] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-sans focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="candidate@university.edu"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-slate-200 text-slate-900 dark:bg-[#121419] border dark:border-[#282C36] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-sans focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 flex justify-between">
                    <span>Password *</span>
                    {activeTab === 'signin' && (
                      <span className="text-amber-600 dark:text-amber-500 hover:underline cursor-pointer text-[11px]">Forgot?</span>
                    )}
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-slate-200 text-slate-900 dark:bg-[#121419] border dark:border-[#282C36] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-sans focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>

                {activeTab === 'signup' && (
                  <>
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                        Institution / University (Optional)
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={org}
                          onChange={(e) => setOrg(e.target.value)}
                          placeholder="e.g. Global Institute of Finance"
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-slate-200 text-slate-900 dark:bg-[#121419] border dark:border-[#282C36] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-sans focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
                        />
                      </div>
                    </div>
                  </>
                )}
                
                {activeTab === 'signup' && (
                  <div className="flex items-start gap-3 mt-4 mb-2">
                    <input
                      type="checkbox"
                      id="legal-agreement"
                      checked={agreeLegal}
                      onChange={(e) => setAgreeLegal(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-slate-300 bg-white dark:border-[#282C36] dark:bg-[#121419] checked:bg-amber-500 checked:border-amber-500 focus:ring-amber-500 focus:ring-offset-0 transition-colors"
                    />
                    <label htmlFor="legal-agreement" className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      I agree to the <Link href="/terms" className="text-amber-600 dark:text-amber-500 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-amber-600 dark:text-amber-500 hover:underline">Privacy Policy</Link>.
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-3 py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm shadow-[0_4px_14px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-2 focus:outline-none active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <span className="animate-pulse">Authenticating with Portal...</span>
                  ) : (
                    <>
                      <span>{activeTab === 'signin' ? 'Sign In & Proceed to Checkout' : 'Create Account & Proceed'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-[#282C36]/50 flex items-center justify-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
            <span>256-Bit SSL Encrypted Institutional Session</span>
          </div>
        </motion.div>
      </div>

      <div className="text-center text-xs font-mono text-slate-500 py-4">
        © {new Date().getFullYear()} MyExams365 CBT Portal. All rights reserved.
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] pt-32 text-center text-slate-500">Loading candidate login...</div>}>
      <LoginContent />
    </Suspense>
  );
}
