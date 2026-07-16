/**
 * ==============================================================================
 * FinBench365 — Firebase Client SDK Foundation Module (Sprint 1)
 * ==============================================================================
 * Singleton initialization and export of Firebase Client SDK instances:
 * - Firebase App
 * - Firebase Authentication (`auth`)
 * - Cloud Firestore (`firestore`)
 * - Cloud Storage (`storage`)
 * - Firebase Analytics (`analytics`)
 * - Firebase App Check (`appCheck`)
 *
 * Designed specifically for Next.js 15 App Router (SSR-safe, prevents duplicate app initialization).
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import { getFirebaseClientConfig } from './config';

const config = getFirebaseClientConfig();

// Initialize or retrieve existing Firebase App instance (SSR/HMR safe)
const app: FirebaseApp = getApps().length === 0 ? initializeApp(config) : getApp();

// Initialize primary client services
const auth: Auth = getAuth(app);
const firestore: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

let analyticsInstance: Analytics | null = null;
let appCheckInstance: AppCheck | null = null;

/**
 * Safely initializes or retrieves Firebase Analytics if running in a supported browser environment.
 * Prevents SSR evaluation errors during Next.js static page generation (`next build`).
 */
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window !== 'undefined' && analyticsInstance === null) {
    try {
      const supported = await isSupported();
      if (supported && config.measurementId) {
        analyticsInstance = getAnalytics(app);
      }
    } catch (error) {
      console.warn('[FinBench365 Firebase Foundation] Analytics initialization skipped:', error);
    }
  }
  return analyticsInstance;
}

/**
 * Safely initializes Firebase App Check for enterprise bot & replay attack protection.
 * Requires `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` to be configured.
 */
export function initAppCheck(): AppCheck | null {
  if (typeof window !== 'undefined' && appCheckInstance === null) {
    const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;
    if (siteKey) {
      try {
        // Automatically enable App Check debug token in non-production local development
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }

        appCheckInstance = initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(siteKey),
          isTokenAutoRefreshEnabled: true,
        });
      } catch (error) {
        console.warn('[FinBench365 Firebase Foundation] App Check initialization skipped:', error);
      }
    }
  }
  return appCheckInstance;
}

export { app, auth, firestore, storage };
