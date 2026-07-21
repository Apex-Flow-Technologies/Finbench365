import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#121419] text-[#FBFBF9] py-16 px-6 font-sans selection:bg-amber-500/30">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors mb-12 group">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-bold tracking-wide">Back to Home</span>
        </Link>
        
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Privacy Policy (DPDP Compliant)</h1>
          <p className="text-slate-400 text-lg">Effective Date: July 2026</p>
        </div>

        <div className="space-y-12 text-slate-300 leading-relaxed text-lg">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4.1 Who We Are</h2>
            <p className="mb-4">
              This Privacy Policy explains how FinExamsEdge EdTech Private Limited ("FinExamsEdge", "we"), the Data Fiduciary for the purposes of the Digital Personal Data Protection Act, 2023 ("DPDP Act"), collects, uses, stores, shares and protects your personal data when you use FinExamsEdge.com and related services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4.2 Personal Data We Collect</h2>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Account data you provide at registration:</strong> name, email address, mobile number, password (stored only as a secure hash), and your target examination(s);</li>
              <li><strong>Payment data:</strong> billing name and address, transaction ID and payment status. Card, UPI and banking details are collected and processed directly by our payment gateway (Razorpay); we never receive or store your full card number or banking credentials;</li>
              <li><strong>Usage data:</strong> your test attempts, answers, scores, timing data and generated reports;</li>
              <li><strong>Technical data:</strong> device type, browser, IP address, and access logs, collected through standard server logging for security and fraud prevention. We do not use cookies or tracking technologies;</li>
              <li><strong>Communications:</strong> emails, feedback, error reports and support messages you send us.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4.3 Purposes and Legal Basis</h2>
            <p className="mb-4">
              We process your personal data on the basis of your consent, given when you tick the consent box at signup, and for the following specified purposes only: (a) creating and operating your account; (b) delivering mock tests, saving your progress, and generating performance reports; (c) processing payments and issuing invoices; (d) providing customer support and resolving grievances; (e) sending service messages such as OTPs, receipts, expiry reminders and material policy updates; (f) sending promotional messages about FinExamsEdge only if you have opted in, with an unsubscribe option in every such message; and (g) securing the platform, preventing fraud and abuse, and complying with law. We do not use your data for any purpose incompatible with these.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4.4 Consent and Withdrawal</h2>
            <p className="mb-4">
              Your consent is free, specific, informed and unambiguous, and you may withdraw it at any time by writing to privacy@finexamsedge.com or using your account settings. Withdrawal is as easy as giving consent. On withdrawal we will stop the related processing; note that some processing (e.g., retaining invoices) may continue where required by law, and withdrawal of consent essential to the service may mean we can no longer provide it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4.5 Sharing of Personal Data</h2>
            <p className="mb-4">
              We do not sell, rent or lease your personal data. We share it only with: (a) our payment gateway, to process your payment; (b) service providers (Data Processors) who host our infrastructure, deliver email/SMS, or provide analytics, each bound by contract to process data only on our instructions with appropriate safeguards; and (c) government or judicial authorities where disclosure is required by law. If FinExamsEdge’s business is transferred or merged, your data may be transferred as part of that transaction subject to this Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4.6 No Cookies</h2>
            <p className="mb-4">
              FinExamsEdge does not use cookies. We do not place analytics, advertising, tracking or any other cookies on your device, and we do not use third-party trackers or behavioural profiling. Keeping you logged in and preserving your test session (including timer state on disconnection) is handled through secure server-side sessions and authentication tokens rather than cookies. Because no cookies are used, no cookie banner or cookie consent is required. If we ever introduce cookies in future, we will update this Policy, display a consent notice before any non-essential cookie is set, and seek fresh consent where the law requires it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4.7 Data Security</h2>
            <p className="mb-4">
              We use reasonable security safeguards appropriate to the nature of the data, including encryption in transit (TLS), password hashing, role-based access controls, server-authoritative test-session handling, logging and monitoring, and automated backups. In the event of a personal data breach, we will notify the Data Protection Board of India and affected users as required by the DPDP Act.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4.8 Data Retention and Deletion</h2>
            <p className="mb-4">
              We retain your personal data while your account is active and for 24 months thereafter, after which it is deleted or irreversibly anonymised — except data we must retain longer under law (for example, invoices and financial records under tax legislation, retained for 8 years). You may request deletion of your account at any time; we will honour it within 30 days subject to those legal retention duties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4.9 Your Rights as a Data Principal</h2>
            <ol className="list-decimal pl-6 space-y-2 mb-4">
              <li><strong>Right to access:</strong> obtain a summary of your personal data we hold and the processing activities and recipients involved.</li>
              <li><strong>Right to correction and erasure:</strong> have inaccurate or incomplete data corrected, and data that is no longer necessary erased.</li>
              <li><strong>Right of grievance redressal:</strong> raise a complaint with our Grievance Officer and receive a response within the timelines stated below.</li>
              <li><strong>Right to nominate:</strong> nominate a person to exercise your rights in the event of your death or incapacity.</li>
            </ol>
            <p className="mb-4">
              To exercise any right, write to the Grievance Officer below. Exercising your rights is free of charge. If you are not satisfied with our response, you may complain to the Data Protection Board of India.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4.10 Children</h2>
            <p className="mb-4">
              FinExamsEdge is directed at adults preparing for professional examinations. Users under 18 may use the platform only with verifiable parental consent as required by the DPDP Act, and we do not knowingly process children’s data for tracking, behavioural monitoring or targeted advertising.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4.11 Grievance Officer</h2>
            <p className="mb-4">
              <strong>Grievance Officer:</strong> [Name]<br />
              <strong>Email:</strong> grievance@finexamsedge.com<br />
              <strong>Phone:</strong> [Number]<br />
              <strong>Address:</strong> [Registered Address, Chennai, Tamil Nadu]<br />
              We acknowledge privacy grievances within 48 hours and resolve them within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4.12 Changes to this Policy</h2>
            <p className="mb-4">
              We may update this Policy from time to time. Material changes will be notified by email or in-app notice with the new effective date; where the change involves new purposes of processing, we will seek fresh consent as required by law.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
