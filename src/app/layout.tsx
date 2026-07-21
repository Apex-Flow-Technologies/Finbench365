import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/navbar';
import { AmbientBackground } from '@/components/ui/ambient-background';
import { Footer } from '@/components/layout/footer';
import { AuthProvider } from '@/context/AuthContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FinBench365 | Institutional Financial Examination & CBT Simulator',
  description: 'Prepare for CFA®, FRM®, and Quantitative Finance certifications with Institutional CBT fidelity, Item-Response Theory (IRT) diagnostic analytics, and dynamic algorithmic problem sets.',
  keywords: ['CFA', 'FRM', 'Institutional CBT Simulator', 'CBT Mock Exam', 'Financial Certification', 'Quantitative Finance', 'Chartered Financial Analyst'],
  authors: [{ name: 'FinBench365 Quantitative Curriculum Team' }],
  openGraph: {
    title: 'FinBench365 | Institutional Financial Examination & CBT Simulator',
    description: ' global financial certifications. Engineered by quantitative analysts and CFA charterholders.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen flex flex-col font-sans bg-[#FAFAF8] text-[#181A1F] antialiased selection:bg-[#181A1F] selection:text-white">
        <AuthProvider>
          <AmbientBackground />
          <Navbar />
          <main className="flex-1 relative z-10">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
