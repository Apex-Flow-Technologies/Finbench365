import { getApps, initializeApp, cert } from 'firebase-admin/app';
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

try {
  if (!getApps().length) {
    if (process.env.FIREBASE_PRIVATE_KEY) {
      initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      initializeApp({ projectId: 'demo-project' });
    }
  }
} catch (error: any) {
  console.error('Firebase admin initialization error:', error.message);
  if (!getApps().length) {
    initializeApp({ projectId: 'demo-project' });
  }
}

export const adminDb = new Proxy({}, {
  get: (target, prop) => {
    const { getFirestore } = require('firebase-admin/firestore');
    const { getApp } = require('firebase-admin/app');
    return (getFirestore(getApp()) as any)[prop];
  }
}) as Firestore;

export const adminAuth = new Proxy({}, {
  get: (target, prop) => {
    const { getAuth } = require('firebase-admin/auth');
    const { getApp } = require('firebase-admin/app');
    return (getAuth(getApp()) as any)[prop];
  }
}) as Auth;
