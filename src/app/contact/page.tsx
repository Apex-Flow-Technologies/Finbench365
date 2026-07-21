import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#121419] text-[#FBFBF9] py-16 px-6 font-sans selection:bg-amber-500/30">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors mb-12 group">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-bold tracking-wide">Back to Home</span>
        </Link>
        
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Contact & Grievance</h1>
          <p className="text-slate-400 text-lg">Business Identity & Support Information</p>
        </div>

        <div className="space-y-8 text-slate-300 leading-relaxed text-lg">
          <section className="bg-[#181A1F] border border-[#282C36] rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Business Identity</h2>
            <p className="mb-6">
              FinExamsEdge is owned and operated by <strong>FinExamsEdge EdTech Private Limited</strong>.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <MapPin className="w-6 h-6 text-amber-500 shrink-0 mt-1" />
                <div>
                  <strong className="text-white block mb-1">Registered Office</strong>
                  [Full Address]<br />
                  Chennai - [PIN Code]<br />
                  Tamil Nadu, India
                </div>
              </div>
            </div>
          </section>

          <section className="bg-[#181A1F] border border-[#282C36] rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Customer Support</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Mail className="w-6 h-6 text-emerald-500 shrink-0" />
                <div>
                  <strong className="text-white block mb-1">Email Support</strong>
                  support@finexamsedge.com
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Phone className="w-6 h-6 text-blue-500 shrink-0" />
                <div>
                  <strong className="text-white block mb-1">Phone</strong>
                  [Phone Number] (Hours: 9 AM to 6 PM IST)
                </div>
              </div>
            </div>
          </section>

          <section className="bg-[#181A1F] border border-[#282C36] rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Grievance Redressal</h2>
            <p className="mb-6">
              In accordance with the Consumer Protection (E-Commerce) Rules, 2020 and the Digital Personal Data Protection Act, 2023, the contact details of the Grievance Officer are provided below:
            </p>
            
            <div className="space-y-4 bg-[#121419] p-6 rounded-xl border border-[#282C36]">
              <div><strong className="text-white">Officer Name:</strong> [Name]</div>
              <div><strong className="text-white">Email:</strong> grievance@finexamsedge.com</div>
              <p className="text-sm text-slate-400 mt-4">
                Grievances are acknowledged within 48 hours and resolved within 30 days.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
