import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="min-h-[calc(100vh)] relative w-full z-10 pt-28 pb-20 px-6 max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 animate-pulse">
        <div className="space-y-3">
          <div className="h-8 w-64 bg-slate-200 dark:bg-[#181A1F] rounded-xl border border-slate-100 dark:border-[#282C36]" />
          <div className="h-4 w-96 bg-slate-100 dark:bg-[#121419] rounded-lg" />
        </div>
        <div className="h-10 w-28 bg-slate-200 dark:bg-[#181A1F] rounded-xl border border-slate-100 dark:border-[#282C36]" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main 2/3 Content Cards */}
        <div className="lg:col-span-2 space-y-6">
          <div className="h-6 w-48 bg-slate-200 dark:bg-[#181A1F] rounded-lg animate-pulse mb-6" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 dark:border-[#282C36] bg-white dark:bg-[#181A1F] overflow-hidden p-6 space-y-4 animate-pulse"
              >
                <div className="h-20 w-full bg-slate-100 dark:bg-[#121419] rounded-xl" />
                <div className="h-6 w-3/4 bg-slate-200 dark:bg-[#272B33] rounded-lg" />
                <div className="h-4 w-1/2 bg-slate-100 dark:bg-[#222629] rounded" />
                <div className="h-2 w-full bg-slate-100 dark:bg-[#222629] rounded-full" />
                <div className="h-11 w-full bg-slate-200 dark:bg-[#272B33] rounded-xl" />
              </div>
            ))}
          </div>
        </div>

        {/* 1/3 Sidebar Skeleton */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-[#282C36] bg-white dark:bg-[#181A1F] p-6 space-y-5 animate-pulse">
            <div className="h-5 w-40 bg-slate-200 dark:bg-[#272B33] rounded" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#121419]" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-20 bg-slate-100 dark:bg-[#222629] rounded" />
                    <div className="h-5 w-16 bg-slate-200 dark:bg-[#272B33] rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
