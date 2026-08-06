'use client';

import React, { useEffect, useState } from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

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
          <div className="lg:col-span-8 space-y-5">
            <a
              href="#hero"
              onClick={(e) => scrollToSection(e, 'hero')}
              className="flex items-center gap-2.5 group focus:outline-none"
            >
              {/* The footer is always dark, so it always takes the light
                  artwork — not the theme-swapped <Logo />. */}
              <Image src="/logo-dark.png" alt="MyExams365" width={953} height={535} className="h-10 w-auto" />
              <span className="sr-only">MyExams365 by MentraEdge</span>
            </a>

            <p className="text-slate-400 text-sm leading-relaxed pr-6">
              Engineering calm confidence, mathematical precision, and Institutional CBT exact fidelity for high-stakes global financial certification examinations.
            </p>

            <div className="flex items-center gap-2 text-xs tabular-nums text-slate-500 pt-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>2026–2027 Examination Matrix Active</span>
            </div>
          </div>

          {/* Quick links */}
          <div className="lg:col-span-4 space-y-3">
            <h5 className="tabular-nums text-xs font-bold uppercase tracking-wider text-white">
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

          </div>

        {/* Bottom Legal & Copyright Section */}
        <div className="pt-8 flex flex-col items-center gap-6 text-xs text-slate-500 tabular-nums text-center">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 font-sans text-sm">
            <Link href="/disclaimer" className="hover:text-amber-400 transition-colors">Disclaimer</Link>
            <Link href="/terms" className="hover:text-amber-400 transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-amber-400 transition-colors">Privacy Policy</Link>
            <Link href="/refunds" className="hover:text-amber-400 transition-colors">Refund & Cancellation Policy</Link>
            <Link href="/contact" className="hover:text-amber-400 transition-colors">Contact & Grievance</Link>
          </div>
          <div className="mt-4 pt-6 border-t border-[#20232B] text-[11px] text-slate-500 leading-relaxed max-w-5xl font-sans text-justify">
            MyExams365 is an independent exam-preparation platform. We are not affiliated with, endorsed by, sponsored by, or in any way officially connected with the National Institute of Securities Markets (NISM), the Securities and Exchange Board of India (SEBI), or any other regulator, exchange, or certification body. "NISM", "SEBI" and related names, marks and logos are the property of their respective owners and are used on this website solely for identification and descriptive purposes; such use does not imply any endorsement. All practice questions on MyExams365 are original content and are not actual exam questions. MyExams365 does not guarantee any exam result and issues no certification.
          </div>
          <div className="mt-2">
            © {new Date().getFullYear()} MentraEdge. All rights reserved. MyExams365 is a MentraEdge product.
          </div>
        </div>
      </div>
    </footer>
  );
}
