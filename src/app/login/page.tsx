'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  ArrowLeft
} from 'lucide-react';
import { auth, db } from '@/lib/firebase/config';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const { user, loading } = useAuth();

  useEffect(() => {
    // If the user is already logged in, redirect them to the intended URL or dashboard
    if (!loading && user) {
      router.push(redirectUrl);
    }
  }, [user, loading, router, redirectUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password || (activeTab === 'signup' && !name)) {
      setErrorMsg('Please fill in all required credentials.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (activeTab === 'signin') {
        // Sign In
        await signInWithEmailAndPassword(auth, email, password);
        // On success, the useEffect above will redirect them
      } else {
        // Sign Up
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        
        // Update display name
        await updateProfile(newUser, {
          displayName: name
        });
        
        // Create user document in Firestore with default 'student' role
        await setDoc(doc(db, 'users', newUser.uid), {
          email: newUser.email,
          name: name,
          organization: org,
          role: 'student',
          createdAt: new Date().toISOString()
        });
        
        // On success, the useEffect above will redirect them
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
      <div className="min-h-screen bg-[#121419] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If user is logged in, show a brief connecting screen before redirect happens
  if (user) {
    return (
      <div className="min-h-screen bg-[#121419] flex flex-col items-center justify-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#181A1F] border border-[#282C36] flex items-center justify-center shadow-lg">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">Authentication Confirmed</h2>
          <p className="text-sm text-slate-400 font-mono">Routing to secure portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-6 flex flex-col justify-between bg-[#121419] text-[#FBFBF9]">
      {/* Header bar with Back Button */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-4 pb-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors"
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
          className="rounded-3xl p-7 sm:p-9 border border-[#282C36] bg-[#181A1F] shadow-xl shadow-black/40"
        >
          <div className="text-center space-y-2 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-500">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold font-sans tracking-tight text-white">
              Candidate Portal Access
            </h1>
            <p className="text-xs font-sans text-slate-400">
              Please sign in or create your institutional account to proceed with your course enrollment and checkout.
            </p>
          </div>

              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-mono mb-4 text-center">
                  {errorMsg}
                </div>
              )}
              {/* Tabs */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#121419] border border-[#282C36] mb-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('signin')}
                  className={`py-2 px-4 rounded-lg font-bold text-xs transition-all ${
                    activeTab === 'signin'
                      ? 'bg-[#272B33] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('signup')}
                  className={`py-2 px-4 rounded-lg font-bold text-xs transition-all ${
                    activeTab === 'signup'
                      ? 'bg-[#272B33] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
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
                      <label className="text-xs font-mono font-medium text-slate-300">
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
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#121419] border border-[#282C36] text-white placeholder-slate-500 text-sm font-sans focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-slate-300">
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#121419] border border-[#282C36] text-white placeholder-slate-500 text-sm font-sans focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-slate-300 flex justify-between">
                    <span>Password *</span>
                    {activeTab === 'signin' && (
                      <span className="text-amber-500 hover:underline cursor-pointer text-[11px]">Forgot?</span>
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#121419] border border-[#282C36] text-white placeholder-slate-500 text-sm font-sans focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>

                {activeTab === 'signup' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-mono font-medium text-slate-300">
                      Institution / University (Optional)
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={org}
                        onChange={(e) => setOrg(e.target.value)}
                        placeholder="e.g. Global Institute of Finance"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#121419] border border-[#282C36] text-white placeholder-slate-500 text-sm font-sans focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-3 py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#121419] font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 focus:outline-none"
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

          <div className="mt-6 pt-5 border-t border-[#282C36]/50 flex items-center justify-center gap-2 text-[11px] font-mono text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>256-Bit SSL Encrypted Institutional Session</span>
          </div>
        </motion.div>
      </div>

      <div className="text-center text-xs font-mono text-slate-500 py-4">
        © {new Date().getFullYear()} FinBench365 CBT Portal. All rights reserved.
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#121419] pt-32 text-center text-slate-400">Loading candidate login...</div>}>
      <LoginContent />
    </Suspense>
  );
}
