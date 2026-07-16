'use client';

/**
 * ==============================================================================
 * FinBench365 — Global Authentication Context & Provider (Sprint 2)
 * ==============================================================================
 * Central React Context managing real-time Firebase Auth session state, roles,
 * and subscription metadata across the institutional portal.
 *
 * Replaces legacy localStorage-based auth persistence completely.
 */

import React, { createContext, useEffect, useState, useMemo, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase/client';
import { authService } from '../services/auth.service';
import type { AuthContextState, UserAuthProfile, Role, SubscriptionStatus } from '../types/auth';

const AuthContext = createContext<AuthContextState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserAuthProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize persistence & listen to Auth state changes
  useEffect(() => {
    let isMounted = true;

    // Ensure session persistence is set to browser local storage
    authService.ensurePersistence().catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (currentFbUser) => {
      if (!isMounted) return;

      setFirebaseUser(currentFbUser);

      if (currentFbUser) {
        // Synchronize Edge Middleware session cookie
        document.cookie = 'finbench_auth=true; path=/; max-age=2592000; SameSite=Lax';

        // Map raw Firebase user to institutional profile
        // Note: In Sprint 3 (Firestore Foundation), this will automatically hydrate
        // role, activeTrackIds, and subscriptionStatus directly from `/users/{uid}`.
        const mappedProfile = authService.mapToProfile(currentFbUser);
        setUser(mappedProfile);
      } else {
        document.cookie = 'finbench_auth=; path=/; max-age=0; SameSite=Lax';
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<UserAuthProfile> => {
    setLoading(true);
    try {
      const profile = await authService.loginCandidate(email, password);
      setUser(profile);
      setFirebaseUser(authService.getCurrentUser());
      return profile;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string): Promise<UserAuthProfile> => {
    setLoading(true);
    try {
      const profile = await authService.registerCandidate(name, email, password);
      setUser(profile);
      setFirebaseUser(authService.getCurrentUser());
      return profile;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await authService.logoutCandidate();
      setUser(null);
      setFirebaseUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<void> => {
    await authService.sendPasswordReset(email);
  }, []);

  const resendVerification = useCallback(async (): Promise<void> => {
    await authService.resendEmailVerification(firebaseUser);
  }, [firebaseUser]);

  const role: Role = useMemo(() => user?.role || 'STUDENT', [user]);
  const authenticated: boolean = useMemo(() => !!user && !!firebaseUser, [user, firebaseUser]);
  const activeTrackIds: string[] = useMemo(() => user?.activeTrackIds || [], [user]);
  const subscriptionStatus: SubscriptionStatus = useMemo(() => user?.subscriptionStatus || 'NONE', [user]);

  const value = useMemo<AuthContextState>(
    () => ({
      user,
      firebaseUser,
      role,
      loading,
      authenticated,
      activeTrackIds,
      subscriptionStatus,
      login,
      register,
      logout,
      resetPassword,
      resendVerification,
    }),
    [
      user,
      firebaseUser,
      role,
      loading,
      authenticated,
      activeTrackIds,
      subscriptionStatus,
      login,
      register,
      logout,
      resetPassword,
      resendVerification,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
