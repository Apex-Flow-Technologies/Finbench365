'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

/**
 * A reusable button that shows an inline spinner during async actions.
 * - Sets aria-busy="true" while loading so screen readers announce the state
 * - Disables the button to prevent double-clicks
 * - Shows a small Loader2 spinner + custom loading text
 */
export function LoadingButton({
  isLoading = false,
  loadingText = 'Loading...',
  children,
  disabled,
  className = '',
  ...props
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={className}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span>{loadingText}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
