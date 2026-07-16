/**
 * ==============================================================================
 * FinBench365 — Authentication Service Module (Sprint 2)
 * ==============================================================================
 * Production-ready wrapper around Firebase Authentication (`firebase/auth`).
 * Encapsulates registration, login, logout, password reset, and session persistence.
 *
 * Ensures clean architecture: UI Components -> useAuth Hook -> AuthService -> Firebase SDK.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  type User as FirebaseUser,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '../lib/firebase/client';
import type { UserAuthProfile } from '../types/auth';

class AuthService {
  /**
   * Enforces browser local persistence so candidates remain logged in across tabs and refreshes.
   */
  public async ensurePersistence(): Promise<void> {
    if (typeof window !== 'undefined') {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (error) {
        console.warn('[AuthService] Persistence configuration failed:', error);
      }
    }
  }

  /**
   * Maps a raw FirebaseUser into our standard UserAuthProfile contract.
   */
  public mapToProfile(fbUser: FirebaseUser): UserAuthProfile {
    return {
      uid: fbUser.uid,
      email: fbUser.email || '',
      displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Candidate',
      photoURL: fbUser.photoURL || undefined,
      role: 'STUDENT',
      status: 'ACTIVE',
      activeTrackIds: [],
      subscriptionStatus: 'NONE',
      emailVerified: fbUser.emailVerified,
      createdAt: fbUser.metadata.creationTime,
      updatedAt: fbUser.metadata.lastSignInTime,
    };
  }

  /**
   * Registers a new institutional candidate with Email and Password.
   */
  public async registerCandidate(name: string, email: string, password: string): Promise<UserAuthProfile> {
    await this.ensurePersistence();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = userCredential.user;

      // Update Firebase Auth display name immediately
      await updateProfile(fbUser, {
        displayName: name.trim() || email.split('@')[0],
      });

      // Dispatch verification email non-blockingly
      try {
        await sendEmailVerification(fbUser);
      } catch (verifyError) {
        console.warn('[AuthService] Email verification dispatch failed:', verifyError);
      }

      // Refresh token profile
      return this.mapToProfile({
        ...fbUser,
        displayName: name.trim() || email.split('@')[0],
      } as FirebaseUser);
    } catch (error) {
      throw new Error(this.mapFirebaseAuthError(error));
    }
  }

  /**
   * Authenticates an existing candidate using Email and Password.
   */
  public async loginCandidate(email: string, password: string): Promise<UserAuthProfile> {
    await this.ensurePersistence();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return this.mapToProfile(userCredential.user);
    } catch (error) {
      throw new Error(this.mapFirebaseAuthError(error));
    }
  }

  /**
   * Terminates the current candidate authentication session across the browser.
   */
  public async logoutCandidate(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      throw new Error(this.mapFirebaseAuthError(error));
    }
  }

  /**
   * Dispatches a password reset email to the candidate's registered institutional address.
   */
  public async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw new Error(this.mapFirebaseAuthError(error));
    }
  }

  /**
   * Resends the institutional email verification link to the currently signed-in user.
   */
  public async resendEmailVerification(targetUser?: FirebaseUser | null): Promise<void> {
    const fbUser = targetUser || auth.currentUser;
    if (!fbUser) {
      throw new Error('No active authentication session found. Please sign in to verify your email.');
    }
    try {
      await sendEmailVerification(fbUser);
    } catch (error) {
      throw new Error(this.mapFirebaseAuthError(error));
    }
  }

  /**
   * Returns the currently active raw Firebase user directly from the SDK instance.
   */
  public getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  /**
   * Transforms technical or cryptographic Firebase error codes into professional institutional messages.
   */
  public mapFirebaseAuthError(error: unknown): string {
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          return 'Invalid institutional email or password provided. Please verify your credentials.';
        case 'auth/email-already-in-use':
          return 'An institutional account is already registered with this email address. Try signing in.';
        case 'auth/weak-password':
          return 'Password must be at least 6 characters long and contain strong institutional complexity.';
        case 'auth/invalid-email':
          return 'The email address format provided is invalid.';
        case 'auth/too-many-requests':
          return 'Too many unsuccessful authentication attempts. Your access is temporarily restricted. Please try again later or reset your password.';
        case 'auth/network-request-failed':
          return 'Network error encountered. Please check your internet connection and try again.';
        case 'auth/operation-not-allowed':
          return 'Email and password authentication is not currently enabled for this portal.';
        default:
          return `Authentication failed: ${error.message}`;
      }
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unexpected institutional authentication error occurred. Please try again.';
  }
}

export const authService = new AuthService();
