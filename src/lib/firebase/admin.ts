import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
      if (process.env.FIREBASE_PRIVATE_KEY) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
      } else {
        admin.initializeApp({ projectId: 'demo-project' });
      }
  } catch (error: any) {
    console.error('Firebase admin initialization error', error.stack);
    if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-project' });
  }
}

let db: any;
let authService: any;
try {
  db = admin.firestore();
  authService = admin.auth();
} catch (e) {
  console.error("Firebase admin service init failed", e);
}

export const adminDb = db as admin.firestore.Firestore;
export const adminAuth = authService as admin.auth.Auth;
