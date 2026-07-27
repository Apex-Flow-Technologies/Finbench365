import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#121419] text-slate-900 dark:text-[#FBFBF9] py-16 px-6 font-sans selection:bg-amber-500/30 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-500 transition-colors mb-12 group">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-bold tracking-wide">Back to Home</span>
        </Link>
        
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white transition-colors">Contact & Grievance</h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg transition-colors">Business Identity & Support Information</p>
        </div>

        <div className="space-y-8 text-slate-700 dark:text-slate-300 leading-relaxed text-lg transition-colors">
          <section className="bg-white border-slate-200 dark:bg-[#181A1F] border dark:border-[#282C36] rounded-2xl p-8 shadow-sm transition-colors">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 transition-colors">Business Identity</h2>
            <p className="mb-6">
              FinExamsEdge is owned and operated by <strong className="text-slate-900 dark:text-white">FinExamsEdge EdTech Private Limited</strong>.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <MapPin className="w-6 h-6 text-amber-600 dark:text-amber-500 shrink-0 mt-1 transition-colors" />
                <div>
                  <strong className="text-slate-900 dark:text-white block mb-1 transition-colors">Registered Office</strong>
                  [Full Address]<br />
                  Chennai - [PIN Code]<br />
                  Tamil Nadu, India
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border-slate-200 dark:bg-[#181A1F] border dark:border-[#282C36] rounded-2xl p-8 shadow-sm transition-colors">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 transition-colors">Customer Support</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Mail className="w-6 h-6 text-emerald-600 dark:text-emerald-500 shrink-0 transition-colors" />
                <div>
                  <strong className="text-slate-900 dark:text-white block mb-1 transition-colors">Email Support</strong>
                  support@finexamsedge.com
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Phone className="w-6 h-6 text-blue-600 dark:text-blue-500 shrink-0 transition-colors" />
                <div>
                  <strong className="text-slate-900 dark:text-white block mb-1 transition-colors">Phone</strong>
                  [Phone Number] (Hours: 9 AM to 6 PM IST)
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border-slate-200 dark:bg-[#181A1F] border dark:border-[#282C36] rounded-2xl p-8 shadow-sm transition-colors">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 transition-colors">Grievance Redressal</h2>
            <p className="mb-6">
              In accordance with the Consumer Protection (E-Commerce) Rules, 2020 and the Digital Personal Data Protection Act, 2023, the contact details of the Grievance Officer are provided below:
            </p>
            
            <div className="space-y-4 bg-slate-50 border-slate-200 dark:bg-[#121419] p-6 rounded-xl border dark:border-[#282C36] transition-colors">
              <div><strong className="text-slate-900 dark:text-white transition-colors">Officer Name:</strong> [Name]</div>
              <div><strong className="text-slate-900 dark:text-white transition-colors">Email:</strong> grievance@finexamsedge.com</div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-4 transition-colors">
                Grievances are acknowledged within 48 hours and resolved within 30 days.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
