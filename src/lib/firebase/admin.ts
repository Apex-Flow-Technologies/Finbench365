import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

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
    console.log('Firebase Admin initialized successfully');
  } catch (err) {
    console.error('Firebase Admin init failed:', err);
  }
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
