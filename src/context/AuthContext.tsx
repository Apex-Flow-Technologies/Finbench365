'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { updateUserActiveSession } from '@/lib/firebase/db';

export interface UserProfile extends User {
  role?: 'student' | 'editor' | 'admin';
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
        let localSessionId = localStorage.getItem('finbench_session_id');
        if (!localSessionId) {
          localSessionId = 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
          localStorage.setItem('finbench_session_id', localSessionId);
          // Set in Firestore
          updateUserActiveSession(firebaseUser.uid, localSessionId).catch(() => {});
        }

        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser(Object.assign(firebaseUser, { role: userData.role }));
            
            // If activeSessionId is not set yet in DB, set it
            if (!userData.activeSessionId) {
              updateUserActiveSession(firebaseUser.uid, localSessionId).catch(() => {});
            }
          } else {
            setUser(Object.assign(firebaseUser, { role: 'student' as const }));
          }

          // Real-time listener for Single Active Session revocation
          const { onSnapshot } = await import('firebase/firestore');
          snapshotUnsubscribe = onSnapshot(userDocRef, (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              const currentLocalSess = localStorage.getItem('finbench_session_id');
              if (data.activeSessionId && currentLocalSess && data.activeSessionId !== currentLocalSess) {
                alert("Security Alert: Your account was logged in on another device. You have been signed out of this session.");
                auth.signOut();
                localStorage.removeItem('finbench_session_id');
                setUser(null);
              }
            }
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
