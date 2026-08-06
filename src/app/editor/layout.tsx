'use client';

import React, { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { motion } from 'framer-motion';
import { LayoutDashboard, LogOut, Menu, Home, ExternalLink, ShieldCheck } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    localStorage.removeItem('myexams_session_id');
    await signOut(auth);
    router.push('/login');
  };

  const isEditorPath = pathname.startsWith('/editor');

  // /editor/settings used to sit here. It was a third copy of the user
  // directory, alongside a wall of feature-flag, pricing and "security engine"
  // controls that were local React state and persisted nowhere — toggling one
  // did nothing while looking as though it had — plus an audit log of invented
  // events. User management now lives only at /admin/users.
  const navItems = [
    { label: 'Content', icon: LayoutDashboard, href: '/editor' },
    { label: 'Admin Panel', icon: ShieldCheck, href: '/admin' },
  ];

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] flex flex-col md:flex-row font-sans text-slate-900 dark:text-[#FBFBF9] transition-colors duration-300">
        
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-[#121419] border-b border-slate-200 dark:border-[#282C36] shrink-0 transition-colors">
          <div className="font-bold text-lg tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center text-[#121419] font-black text-sm">
              FB
            </div>
            Exam Editor
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-500 dark:text-slate-300">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <aside className={`w-64 bg-white dark:bg-[#121419] border-r border-slate-200 dark:border-[#282C36] flex-col justify-between pb-6 transition-all duration-300 shrink-0 ${isMobileMenuOpen ? 'flex absolute inset-y-0 left-0 z-50 shadow-2xl' : 'hidden md:flex'}`}>
          <div className="p-6 hidden md:flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center text-slate-900 font-black text-sm shrink-0">
              FB
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight leading-tight">
              MyExams365<br/><span className="text-xs text-amber-500 font-mono">EXAM EDITOR</span>
            </span>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/editor' && pathname.startsWith(item.href + '/'));
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    router.push(item.href);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
                    isActive 
                      ? 'text-amber-600 dark:text-amber-500 font-bold' 
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#181A1F]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="editorSidebarActiveIndicator"
                      className="absolute inset-0 bg-amber-50 dark:bg-amber-500/10 rounded-xl"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon className="w-5 h-5 shrink-0 relative z-10" />
                  <span className="text-sm relative z-10">{item.label}</span>
                </button>
              );
            })}

            
            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-white/10">
              <button
                onClick={() => {
                  router.push('/dashboard');
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#181A1F]"
              >
                <div className="flex items-center gap-3">
                  <Home className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">Preview Student Portal</span>
                </div>
                <ExternalLink className="w-4 h-4 shrink-0 opacity-70" />
              </button>
            </div>
          </nav>

          <div className="p-4 border-t border-slate-200 dark:border-[#282C36]">
            <div className="flex justify-between items-center px-4 py-3 mb-4 rounded-xl bg-slate-50 dark:bg-[#181A1F] border border-slate-200 dark:border-[#282C36]">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#272B33] flex items-center justify-center text-xs font-bold text-slate-600 dark:text-white shrink-0">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'E'}
                </div>
                <div className="truncate">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.displayName || 'Editor'}</div>
                  <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center gap-4">
              <button
                onClick={handleLogout}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-[#181A1F] transition-colors text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
              <div className="hidden md:block shrink-0">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Overlay for mobile sidebar */}
          {isMobileMenuOpen && (
            <div className="absolute inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
          )}
          
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>

      </div>
    </ProtectedRoute>
  );
}
