'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export function useThemeMode() {
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('myexams_theme') as 'dark' | 'light';
    if (saved === 'light' || saved === 'dark') {
      setThemeState(saved);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('myexams_theme', next);
    }
  };

  return { theme, toggleTheme, mounted };
}

export function ThemeToggle({ theme, toggleTheme }: { theme: 'dark' | 'light'; toggleTheme: () => void }) {
  return (
    <button
      onClick={toggleTheme}
      className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-amber-500 outline-none ${
        theme === 'dark'
          ? 'bg-[#181A1F] border-[#282C36] text-amber-400 hover:border-amber-500/50'
          : 'bg-white border-slate-300 text-[#111B35] hover:border-slate-500 shadow-sm'
      }`}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-4 h-4 text-amber-400" />
          <span className="text-xs tabular-nums font-semibold text-[#E2E8F0] hidden sm:inline">Light Mode</span>
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-[#111B35]" />
          <span className="text-xs tabular-nums font-semibold text-[#111B35] hidden sm:inline">Dark Mode</span>
        </>
      )}
    </button>
  );
}
