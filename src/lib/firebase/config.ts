import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

/**
 * Fail with the actual problem rather than Firebase's `auth/invalid-api-key`.
 *
 * When these are missing, getAuth() throws that opaque code from inside a
 * bundled chunk during SSR, which takes down every page with a 500 and points
 * at a line of library code. It reads like a broken build; it is almost always
 * an absent .env.local, or a variable that was never added to the deployment.
 *
 * The check is deliberately fatal. Letting the app boot with no auth would mean
 * login silently failing and every entitlement check erroring at some later,
 * more confusing point — in production that is worse than not starting.
 */
// Checked against `firebaseConfig`, NOT by indexing process.env with a variable.
//
// Next replaces `process.env.NEXT_PUBLIC_FOO` in the browser bundle only when
// the property is written out literally — it is a build-time string
// substitution, not a runtime lookup. A computed `process.env[key]` cannot be
// substituted, so in the browser it reads an essentially empty object and every
// variable looks missing, however well configured the app is. The fields above
// use literal accesses and are therefore correctly inlined.
const missing = Object.entries({
  NEXT_PUBLIC_FIREBASE_API_KEY: firebaseConfig.apiKey,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  NEXT_PUBLIC_FIREBASE_APP_ID: firebaseConfig.appId,
})
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  throw new Error(
    `Firebase is not configured — missing ${missing.join(', ')}.\n\n` +
    `Copy .env.example to .env.local and fill in the values from the Firebase console\n` +
    `(Project settings → General → Your apps → SDK setup and configuration).\n` +
    `If this project is already deployed, "vercel env pull .env.local" fetches them.\n\n` +
    `Note that NEXT_PUBLIC_* variables are read at build time, so restart the dev\n` +
    `server after editing .env.local.`,
  );
}

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Use persistent local cache in browser, standard getFirestore on server
export const db = typeof window !== 'undefined'
  ? initializeFirestore(app, { localCache: persistentLocalCache() })
  : getFirestore(app);

export const storage = getStorage(app);
export default app;
