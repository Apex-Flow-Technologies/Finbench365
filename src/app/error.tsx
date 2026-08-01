'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#121419] text-[#FBFBF9] px-6">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-3xl border border-[#282C36] bg-[#181A1F]">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-500">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Something went wrong</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            An unexpected error occurred. If you were in the middle of an exam or a payment, nothing has been lost — your progress and any confirmed payment are saved server-side.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => reset()}
            className="flex-1 py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#121419] font-bold text-sm transition-all active:scale-[0.98]"
          >
            Try Again
          </button>
          <button
            onClick={() => { window.location.href = '/dashboard'; }}
            className="flex-1 py-3 px-6 rounded-xl font-semibold text-sm bg-[#272B33] hover:bg-[#343942] text-white transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
