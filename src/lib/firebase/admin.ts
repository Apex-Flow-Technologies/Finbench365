import { getApps, initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let app;

if (!getApps().length) {
  try {
    app = initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'dummy-project-id',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'dummy@dummy.com',
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '-----BEGIN PRIVATE KEY-----\ndummy\n-----END PRIVATE KEY-----\n').replace(/\\n/g, '\n'),
      }),
    });
  } catch (error: any) {
    console.error('Firebase admin initialization error', error.stack);
  }
} else {
  app = getApp();
}

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
