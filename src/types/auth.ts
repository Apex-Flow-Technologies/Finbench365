/**
 * ==============================================================================
 * FinBench365 — Authentication & Session Type Definitions (Sprint 2)
 * ==============================================================================
 * Strictly typed interfaces for Firebase Authentication session state, user roles,
 * subscription validity, and global AuthContext contract.
 */

import type { User as FirebaseUser } from 'firebase/auth';

export type Role = 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN';

export type SubscriptionStatus = 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'NONE';

export interface UserAuthProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  activeTrackIds: string[];
  subscriptionStatus: SubscriptionStatus;
  emailVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthContextState {
  user: UserAuthProfile | null;
  firebaseUser: FirebaseUser | null;
  role: Role;
  loading: boolean;
  authenticated: boolean;
  activeTrackIds: string[];
  subscriptionStatus: SubscriptionStatus;
  login: (email: string, password: string) => Promise<UserAuthProfile>;
  register: (name: string, email: string, password: string) => Promise<UserAuthProfile>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
}
