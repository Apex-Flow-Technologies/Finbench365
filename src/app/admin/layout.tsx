'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, PenTool, LogOut, ShieldCheck } from 'lucide-react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const navItems = [
    { name: 'Dashboard Overview', href: '/admin', icon: LayoutDashboard },
    { name: 'User Management', href: '/admin/users', icon: Users },
  ];

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-[#121419] flex">
        {/* Sidebar */}
        <aside className="w-64 bg-[#15171C] border-r border-[#262A34] flex flex-col fixed h-full z-10">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-8">
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
              <span className="font-bold text-lg text-white">Super Admin</span>
            </div>
            
            <nav className="space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link 
                    key={item.name} 
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive 
                        ? 'bg-amber-500/10 text-amber-500 font-semibold' 
                        : 'text-slate-400 hover:text-white hover:bg-[#20232B]'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              <div className="pt-6 mt-6 border-t border-[#262A34]">
                <div className="text-xs font-mono text-slate-500 mb-2 px-4 uppercase">External Tools</div>
                <Link 
                  href="/editor"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-[#20232B] transition-all"
                >
                  <PenTool className="w-5 h-5" />
                  <span>Course Editor</span>
                </Link>
              </div>
            </nav>
          </div>

          <div className="mt-auto p-6 border-t border-[#262A34]">
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 ml-64 p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
