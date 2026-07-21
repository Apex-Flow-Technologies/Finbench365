'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode, requiredRole?: 'student' | 'editor' | 'admin' }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Not logged in, redirect to login
        router.push('/login');
      } else if (requiredRole && user.role?.toLowerCase() !== requiredRole.toLowerCase() && user.role?.toLowerCase() !== 'admin') {
        // Doesn't have required role (admins can access anything)
        router.push('/dashboard');
      }
    }
  }, [user, loading, router, requiredRole]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || (requiredRole && user.role?.toLowerCase() !== requiredRole.toLowerCase() && user.role?.toLowerCase() !== 'admin')) {
    return null;
  }

  return <>{children}</>;
}
