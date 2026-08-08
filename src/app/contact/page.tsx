import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#121419] text-[#111B35] dark:text-[#FBFBF9] py-24 px-6 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-[#475569] hover:text-amber-600 dark:text-[#94A3B8] dark:hover:text-amber-500 transition-colors mb-16 group">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-bold tracking-wide">Back to Home</span>
        </Link>
        
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-[#111B35] dark:text-white transition-colors">Get in Touch</h1>
          <p className="text-[#334155] dark:text-[#94A3B8] text-lg transition-colors">Questions about a plan, your access, or an invoice? Reach out and we will get back to you.</p>
        </div>

        {/* Each card's href and its visible text are generated from one value.
            They had drifted apart: the card read "support@myexams365.com" while
            the mailto: opened wealth@fintelyxinvestments.com, so every candidate
            who clicked it wrote to the wrong company. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
          {[
            { icon: Phone, title: 'Call us', display: '+91 90088 67475', href: 'tel:+919008867475' },
            { icon: Phone, title: 'Landline', display: '044 4636 7250', href: 'tel:+914446367250' },
            { icon: Mail, title: 'Mail us', display: 'support@myexams365.com', href: 'mailto:support@myexams365.com' },
          ].map((c) => (
            <a
              key={c.title}
              href={c.href}
              className="group flex flex-col items-center p-8 sm:p-10 bg-white border border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] rounded-3xl shadow-sm hover:shadow-xl dark:hover:border-amber-500/30 transition-all duration-300 text-center outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#121419]"
            >
              <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <c.icon className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-[#111B35] dark:text-white mb-2">{c.title}</h3>
              <p className="text-[#334155] dark:text-[#94A3B8] font-medium break-all">{c.display}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
