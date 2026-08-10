import React from 'react';
import { Mail, Phone } from 'lucide-react';
import { SUPPORT_EMAIL } from '@/constants/brand';

export function ContactSection() {
  return (
    <section id="contact" className="py-24 md:py-32 bg-slate-50 dark:bg-[#121419] transition-colors duration-300 text-[#111B35] dark:text-[#FBFBF9] border-t border-[#E0E0D8] dark:border-[#282C36]">
      <div className="max-w-[1240px] mx-auto px-6 md:px-8">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-[#111B35] dark:text-white transition-colors">Get in Touch</h2>
          <p className="text-[#334155] dark:text-[#94A3B8] text-lg transition-colors">
            Questions about a plan, your access, or an invoice? Reach out and we will get back to you.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 max-w-3xl mx-auto">
          <a 
            href="tel:+914446367250"
            className="group flex flex-col items-center p-10 bg-white border border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] rounded-3xl shadow-sm hover:shadow-xl dark:hover:border-amber-500/30 transition-all duration-300 text-center outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#121419]"
          >
            <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Phone className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#111B35] dark:text-white mb-2">Reach us at</h3>
            <p className="text-[#334155] dark:text-[#94A3B8] font-medium">+91 4446367250</p>
          </a>

          {/* The card has always displayed support@myexams365.com while the link
              opened a different company's address, so everyone who clicked
              "Mail us" here wrote to the wrong place. Both now come from one
              constant, as they already do on /contact. */}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
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
    </section>
  );
}
