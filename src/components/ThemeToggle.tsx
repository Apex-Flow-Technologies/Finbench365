'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

type ThemeOption = 'light' | 'dark' | 'system';

const options: { value: ThemeOption; icon: React.ReactNode; label: string }[] = [
  { value: 'light', icon: <Sun className="w-3.5 h-3.5" />, label: 'Light mode' },
  { value: 'system', icon: <Monitor className="w-3.5 h-3.5" />, label: 'System default' },
  { value: 'dark', icon: <Moon className="w-3.5 h-3.5" />, label: 'Dark mode' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render placeholder with matching size to prevent layout shift
    return <div className="h-8 w-[88px] rounded-lg bg-slate-100 dark:bg-[#1E2028]" />;
  }

  const current = (theme as ThemeOption) ?? 'system';

  return (
    <div
      role="group"
      aria-label="Theme selector"
      className="flex items-center gap-0.5 p-1 rounded-lg bg-slate-100 dark:bg-[#1E2028] border border-slate-200 dark:border-[#282C36]"
    >
      {options.map((opt) => {
        const isActive = current === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            aria-label={opt.label}
            aria-pressed={isActive}
            title={opt.label}
            className={`p-1.5 rounded-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 ${
              isActive
                ? 'bg-white dark:bg-[#272B33] text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-[#475569] dark:text-[#94A3B8] hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}
