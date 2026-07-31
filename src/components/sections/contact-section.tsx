import React from 'react';
import { Mail, Phone } from 'lucide-react';

export function ContactSection() {
  return (
    <section id="contact" className="py-24 md:py-32 bg-slate-50 dark:bg-[#121419] transition-colors duration-300 text-slate-900 dark:text-[#FBFBF9] border-t border-[#E0E0D8] dark:border-[#282C36]">
      <div className="max-w-[1240px] mx-auto px-6 md:px-8">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white transition-colors">Get in Touch</h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg transition-colors">
            Connect with our designated partner today.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 max-w-3xl mx-auto">
          <a 
            href="tel:+919008867475" 
            className="group flex flex-col items-center p-10 bg-white border border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] rounded-3xl shadow-sm hover:shadow-xl dark:hover:border-amber-500/30 transition-all duration-300 text-center outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#121419]"
          >
            <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Phone className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Call Partner</h3>
            <p className="text-slate-600 dark:text-slate-400 font-medium">+91 90088 67475</p>
          </a>

          <a 
            href="mailto:wealth@fintelyxinvestments.com" 
            className="group flex flex-col items-center p-10 bg-white border border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] rounded-3xl shadow-sm hover:shadow-xl dark:hover:border-amber-500/30 transition-all duration-300 text-center outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#121419]"
          >
            <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Mail className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Mail us</h3>
            <p className="text-slate-600 dark:text-slate-400 font-medium">support@myexams365.com</p>
          </a>
        </div>
      </div>
    </section>
  );
}
