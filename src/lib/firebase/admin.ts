import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Firebase Admin, initialised once per process.
 *
 * When credentials are missing this module used to export `{}` for both
 * services. Every call site then failed with
 * `TypeError: adminDb.collection is not a function` and returned a generic 500 —
 * including every payment route — so a credential misconfiguration was
 * indistinguishable from a random outage. The stub below still lets the module
 * be imported and evaluated (Next collects page data at build time without
 * secrets, which is why a hard throw at import is not an option), but the moment
 * anything actually tries to use it, it says exactly what is wrong.
 */

export class FirebaseAdminNotConfiguredError extends Error {
  constructor(accessed: string) {
    super(
      `Firebase Admin is not configured, so ${accessed} is unavailable. ` +
      'Set NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY ' +
      'in the environment. FIREBASE_PRIVATE_KEY must keep its \\n escapes intact.',
    );
    this.name = 'FirebaseAdminNotConfiguredError';
  }
}

function unavailable(service: 'adminDb' | 'adminAuth'): any {
  return new Proxy({}, {
    get(_target, prop) {
      // Symbols and these two keys are probed by the runtime and by any
      // accidental `await` on the object. Throwing on them would turn a clear
      // error into an inscrutable one at an unrelated place, so they answer
      // honestly that there is nothing here.
      if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON' || prop === 'constructor') {
        return undefined;
      }
      throw new FirebaseAdminNotConfiguredError(`${service}.${String(prop)}`);
    },
  });
}

let initError: unknown = null;

if (!getApps().length) {
  const rawKey = process.env.FIREBASE_PRIVATE_KEY ?? '';
  // Strip surrounding quotes Vercel sometimes stores literally, then convert \n → real newlines
  const privateKey = rawKey
    .replace(/^["']/, '')
    .replace(/["']$/, '')
    .replace(/\\n/g, '\n');

  try {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.replace(/^["']|["']$/g, ''),
        privateKey,
      }),
    });
  } catch (err) {
    initError = err;
  }
}

let db: any;
let auth: any;
let ready = false;

try {
  if (initError) throw initError;
  db = getFirestore();
  auth = getAuth();
  ready = true;
} catch (err) {
  // Expected during a build with no secrets present; a genuine problem at
  // runtime. Either way the stub carries the explanation to the call site.
  console.warn(
    '[firebase-admin] Not initialised — server-side Firebase calls will throw ' +
    'FirebaseAdminNotConfiguredError. This is expected during a build without secrets.',
    err instanceof Error ? err.message : err,
  );
  db = unavailable('adminDb');
  auth = unavailable('adminAuth');
}

/**
 * True when Admin SDK calls will actually work. Track it as a plain flag —
 * inspecting `adminDb` to find out would trip the Proxy above and throw the very
 * error a caller is trying to avoid.
 */
export const isFirebaseAdminReady = ready;

export const adminDb = db;
export const adminAuth = auth;
