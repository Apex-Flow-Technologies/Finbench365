import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ProgressBarProvider } from '@/components/ProgressBarProvider';
import Script from 'next/script';
import { Navbar } from '@/components/layout/navbar';
import { AmbientBackground } from '@/components/ui/ambient-background';
import { Footer } from '@/components/layout/footer';
import { LayoutWrapper } from '@/components/layout/LayoutWrapper';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/next';

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
  variable: '--tabular-nums',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MyExams365 | Institutional Financial Examination & CBT Simulator',
  description: 'Prepare for CFA®, FRM®, and Quantitative Finance certifications with Institutional CBT fidelity, Item-Response Theory (IRT) diagnostic analytics, and dynamic algorithmic problem sets.',
  keywords: ['CFA', 'FRM', 'Institutional CBT Simulator', 'CBT Mock Exam', 'Financial Certification', 'Quantitative Finance', 'Chartered Financial Analyst'],
  authors: [{ name: 'MyExams365 Quantitative Curriculum Team' }],
  openGraph: {
    title: 'MyExams365 | Institutional Financial Examination & CBT Simulator',
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
    <html lang="en" className={`${inter.variable} ${jakarta.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col font-sans bg-white dark:bg-[#0B0C10] text-[#111B35] dark:text-[#FBFBF9] antialiased selection:bg-[#181A1F] selection:text-white dark:selection:bg-white dark:selection:text-[#181A1F] transition-colors duration-300">
        {/* Razorpay Checkout JS — loaded globally for payment pages */}
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
        <ProgressBarProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <AmbientBackground />
            <LayoutWrapper>
              {children}
            </LayoutWrapper>
            <Toaster
              position="top-right"
              toastOptions={{
                className: 'dark:!bg-[#181A1F] dark:!text-[#FBFBF9] dark:!border-[#282C36] !bg-white !text-[#111B35] !border-slate-200',
                style: {
                  borderRadius: '12px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  border: '1px solid',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                },
                success: { iconTheme: { primary: '#10b981', secondary: 'white' } },
                error: { iconTheme: { primary: '#ef4444', secondary: 'white' } },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
        </ProgressBarProvider>
        <Analytics />
      </body>
    </html>
  );
}
