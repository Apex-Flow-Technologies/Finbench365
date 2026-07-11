'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Building2, ArrowUpRight } from 'lucide-react';

export function ContactSection() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    certification: 'CFA Level I',
    institution: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.fullName) return;
    setSubmitted(true);
  };

  return (
    <section id="contact" className="py-24 md:py-32 bg-[#F2F2EC] text-[#181A1F] border-b border-[#E0E0D8] relative">
      <div className="max-w-[1240px] mx-auto px-6 md:px-8">
        <div className="bg-white border border-[#DDDDCF] rounded-2xl shadow-[0_16px_56px_-16px_rgba(0,0,0,0.06)] overflow-hidden grid grid-cols-1 lg:grid-cols-12">

          {/* Left Column: Institutional Pitch */}
          <div className="lg:col-span-5 bg-[#181A1F] text-[#FBFBF9] p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-slate-800 text-amber-400 font-mono text-xs font-semibold uppercase tracking-wider mb-6">
                <Building2 className="w-3.5 h-3.5" />
                <span>Academic & Institutional Consultation</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white leading-snug mb-4">
                Schedule a Private Consultation or Institutional Demo.
              </h3>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-8">
                Whether you are an individual candidate aiming for the 95th percentile or a university finance department looking to license our Institutional CBT simulator, our quantitative analysts are ready to assist.
              </p>

              <div className="space-y-4 font-mono text-xs text-slate-400 pt-6 border-t border-slate-800">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Custom Institutional CBT lab deployments for universities</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Bulk institutional licensing with IRT cohort analytics</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Direct 1-on-1 curriculum orientation with CFA charterholders</span>
                </div>
              </div>
            </div>

            <div className="pt-10 mt-10 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Direct Inquiry: academic@finbench365.com</span>
              <span className="text-amber-400">Response &lt; 4 Hours</span>
            </div>
          </div>

          {/* Right Column: Contact Form / Interactive Banner */}
          <div className="lg:col-span-7 p-8 md:p-12 flex flex-col justify-center">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12 px-6 bg-[#FAFAF8] border border-[#E0E0D8] rounded-xl space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
                </div>
                <h4 className="text-2xl font-semibold text-slate-900">
                  Academic Consultation Logged
                </h4>
                <p className="text-slate-600 text-base max-w-md mx-auto leading-relaxed">
                  Thank you, <strong className="text-slate-900">{formData.fullName}</strong>. Our quantitative curriculum director will review your targets for <strong className="text-slate-900">{formData.certification}</strong> and respond within 4 business hours.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-4 px-6 py-2.5 rounded-lg bg-[#181A1F] text-white text-sm font-medium hover:bg-[#282C36] transition-colors"
                >
                  Submit Another Inquiry
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <h4 className="text-xl font-semibold text-slate-900 mb-1">
                    Request Candidate or Institutional Access
                  </h4>
                  <p className="text-sm text-slate-500 mb-6">
                    Fill out the form below for immediate sandbox credentials or curriculum orientation.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Name"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-[#D4D4CE] bg-[#FAFAF8] text-slate-900 text-sm focus:outline-none focus:border-[#181A1F] focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Professional / University Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. a.@Email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-[#D4D4CE] bg-[#FAFAF8] text-slate-900 text-sm focus:outline-none focus:border-[#181A1F] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Target Examination Track
                    </label>
                    <select
                      value={formData.certification}
                      onChange={(e) => setFormData({ ...formData, certification: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-[#D4D4CE] bg-[#FAFAF8] text-slate-900 text-sm focus:outline-none focus:border-[#181A1F] focus:bg-white transition-all"
                    >
                      <option value="CFA Level I">CFA® Level I (Nov 2026 / Feb 2027)</option>
                      <option value="CFA Level II">CFA® Level II (Aug 2026 / Nov 2026)</option>
                      <option value="CFA Level III">CFA® Level III (Aug 2026)</option>
                      <option value="FRM Part I">FRM® Part I (Nov 2026)</option>
                      <option value="FRM Part II">FRM® Part II (Nov 2026)</option>
                      <option value="Quantitative IT / CA Final">Quantitative Finance & CA Final Track</option>
                      <option value="Institutional University Lab License">Institutional / University Lab License</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Organization / University (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Nomura / Columbia Business School"
                      value={formData.institution}
                      onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-[#D4D4CE] bg-[#FAFAF8] text-slate-900 text-sm focus:outline-none focus:border-[#181A1F] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Consultation Topic / Background
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Tell us about your preparation window or institutional requirements..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-[#D4D4CE] bg-[#FAFAF8] text-slate-900 text-sm focus:outline-none focus:border-[#181A1F] focus:bg-white transition-all resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3.5 px-6 rounded-xl bg-[#181A1F] hover:bg-[#282C36] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all duration-200"
                  >
                    <span>Submit Academic Inquiry</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                  <p className="text-[11px] text-center text-slate-500 mt-2 font-mono">
                    Protected by 256-bit SSL encryption. We never share candidate credentials with third parties.
                  </p>
                </div>
              </form>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
