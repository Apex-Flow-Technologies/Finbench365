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
          <p className="text-[#334155] dark:text-[#94A3B8] text-lg transition-colors">Connect with our designated partner today.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 max-w-3xl mx-auto">
          <a 
            href="tel:+919008867475" 
            className="group flex flex-col items-center p-10 bg-white border border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] rounded-3xl shadow-sm hover:shadow-xl dark:hover:border-amber-500/30 transition-all duration-300 text-center outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#121419]"
          >
            <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Phone className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#111B35] dark:text-white mb-2">Call Partner</h3>
            <p className="text-[#334155] dark:text-[#94A3B8] font-medium">+91 90088 67475</p>
          </a>

          <a 
            href="mailto:wealth@fintelyxinvestments.com" 
            className="group flex flex-col items-center p-10 bg-white border border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] rounded-3xl shadow-sm hover:shadow-xl dark:hover:border-amber-500/30 transition-all duration-300 text-center outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#121419]"
          >
            <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Mail className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#111B35] dark:text-white mb-2">Mail us</h3>
            <p className="text-[#334155] dark:text-[#94A3B8] font-medium">support@myexams365.com</p>
          </a>
        </div>
      </div>
    </div>
  );
}
