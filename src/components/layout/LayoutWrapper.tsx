'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from './navbar';
import { Footer } from './footer';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Hide the global Navbar and Footer if we are inside the CBT Exam Simulator
  // This ensures a strict, distraction-free testing environment.
  const isExamPage = pathname?.includes('/dashboard/exam/');

  return (
    <>
      {!isExamPage && <Navbar />}
      <main className="flex-1 relative z-10">
        {children}
      </main>
      {!isExamPage && <Footer />}
    </>
  );
}
