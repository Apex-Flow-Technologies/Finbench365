import { getApps, initializeApp, cert, getApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let app: App | undefined;

try {
  if (!getApps().length) {
    if (process.env.FIREBASE_PRIVATE_KEY) {
      app = initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      app = initializeApp({ projectId: 'demo-project' });
    }
  } else {
    app = getApp();
  }
} catch (error: any) {
  console.error('Firebase admin initialization error:', error.message);
  if (!getApps().length) {
    app = initializeApp({ projectId: 'demo-project' });
  } else {
    app = getApp();
  }
}

let db: any;
let authService: any;
try {
  if (app) {
    db = getFirestore(app);
    authService = getAuth(app);
  }
} catch (e: any) {
  console.error("Firebase admin service init failed:", e.message);
}

export const adminDb = db as ReturnType<typeof getFirestore>;
export const adminAuth = authService as ReturnType<typeof getAuth>;
