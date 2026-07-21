'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { LogOut, BookOpen, Clock, Award, Layers, Sun, Moon, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getUserEntitlements } from '@/lib/firebase/db';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLightMode, setIsLightMode] = useState(false);
  const [entitlements, setEntitlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('dashboard_theme');
    if (savedTheme === 'light') {
      setIsLightMode(true);
    }
  }, []);

  useEffect(() => {
    if (user?.uid) {
      getUserEntitlements(user.uid).then(data => {
        setEntitlements(data);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    }
  }, [user?.uid]);

  const toggleTheme = () => {
    setIsLightMode(!isLightMode);
    localStorage.setItem('dashboard_theme', !isLightMode ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <ProtectedRoute requiredRole="student">
      <div className={`min-h-[calc(100vh)] relative w-full z-10 transition-colors duration-300 ${isLightMode ? 'bg-transparent text-[#181A1F]' : 'bg-[#121419] text-[#FBFBF9]'}`}>
        <div className="pt-28 pb-20 px-6 max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className={`text-3xl font-bold tracking-tight mb-2 ${isLightMode ? 'text-[#181A1F]' : 'text-white'}`}>
              Welcome back, {user?.displayName?.split(' ')[0] || 'Student'}
            </h1>
            <p className={`font-medium ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Continue your preparation for global financial certifications.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-lg border transition-colors ${
                isLightMode 
                  ? 'border-[#E3E3DE] hover:bg-[#F2F2EC] text-slate-600' 
                  : 'border-[#282C36] hover:bg-[#272B33] text-slate-300 hover:text-white'
              }`}
              title="Toggle Theme"
            >
              {isLightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border transition-colors text-sm font-semibold ${
                isLightMode 
                  ? 'border-[#E3E3DE] hover:bg-[#F2F2EC] text-slate-600' 
                  : 'border-[#282C36] hover:bg-[#272B33] text-slate-300 hover:text-white'
              }`}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content Area (2/3 width) */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-xl font-bold mb-4">Your Enrolled Tracks</h2>
              
              {loading ? (
                <div className="py-12 flex justify-center items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : entitlements.length === 0 ? (
                <div className={`rounded-2xl p-12 border text-center transition-colors duration-300 ${isLightMode ? 'bg-white border-[#E3E3DE]' : 'bg-[#181A1F] border-[#282C36]'}`}>
                  <Layers className={`w-12 h-12 mx-auto mb-4 ${isLightMode ? 'text-slate-300' : 'text-slate-600'}`} />
                  <h3 className={`text-lg font-bold mb-2 ${isLightMode ? 'text-[#181A1F]' : 'text-white'}`}>No Active Enrollments</h3>
                  <p className={`text-sm mb-6 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>You haven't enrolled in any tracks yet.</p>
                  <button 
                    onClick={() => router.push('/exams')}
                    className="px-6 py-3 rounded-lg font-bold bg-amber-500 text-[#121419] hover:bg-amber-400 transition-all duration-200 active:scale-95"
                  >
                    Browse Curriculum
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {entitlements.map((entitlement: any) => {
                    const diffDays = Math.ceil((entitlement.expiresAt.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                    const isExpired = diffDays <= 0;
                    const daysTotal = entitlement.durationDays;
                    const daysPassed = daysTotal - (isExpired ? 0 : diffDays);
                    const progressPct = isExpired ? 100 : Math.min(100, Math.max(0, (daysPassed / daysTotal) * 100));

                    return (
                      <div key={entitlement.courseId} className={`rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col ${
                        isLightMode 
                          ? 'bg-white border-[#E3E3DE] hover:shadow-lg' 
                          : 'bg-[#181A1F] border-[#282C36] hover:shadow-xl hover:shadow-black/50 hover:border-slate-700'
                      }`}>
                        {/* Card Header / Banner */}
                        <div className={`h-24 px-6 flex items-end pb-4 ${
                          isLightMode ? 'bg-gradient-to-r from-amber-100 to-orange-100' : 'bg-gradient-to-r from-[#1E2128] to-[#272B33]'
                        }`}>
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center -mb-10 shadow-lg ${
                            isLightMode ? 'bg-white' : 'bg-[#121419]'
                          }`}>
                            <Layers className={`w-6 h-6 ${isLightMode ? 'text-amber-500' : 'text-amber-500'}`} />
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-6 pt-10 flex-1 flex flex-col">
                          <h3 className={`font-bold text-xl mb-1 ${isLightMode ? 'text-[#181A1F]' : 'text-white'}`}>{entitlement.course.title}</h3>
                          <p className={`text-sm mb-6 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {entitlement.course.tier || 'Foundation'} Tier • {entitlement.durationDays} Days Access
                          </p>
                            
                            <div className={`w-full rounded-full h-2 mb-2 ${
                              isLightMode ? 'bg-slate-100' : 'bg-[#121419] border border-[#282C36]'
                            }`}>
                              <div className={`${isExpired ? 'bg-red-500' : 'bg-amber-500'} h-2 rounded-full`} style={{ width: `${progressPct}%` }}></div>
                            </div>
                            <div className={`flex justify-between text-xs font-mono ${isLightMode ? 'text-slate-400' : 'text-slate-400'}`}>
                              <span>{isExpired ? 'Access Expired' : 'Active'}</span>
                              <span className={isExpired ? 'text-red-500' : ''}>
                                {isExpired ? 'Expired' : `Expires in ${diffDays} days`}
                              </span>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-3">
                              {isExpired ? (
                                <button 
                                  onClick={() => router.push(`/pricing?courseId=${entitlement.courseId}&track=${encodeURIComponent(entitlement.course.title)}`)}
                                  className={`px-5 py-2.5 rounded-lg text-sm font-bold shadow-md transition-colors ${
                                    isLightMode 
                                      ? 'bg-[#181A1F] text-white hover:bg-[#272B33]' 
                                      : 'bg-amber-500 text-[#121419] hover:bg-amber-400'
                                  }`}
                                >
                                  Renew Access
                                </button>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => router.push(`/dashboard/courses/${entitlement.courseId}`)}
                                    className={`w-full py-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] ${
                                      isLightMode
                                      ? 'bg-amber-500 text-[#121419] hover:bg-amber-400' 
                                      : 'bg-amber-500 text-[#121419] hover:bg-amber-400'
                                    }`}>
                                    Open Course Hub
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar / Stats Area (1/3 width) */}
          <div className="space-y-6">
            <div className={`rounded-2xl p-6 border transition-colors duration-300 ${
              isLightMode 
                ? 'bg-white border-[#E3E3DE] shadow-sm' 
                : 'bg-[#181A1F] border-[#282C36] shadow-lg shadow-black/40'
            }`}>
              <h3 className={`font-bold mb-4 ${isLightMode ? 'text-[#181A1F]' : 'text-white'}`}>Performance Overview</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isLightMode ? 'bg-emerald-500/10 text-emerald-600' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
                  }`}>
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className={`text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Average Score</div>
                    <div className={`font-bold text-lg ${isLightMode ? 'text-[#181A1F]' : 'text-white'}`}>72%</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isLightMode ? 'bg-blue-500/10 text-blue-600' : 'bg-blue-500/10 border border-blue-500/20 text-blue-500'
                  }`}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className={`text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Time Spent</div>
                    <div className={`font-bold text-lg ${isLightMode ? 'text-[#181A1F]' : 'text-white'}`}>12h 45m</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isLightMode ? 'bg-purple-500/10 text-purple-600' : 'bg-purple-500/10 border border-purple-500/20 text-purple-500'
                  }`}>
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <div className={`text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Mock Tests Completed</div>
                    <div className={`font-bold text-lg ${isLightMode ? 'text-[#181A1F]' : 'text-white'}`}>3 / 10</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
