import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import NextTopLoader from 'nextjs-toploader';
import Script from 'next/script';
import { Navbar } from '@/components/layout/navbar';
import { AmbientBackground } from '@/components/ui/ambient-background';
import { Footer } from '@/components/layout/footer';
import { LayoutWrapper } from '@/components/layout/LayoutWrapper';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from 'react-hot-toast';
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
      <body className="min-h-screen flex flex-col font-sans bg-white dark:bg-[#0B0C10] text-slate-900 dark:text-[#FBFBF9] antialiased selection:bg-[#181A1F] selection:text-white dark:selection:bg-white dark:selection:text-[#181A1F] transition-colors duration-300">
        {/* Razorpay Checkout JS — loaded globally for payment pages */}
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
        <NextTopLoader
          color="#F59E0B"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #F59E0B,0 0 5px #F59E0B"
          zIndex={1600}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <AmbientBackground />
            <LayoutWrapper>
              {children}
            </LayoutWrapper>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: '#181A1F',
                  color: '#FBFBF9',
                  border: '1px solid #282C36',
                  borderRadius: '12px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                },
                success: { iconTheme: { primary: '#10b981', secondary: '#181A1F' } },
                error: { iconTheme: { primary: '#ef4444', secondary: '#181A1F' } },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
