'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Menu, X } from 'lucide-react';

import { usePathname, useRouter } from 'next/navigation';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 28) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
          ? 'bg-[#FBFBF9]/92 backdrop-blur-md border-b border-[#E3E3DE] py-3 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)]'
          : 'bg-transparent py-6 border-b border-transparent'
        }`}
    >
      <div className="max-w-[1240px] mx-auto px-6 md:px-8 flex items-center justify-between">
        {/* Logo */}
        <a
          href="#hero"
          onClick={(e) => scrollToSection(e, 'hero')}
          className="flex items-center gap-2.5 group focus:outline-none"
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm tracking-tighter transition-colors ${scrolled
              ? 'bg-[#181A1F] text-[#FBFBF9] shadow-sm'
              : 'bg-white/10 text-white border border-white/20 backdrop-blur-sm'
            }`}>
            FB
          </div>
          <div className="flex flex-col">
            <span className={`font-semibold tracking-tight text-base transition-colors ${scrolled ? 'text-[#181A1F]' : 'text-white'
              }`}>
              FinBench<span className={scrolled ? 'text-amber-700 font-mono text-xs ml-0.5' : 'text-amber-400 font-mono text-xs ml-0.5'}>365</span>
            </span>
            <span className={`text-[10px] tracking-widest uppercase font-mono transition-colors ${scrolled ? 'text-slate-500' : 'text-slate-400'
              }`}>
              By MentraEdge
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: 'Exams', href: '/exams', isExternal: true },
            { label: 'Testimonials', href: '#testimonials' },
            { label: 'FAQ', href: '#faq' },
            { label: 'Contact', href: '#contact' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => {
                if (!item.isExternal) {
                  scrollToSection(e, item.href.replace('#', ''));
                }
              }}
              className={`text-sm font-medium transition-colors hover:text-amber-500 relative py-1 ${scrolled ? 'text-slate-700 hover:text-[#181A1F]' : 'text-slate-300 hover:text-white'
                }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Action CTAs */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            onClick={() => router.push('/login')}
            className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 shadow-sm ${scrolled
                ? 'bg-[#181A1F] text-[#FBFBF9] hover:bg-[#272B33] hover:shadow-md'
                : 'bg-white text-[#181A1F] hover:bg-[#F2F2EC] hover:shadow-[0_0_24px_rgba(255,255,255,0.2)]'
              }`}
          >
            Candidate Login
          </button>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`md:hidden p-2 rounded-lg transition-colors ${scrolled ? 'text-slate-800 hover:bg-slate-200/60' : 'text-white hover:bg-white/10'
            }`}
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
            className="md:hidden border-b border-[#E3E3DE] bg-[#FBFBF9] shadow-lg overflow-hidden px-6 py-6"
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
                  className="text-base font-medium text-slate-800 hover:text-amber-700 py-1.5 border-b border-slate-100 flex items-center justify-between"
                >
                  <span>{item.label}</span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400" />
                </a>
              ))}
              <div className="pt-4 flex flex-col gap-3">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push('/login');
                  }}
                  className="w-full py-3 text-center rounded-lg bg-[#181A1F] text-white font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-[#272B33] transition-colors"
                >
                  Candidate Login
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
