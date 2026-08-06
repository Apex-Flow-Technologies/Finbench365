'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Menu, X } from 'lucide-react';

import { usePathname } from 'next/navigation';
import { useRouter } from 'next-nprogress-bar';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AdminPreviewBanner } from '@/components/AdminPreviewBanner';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { Logo } from '@/components/ui/Logo';

export function Navbar() {
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      if (window.scrollY > 28) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isScrolled = mounted && (scrolled || pathname === '/dashboard');

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    if (pathname !== '/') {
      window.location.href = id === 'hero' ? '/' : `/#${id}`;
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  if (mounted && (pathname.startsWith('/editor') || pathname.startsWith('/admin'))) {
    return null;
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white/90 dark:bg-[#0B0C10]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/10 shadow-sm ${
        isScrolled ? 'py-3' : 'py-4 md:py-5'
      }`}
    >
      <AdminPreviewBanner />
      <div className="max-w-[1240px] mx-auto px-6 md:px-8 flex items-center justify-between">
        {/* Logo */}
        <a
          href="#hero"
          onClick={(e) => scrollToSection(e, 'hero')}
          className="flex items-center gap-2.5 group focus:outline-none"
        >
          <Logo className="h-9 sm:h-10" priority />
          <span className="sr-only">MyExams365 by MentraEdge</span>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: 'Exams', href: '/exams', isExternal: true },
            { label: 'Testimonials', href: '#testimonials' },
            { label: 'FAQ', href: '#faq' },
            { label: 'Contact', href: '#contact' },
          ].map((item) => (
            <motion.a
              key={item.label}
              href={item.href}
              onClick={(e) => {
                if (!item.isExternal) {
                  scrollToSection(e, item.href.replace('#', ''));
                }
              }}
              whileHover={{ y: -1 }}
              transition={{ duration: 0.15 }}
              className={`text-sm font-medium transition-colors relative py-1 focus-visible:ring-2 focus-visible:ring-amber-500 rounded outline-none ${
                pathname === item.href || (pathname === '/' && item.href === '#hero')
                  ? 'text-amber-600 dark:text-amber-400 font-semibold'
                  : 'text-[#111B35] hover:text-amber-600 dark:text-[#E2E8F0] dark:hover:text-amber-400'
              }`}
            >
              {item.label}
            </motion.a>
          ))}
        </nav>

        {/* Action CTAs */}
        <div className="hidden sm:flex items-center gap-3">
          <ThemeToggle />
          <LoadingButton
            isLoading={isNavigating}
            loadingText={user ? 'Opening...' : 'Logging in...'}
            onClick={() => {
              setIsNavigating(true);
              try {
                if (!user) {
                  router.push('/login');
                } else if (user.role === 'admin') {
                  router.push('/admin');
                } else {
                  router.push('/dashboard');
                }
              } catch (e) {
                setIsNavigating(false);
              }
            }}
            className="px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 shadow-sm bg-[#111B35] text-[#FBFBF9] dark:bg-white dark:text-[#111B35] hover:opacity-90 hover:shadow-md press-effect focus-ring"
          >
            {user ? (user.role === 'admin' ? 'Admin Portal' : 'My Dashboard') : 'Login'}
          </LoadingButton>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg transition-colors text-[#111B35] dark:text-[#FBFBF9] hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-amber-500 rounded outline-none"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="md:hidden border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0C10] shadow-lg overflow-hidden px-6 py-6"
          >
            <div className="flex flex-col gap-4">
              {[
                { label: 'Exams & Curricula', href: '/exams', isExternal: true },
                { label: 'Charterholder Reviews', href: '#testimonials' },
                { label: 'Frequently Asked Questions', href: '#faq' },
                { label: 'Institutional Contact', href: '#contact' },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => {
                    if (!item.isExternal) {
                      scrollToSection(e, item.href.replace('#', ''));
                    } else {
                      setMobileMenuOpen(false);
                    }
                  }}
                  className="text-base font-medium text-[#111B35] hover:text-amber-600 dark:text-[#E2E8F0] dark:hover:text-amber-400 py-2.5 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
                >
                  <span>{item.label}</span>
                  <ArrowUpRight className="w-4 h-4 text-[#475569] dark:text-[#94A3B8]" />
                </a>
              ))}
              <div className="pt-4 flex flex-col gap-3">
                <LoadingButton
                  isLoading={isNavigating}
                  loadingText={user ? 'Opening...' : 'Logging in...'}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsNavigating(true);
                    try {
                      if (!user) {
                        router.push('/login');
                      } else if (user.role === 'admin') {
                        router.push('/admin');
                      } else {
                        router.push('/dashboard');
                      }
                    } catch (e) {
                      setIsNavigating(false);
                    }
                  }}
                  className="w-full py-3.5 text-center rounded-lg bg-[#111B35] text-[#FBFBF9] dark:bg-white dark:text-[#111B35] font-bold flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-all press-effect"
                >
                  {user ? (user.role === 'admin' ? 'Admin Portal' : 'My Dashboard') : 'Login'}
                </LoadingButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
