/**
 * ==============================================================================
 * FinBench365 — Cloud-Native Firebase Configuration Module (Sprint 1)
 * ==============================================================================
 * Centralized, type-safe environment variable accessor and validator for both
 * Firebase Client SDK (`NEXT_PUBLIC_*`) and Firebase Admin SDK (`FIREBASE_ADMIN_*`).
 *
 * Guaranteed no hardcoded secrets inside application logic or UI components.
 */

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * Validates and retrieves the Firebase Client SDK configuration object.
 * Safe for execution in both SSR (Node.js) and Browser client contexts.
 */
export function getFirebaseClientConfig(): FirebaseClientConfig {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '';
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '';
  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined;

  // In production builds, log a warning if crucial keys are uninitialized
  if (!apiKey || !projectId || !appId) {
    if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
      console.warn(
        '[FinBench365 Firebase Foundation] Warning: Missing one or more NEXT_PUBLIC_FIREBASE environment variables. Check your .env.local or Vercel project configuration.'
      );
    }
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId,
  };
}

/**
 * Validates and retrieves the Firebase Admin SDK configuration object.
 * Strictly intended for server-side environments (API Routes, Server Actions, Middleware).
 */
export function getFirebaseAdminConfig(): FirebaseAdminConfig | null {
  // Ensure this function is never called or leaked into browser bundles
  if (typeof window !== 'undefined') {
    console.error('[FinBench365 Security Error] getFirebaseAdminConfig() must never be invoked on the client side.');
    return null;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '';
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';

  // Handle newline escaping for private keys stored in .env.local or Vercel environment variables
  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  // If private key or client email is missing, return null gracefully instead of crashing SSR build workers
  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}
