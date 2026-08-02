'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { updateUserActiveSession, createUserProfile } from '@/lib/firebase/db';

export interface UserProfile extends User {
  role?: 'student' | 'admin';
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let snapshotUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Ensure local session ID exists
        let localSessionId = localStorage.getItem('myexams_session_id');
        let isNewSession = false;
        if (!localSessionId) {
          localSessionId = 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
          localStorage.setItem('myexams_session_id', localSessionId);
          isNewSession = true;
        }

        try {
          if (isNewSession) {
            updateUserActiveSession(firebaseUser.uid, localSessionId).catch(console.error);
          }

          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();

            if (userData.suspended) {
              alert("Your account has been suspended. Please contact support if you believe this is a mistake.");
              await auth.signOut();
              localStorage.removeItem('myexams_session_id');
              setUser(null);
              setLoading(false);
              return;
            }

            setUser(Object.assign(firebaseUser, { role: userData.role || 'student' as const }));

            // If activeSessionId is not set yet in DB, set it in background
            if (!userData.activeSessionId) {
              updateUserActiveSession(firebaseUser.uid, localSessionId).catch(console.error);
            }
          } else {
            // Authenticated but no Firestore profile — create a complete one.
            // Previously the session ping created a bare document with no
            // email/name/role/createdAt, which then vanished from every
            // ordered admin query and showed as "Unknown User" on orders.
            createUserProfile(firebaseUser.uid, {
              email: firebaseUser.email,
              name: firebaseUser.displayName,
            })
              .then(() => updateUserActiveSession(firebaseUser.uid, localSessionId!))
              .catch((err) => console.error('Could not create user profile:', err));
            setUser(Object.assign(firebaseUser, { role: 'student' as const }));
          }

          // Real-time listener for Single Active Session revocation + suspension
          const { onSnapshot } = await import('firebase/firestore');
          snapshotUnsubscribe = onSnapshot(userDocRef, (snap) => {
            if (snap.exists()) {
              const data = snap.data();

              if (data.suspended) {
                alert("Your account has been suspended. You have been signed out.");
                auth.signOut();
                localStorage.removeItem('myexams_session_id');
                setUser(null);
                return;
              }

              const currentLocalSess = localStorage.getItem('myexams_session_id');
              if (data.activeSessionId && currentLocalSess && data.activeSessionId !== currentLocalSess) {
                alert("Security Alert: Your account was logged in on another device. You have been signed out of this session.");
                auth.signOut();
                localStorage.removeItem('myexams_session_id');
                setUser(null);
              }
            }
          }, (error) => {
            // Silently handle permission errors for the real-time listener if document doesn't exist yet
            console.warn('User snapshot listener error (non-critical):', error.code);
          });

        } catch (error) {
          console.error("Error fetching user role:", error);
          setUser(Object.assign(firebaseUser, { role: 'student' as const }));
        }
      } else {
        setUser(null);
        if (snapshotUnsubscribe) snapshotUnsubscribe();
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (snapshotUnsubscribe) snapshotUnsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
