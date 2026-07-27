import { getApps, initializeApp, cert, getApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let app: App;

if (!getApps().length) {
  try {
      if (process.env.FIREBASE_PRIVATE_KEY) {
        app = initializeApp({
          credential: cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
      } else {
        // Initialize an empty app for Vercel build step to prevent crashes
        app = initializeApp({ projectId: 'demo-project' });
      }
  } catch (error: any) {
    console.error('Firebase admin initialization error', error.stack);
    app = getApps()[0] || initializeApp({ projectId: 'demo-project' });
  }
} else {
  app = getApp();
}

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
