'use client';

/**
 * ==============================================================================
 * FinBench365 — Authentication Hook Module (Sprint 2)
 * ==============================================================================
 * React hook exposing current candidate authentication state, role, session loading
 * status, and institutional service actions (`login`, `register`, `logout`).
 */

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import type { AuthContextState } from '../types/auth';

/**
 * Consumes the global institutional AuthContext.
 * Must be executed within component trees wrapped by `<AuthProvider>`.
 */
export function useAuth(): AuthContextState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('[FinBench365 Auth Hook] useAuth() must be invoked inside an <AuthProvider> component hierarchy.');
  }
  return context;
}
