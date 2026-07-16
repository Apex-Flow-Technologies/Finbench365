/**
 * ==============================================================================
 * FinBench365 — Firebase Admin SDK Foundation Module (Sprint 1)
 * ==============================================================================
 * Server-side singleton initialization of Firebase Admin SDK (`firebase-admin`).
 * Used strictly in:
 * - Next.js API Routes (`/api/...`)
 * - Next.js Server Actions
 * - Token verification & role RBAC checks
 *
 * GUARANTEED NEVER TO BE EXECUTED ON OR BUNDLED FOR THE CLIENT SIDE.
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';
import { getFirebaseAdminConfig } from './config';

/**
 * Initializes or returns the existing Firebase Admin SDK instance.
 * Gracefully handles missing credentials during local development / static SSR builds.
 */
export function getFirebaseAdminApp(): App | null {
  if (typeof window !== 'undefined') {
    throw new Error(
      '[FinBench365 Security Violation] Firebase Admin SDK cannot and must never be imported on the client side.'
    );
  }

  // If already initialized, return the default app instance
  const apps = getApps();
  if (apps.length > 0 && apps[0]) {
    return apps[0];
  }

  const config = getFirebaseAdminConfig();

  // If service account variables are present, initialize with exact cert credentials
  if (config) {
    try {
      return initializeApp({
        credential: cert({
          projectId: config.projectId,
          clientEmail: config.clientEmail,
          privateKey: config.privateKey,
        }),
        storageBucket: `${config.projectId}.appspot.com`,
      });
    } catch (error) {
      console.error('[FinBench365 Firebase Admin Foundation] Failed to initialize Admin SDK with cert:', error);
      return null;
    }
  }

  // Fallback: Check if FIREBASE_SERVICE_ACCOUNT_KEY JSON string is provided directly
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      const parsedAccount = JSON.parse(serviceAccountJson);
      return initializeApp({
        credential: cert(parsedAccount),
        storageBucket: `${parsedAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`,
      });
    } catch (error) {
      console.error('[FinBench365 Firebase Admin Foundation] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
      return null;
    }
  }

  // If no credentials found during build phase, return null without crashing static build
  return null;
}

/**
 * Returns the Firebase Admin Auth instance for server-side token & session verification.
 */
export function getAdminAuth(): Auth | null {
  const adminApp = getFirebaseAdminApp();
  return adminApp ? getAuth(adminApp) : null;
}

/**
 * Returns the Firebase Admin Firestore instance for privileged database mutations & queries.
 */
export function getAdminFirestore(): Firestore | null {
  const adminApp = getFirebaseAdminApp();
  return adminApp ? getFirestore(adminApp) : null;
}

/**
 * Returns the Firebase Admin Storage instance for privileged bucket operations.
 */
export function getAdminStorage(): Storage | null {
  const adminApp = getFirebaseAdminApp();
  return adminApp ? getStorage(adminApp) : null;
}
