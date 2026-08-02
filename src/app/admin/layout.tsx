'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, PenTool, LogOut, ShieldCheck, Home, CreditCard, Ticket } from 'lucide-react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next-nprogress-bar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { motion } from 'framer-motion';
import { PageTransition } from '@/components/ui/PageTransition';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    localStorage.removeItem('myexams_session_id');
    await signOut(auth);
    router.push('/login');
  };

  // One flat list. The exam editor used to live in its own shell filed under
  // "External Tools"; it is admin work, so it is now just the Content section.
  const navItems = [
    { name: 'Overview', href: '/admin', icon: LayoutDashboard },
    { name: 'Students', href: '/admin/students', icon: Users },
    { name: 'Orders', href: '/admin/orders', icon: CreditCard },
    { name: 'Coupons', href: '/admin/coupons', icon: Ticket },
    { name: 'Content', href: '/admin/content', icon: PenTool },
  ];

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] flex transition-colors duration-300">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-[#121419] border-r border-slate-200 dark:border-white/10 flex flex-col fixed h-full z-10 shadow-sm dark:shadow-none transition-colors duration-300">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-8">
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
              <span className="font-bold text-lg text-slate-900 dark:text-white">Super Admin</span>
            </div>
            
            <nav className="space-y-2">
              {navItems.map((item) => {
                // Nested routes (e.g. a course editor) should keep their
                // section highlighted, not just the exact index page.
                const isActive = item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link 
                    key={item.name} 
                    href={item.href}
                    className={`relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
                      isActive 
                        ? 'text-amber-600 dark:text-amber-500 font-semibold' 
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="adminSidebarActiveIndicator"
                        className="absolute inset-0 bg-amber-50 dark:bg-amber-500/10 rounded-xl"
                        initial={false}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <item.icon className="w-5 h-5 relative z-10" />
                    <span className="relative z-10">{item.name}</span>
                  </Link>
                );
              })}

              {/* Not part of the admin nav — this is a way out of it, into the
                  product as a student sees it. */}
              <div className="pt-6 mt-6 border-t border-slate-200 dark:border-white/10">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 transition-all"
                >
                  <Home className="w-5 h-5" />
                  <span>Preview student portal</span>
                </Link>
              </div>
            </nav>
          </div>

          <div className="mt-auto p-6 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-red-500/10 rounded-xl transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
            <ThemeToggle />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 ml-64 p-8">
          <div className="max-w-6xl mx-auto">
            <PageTransition key={pathname}>
              {children}
            </PageTransition>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
