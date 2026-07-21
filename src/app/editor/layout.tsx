'use client';

import React, { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, BookOpen, Users, Settings, LogOut, ChevronLeft, Menu } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/editor' },
    { label: 'Users', icon: Users, href: '/editor/users' },
    { label: 'Settings', icon: Settings, href: '/editor/settings' },
  ];

  return (
    <ProtectedRoute requiredRole="editor">
      <div className="min-h-screen bg-[#0B0C10] flex flex-col md:flex-row font-sans text-[#FBFBF9]">
        
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-[#121419] border-b border-[#282C36] shrink-0">
          <div className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center text-[#121419] font-black text-sm">
              FB
            </div>
            Editor Panel
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-300">
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Sidebar */}
        <aside className={`w-64 bg-[#121419] border-r border-[#282C36] flex-col transition-all duration-300 shrink-0 ${isMobileMenuOpen ? 'flex absolute inset-y-0 left-0 z-50 shadow-2xl' : 'hidden md:flex'}`}>
          <div className="p-6 hidden md:flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center text-[#121419] font-black text-sm shrink-0">
              FB
            </div>
            <span className="font-bold text-lg text-white tracking-tight leading-tight">
              FinBench365<br/><span className="text-xs text-amber-500 font-mono">EDITOR PANEL</span>
            </span>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    router.push(item.href);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive 
                      ? 'bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 shadow-sm' 
                      : 'text-slate-400 hover:text-white hover:bg-[#181A1F]'
                  }`}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="text-sm">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-[#282C36]">
            <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-xl bg-[#181A1F] border border-[#282C36]">
              <div className="w-8 h-8 rounded-full bg-[#272B33] flex items-center justify-center text-xs font-bold text-white shrink-0">
                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'E'}
              </div>
              <div className="truncate">
                <div className="text-sm font-bold text-white truncate">{user?.displayName || 'Editor'}</div>
                <div className="text-xs text-slate-500 truncate">{user?.email}</div>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#181A1F] transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
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
