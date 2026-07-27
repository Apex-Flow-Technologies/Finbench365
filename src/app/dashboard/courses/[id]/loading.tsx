import React from 'react';

export default function CourseHubLoading() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0B0C10] pt-28 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-pulse">
        {/* Back breadcrumb skeleton */}
        <div className="h-4 w-36 bg-slate-200 dark:bg-[#181A1F] rounded-lg border border-slate-200 dark:border-[#282C36]" />

        {/* Header Card Skeleton */}
        <div className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-3 flex-1">
              <div className="h-8 w-2/3 bg-slate-200 dark:bg-[#272B33] rounded-xl" />
              <div className="h-4 w-5/6 bg-slate-100 dark:bg-[#222629] rounded" />
            </div>
            <div className="h-7 w-28 bg-slate-200 dark:bg-[#272B33] rounded-full" />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-[#282C36]">
            <div className="h-8 w-32 bg-slate-100 dark:bg-[#181A1F] rounded-xl" />
            <div className="h-8 w-32 bg-slate-100 dark:bg-[#181A1F] rounded-xl" />
          </div>
        </div>

        {/* Tabs Skeleton */}
        <div className="flex gap-2">
          <div className="h-10 w-32 bg-slate-200 dark:bg-[#181A1F] rounded-xl border border-slate-200 dark:border-[#282C36]" />
          <div className="h-10 w-32 bg-slate-200 dark:bg-[#181A1F] rounded-xl border border-slate-200 dark:border-[#282C36]" />
        </div>

        {/* Content Rows Skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-xl p-5 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-[#272B33] shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-48 bg-slate-200 dark:bg-[#272B33] rounded" />
                  <div className="h-3 w-32 bg-slate-100 dark:bg-[#222629] rounded" />
                </div>
              </div>
              <div className="h-9 w-28 bg-slate-200 dark:bg-[#272B33] rounded-xl shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
