import React from 'react';

export default function AdminLoading() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-pulse">
      {/* Title */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-slate-200 dark:bg-[#181A1F] rounded-xl border border-slate-200 dark:border-[#282C36]" />
        <div className="h-4 w-96 bg-slate-100 dark:bg-[#121419] rounded" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#181A1F] border border-slate-200 dark:border-[#282C36] rounded-2xl p-6 space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-slate-100 dark:bg-[#222629] rounded" />
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-[#272B33]" />
            </div>
            <div className="h-8 w-20 bg-slate-200 dark:bg-[#272B33] rounded-lg" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="bg-white dark:bg-[#181A1F] border border-slate-200 dark:border-[#282C36] rounded-2xl p-6 space-y-4">
        <div className="h-6 w-48 bg-slate-200 dark:bg-[#272B33] rounded" />
        <div className="space-y-3 pt-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-[#282C36] last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-[#272B33]" />
                <div className="space-y-1.5">
                  <div className="h-4 w-36 bg-slate-200 dark:bg-[#272B33] rounded" />
                  <div className="h-3 w-48 bg-slate-100 dark:bg-[#222629] rounded" />
                </div>
              </div>
              <div className="h-7 w-20 bg-slate-200 dark:bg-[#272B33] rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
