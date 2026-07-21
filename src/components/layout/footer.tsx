'use client';

import React, { useEffect, useState } from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export function Footer() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
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

  if (mounted && pathname.startsWith('/editor')) {
    return null;
  }

  return (
    <footer className="bg-[#15171C] text-slate-400 pt-20 pb-12 border-t border-[#262A34] font-sans">
      <div className="max-w-[1240px] mx-auto px-6 md:px-8">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 pb-16 border-b border-[#262A34]">

          {/* Logo & Mission (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            <a
              href="#hero"
              onClick={(e) => scrollToSection(e, 'hero')}
              className="flex items-center gap-2.5 group focus:outline-none"
            >
              <div className="w-8 h-8 rounded-lg bg-[#FBFBF9] text-[#181A1F] flex items-center justify-center font-mono font-bold text-sm tracking-tighter shadow-sm">
                FB
              </div>
              <span className="font-semibold tracking-tight text-lg text-white">
                FinBench<span className="text-amber-400 font-mono text-xs ml-0.5">365</span>
              </span>
            </a>

            <p className="text-slate-400 text-sm leading-relaxed pr-6">
              Engineering calm confidence, mathematical precision, and Institutional CBT exact fidelity for high-stakes global financial certification examinations.
            </p>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 pt-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>2026–2027 Examination Matrix Active</span>
            </div>
          </div>

          {/* Column 1: Certifications (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h5 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Certifications
            </h5>
            <ul className="space-y-2.5 text-sm">
              {['Track A  Level I', 'Track A  Level II', 'Track A  Level III', 'Track B  Part I', 'Track B  Part II', 'Track C  Quant Final'].map((item) => (
                <li key={item}>
                  <a href="/exams" className="hover:text-amber-400 transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: Platform & Navigation (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h5 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Quick Links
            </h5>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: 'Exams Overview', id: '/exams', isExternal: true },
                { label: 'Testimonials', id: 'testimonials' },
                { label: 'FAQ', id: 'faq' },
                { label: 'Academic Contact', id: 'contact' },
              ].map((link) => (
                <li key={link.label}>
                  <a
                    href={link.isExternal ? link.id : `#${link.id}`}
                    onClick={(e) => {
                      if (!link.isExternal) scrollToSection(e, link.id);
                    }}
                    className="hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Institutional Research (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h5 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Pedagogy
            </h5>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#faq" onClick={(e) => scrollToSection(e, 'faq')} className="hover:text-white transition-colors">IRT Calibration 2PL</a></li>
              <li><a href="#testimonials" onClick={(e) => scrollToSection(e, 'testimonials')} className="hover:text-white transition-colors">Distractor Deconstruction</a></li>
              <li><a href="/exams" className="hover:text-white transition-colors">CBT UI Spec v4.8</a></li>
              <li><a href="#testimonials" onClick={(e) => scrollToSection(e, 'testimonials')} className="hover:text-white transition-colors">Verified Score Reports</a></li>
              <li><a href="#contact" onClick={(e) => scrollToSection(e, 'contact')} className="hover:text-white transition-colors">University Lab Licenses</a></li>
            </ul>
          </div>

          {/* Column 4: Socials & Connect (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h5 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Socials
            </h5>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: 'LinkedIn', href: 'https://linkedin.com' },
                { label: 'X (Twitter)', href: 'https://twitter.com' },
                { label: 'Bloomberg Terminal App', href: '#' },
                { label: 'Research Portal', href: '#' },
                { label: 'Academic API Docs', href: '#' },
              ].map((soc, i) => (
                <li key={i}>
                  <a href={soc.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white transition-colors">
                    <span>{soc.label}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Bottom Legal & Copyright Section */}
        <div className="pt-8 flex flex-col items-center gap-6 text-xs text-slate-500 font-mono text-center">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 font-sans text-sm">
            <Link href="/disclaimer" className="hover:text-amber-400 transition-colors">Disclaimer</Link>
            <Link href="/terms" className="hover:text-amber-400 transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-amber-400 transition-colors">Privacy Policy</Link>
            <Link href="/refunds" className="hover:text-amber-400 transition-colors">Refund & Cancellation Policy</Link>
            <Link href="/contact" className="hover:text-amber-400 transition-colors">Contact & Grievance</Link>
          </div>
          <div className="mt-4 pt-6 border-t border-[#20232B] text-[11px] text-slate-500 leading-relaxed max-w-5xl font-sans text-justify">
            FinExamsEdge is an independent exam-preparation platform. We are not affiliated with, endorsed by, sponsored by, or in any way officially connected with the National Institute of Securities Markets (NISM), the Securities and Exchange Board of India (SEBI), or any other regulator, exchange, or certification body. "NISM", "SEBI" and related names, marks and logos are the property of their respective owners and are used on this website solely for identification and descriptive purposes; such use does not imply any endorsement. All practice questions on FinExamsEdge are original content and are not actual exam questions. FinExamsEdge does not guarantee any exam result and issues no certification.
          </div>
          <div className="mt-2">
            © {new Date().getFullYear()} FinExamsEdge EdTech Private Limited. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
