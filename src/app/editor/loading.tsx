import React from 'react';

export default function EditorLoading() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-10 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-10">
        <div className="space-y-3">
          <div className="h-8 w-60 bg-slate-200 dark:bg-[#181A1F] rounded-xl border border-slate-200 dark:border-[#282C36]" />
          <div className="h-4 w-96 bg-slate-100 dark:bg-[#121419] rounded" />
        </div>
        <div className="h-12 w-44 bg-slate-200 dark:bg-[#181A1F] rounded-xl border border-slate-200 dark:border-[#282C36]" />
      </div>

      {/* Exam Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#181A1F] border border-slate-200 dark:border-[#282C36] rounded-2xl p-6 space-y-4"
          >
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-[#272B33]" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-[#272B33] rounded-full" />
            </div>
            <div className="h-6 w-3/4 bg-slate-200 dark:bg-[#272B33] rounded-lg" />
            <div className="h-4 w-full bg-slate-100 dark:bg-[#222629] rounded" />
            <div className="h-4 w-2/3 bg-slate-100 dark:bg-[#222629] rounded" />
            <div className="flex gap-2 pt-2">
              <div className="h-9 flex-1 bg-slate-100 dark:bg-[#222629] rounded-lg" />
              <div className="h-9 flex-1 bg-slate-200 dark:bg-[#272B33] rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
