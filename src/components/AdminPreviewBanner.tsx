'use client';

import React from 'react';
import { useRouter } from 'next-nprogress-bar';
import { useAuth } from '@/context/AuthContext';
import { Eye } from 'lucide-react';

export function AdminPreviewBanner() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="w-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border-b border-amber-500/20 px-4 py-1.5 text-xs font-semibold flex items-center justify-between relative z-50">
      <div className="max-w-[1240px] mx-auto w-full flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold truncate">
          <Eye className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="truncate">
            Admin Preview Mode: You have full access to view and test all student content.
          </span>
        </div>

        <button
          onClick={() => router.push('/admin')}
          className="bg-amber-500 text-black px-2.5 py-0.5 rounded text-xs font-medium hover:bg-amber-400 transition shrink-0 ml-3 shadow-sm"
        >
          Return to Admin →
        </button>
      </div>
    </div>
  );
}
