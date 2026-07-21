import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#121419] text-[#FBFBF9] py-16 px-6 font-sans selection:bg-amber-500/30">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors mb-12 group">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-bold tracking-wide">Back to Home</span>
        </Link>
        
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Terms of Service</h1>
          <p className="text-slate-400 text-lg">Last updated: July 2026</p>
        </div>

        <div className="space-y-12 text-slate-300 leading-relaxed text-lg">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.1 Acceptance of These Terms</h2>
            <p className="mb-4">
              These Terms of Service ("Terms") are an electronic agreement between you and FinExamsEdge EdTech Private Limited ("FinExamsEdge", "we", "us"). By ticking the box marked "I agree to the Terms of Service and Privacy Policy" at registration, or by ticking the corresponding box at checkout, or by otherwise using the platform, you confirm that you have read, understood and agree to be bound by these Terms, the Privacy Policy, the Disclaimer and the Refund & Cancellation Policy, which together form the entire agreement between you and us and supersede all prior understandings on this subject. If you do not agree, do not use FinExamsEdge.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.2 Eligibility</h2>
            <p className="mb-4">
              You must be at least 18 years of age and competent to contract under the Indian Contract Act, 1872 to purchase a plan. If you are under 18, you may use FinExamsEdge only with the involvement and consent of a parent or legal guardian, who accepts these Terms on your behalf and is responsible for your use and any purchase.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.3 Your Account and Registration Data</h2>
            <p className="mb-4">
              When registering you agree to: (a) provide accurate, current and complete information (name, email, mobile number, target examination); (b) keep that information updated; (c) keep your password confidential and not share your login credentials with anyone; and (d) accept responsibility for all activity that occurs under your account. Accounts are personal to you and are non-transferable. One account per person; creating multiple accounts to abuse free demos or offers is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.4 Account Security and Unauthorised Use</h2>
            <p className="mb-4">
              Notify us immediately at support@finexamsedge.com if you become aware of any breach of security or unauthorised use of your account. We are not liable for loss caused by unauthorised use of your account arising from your failure to keep credentials secure, and you may be liable for losses caused to us or to others through such use. We may suspend an account pending investigation of suspected unauthorised or fraudulent use.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.5 Plans, Tiers and Time-Limited Access</h2>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>FinExamsEdge access is sold as time-limited plans (for example: 10-day, 1-month, and extended tiers). The features included in each tier are stated on the Pricing page at the time of purchase.</li>
              <li>Your access period begins on activation (immediately upon successful payment, or upon manual activation by our team where applicable) and expires automatically at the end of the purchased period, without further notice.</li>
              <li>Unused tests, attempts or credits lapse on expiry of the plan and carry no cash value. Any extension of validity is at FinExamsEdge’s sole discretion.</li>
              <li>We may modify tier features prospectively; changes will not reduce the features of a plan you have already purchased during its paid validity.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.6 Acceptable Use and Exam Integrity</h2>
            <p className="mb-4">You agree NOT to:</p>
            <ol className="list-decimal pl-6 space-y-2 mb-4">
              <li>copy, scrape, crawl, data-mine, record, screenshot for redistribution, or run automated queries against the platform, or use any content to build or assist a competing product, question bank or dataset;</li>
              <li>attempt to tamper with, manipulate or circumvent test timers, scoring, negative marking, access controls, or any security or entitlement mechanism;</li>
              <li>share, resell, sublicense or transfer your account, plan or content to any other person;</li>
              <li>upload or transmit unlawful, defamatory, obscene, discriminatory or infringing material, or send spam or unsolicited promotions through any platform feature;</li>
              <li>impersonate any person, misrepresent your identity or affiliation, or submit another person’s personal information without authority;</li>
              <li>introduce viruses or malicious code, or take any action that imposes an unreasonable load on our infrastructure.</li>
            </ol>
            <p>Breach of this section entitles us to suspend or terminate your account immediately, without refund, in addition to any other remedy available in law.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.7 Intellectual Property</h2>
            <p className="mb-4">
              The FinExamsEdge name, logo, platform, and all content are owned by FinExamsEdge EdTech Private Limited or its licensors, as detailed in Section 2.12 of the Disclaimer, which is incorporated into these Terms. You may not use the FinExamsEdge name or marks in any advertising or publicity without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.8 Feedback and Submissions</h2>
            <p className="mb-4">
              If you send us suggestions, error reports, ideas or other feedback about the platform, you grant us a perpetual, irrevocable, royalty-free right to use them to operate and improve FinExamsEdge, without any obligation of confidentiality or compensation. This clause does not apply to your personal data, which is governed by the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.9 Payments</h2>
            <p className="mb-4">
              Prices are displayed in Indian Rupees on the Pricing page, Payments are processed by third-party payment gateways (for example, Razorpay); we do not store your full card or banking details. Access is granted on receipt of successful payment confirmation from the gateway. We are not responsible for declines, delays or errors occurring within the gateway or your bank, though we will assist in resolving them.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.10 Changes to the Service and to These Terms</h2>
            <p className="mb-4">
              We may add, modify or discontinue features of FinExamsEdge at any time. We may also revise these Terms and our policies from time to time. For material changes we will notify registered users by email or an in-app notice, and the updated version will state its effective date. Your continued use of FinExamsEdge after the effective date constitutes acceptance of the revised Terms; if you do not accept them, you must stop using the platform (your refund rights, if any, are as per the Refund & Cancellation Policy).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.11 Suspension and Termination</h2>
            <p className="mb-4">
              You may stop using FinExamsEdge and request account deletion at any time (see Privacy Policy for data deletion). We may suspend or terminate your access, with or without notice, if you materially breach these Terms, misuse the platform, or where required by law. Termination for your breach does not entitle you to any refund. Sections which by their nature should survive termination (intellectual property, limitation of liability, indemnity, governing law) survive.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.12 Indemnity</h2>
            <p className="mb-4">
              You agree to indemnify and hold harmless FinExamsEdge EdTech Private Limited, its proprietor/directors, employees and partners from and against claims, damages, losses, liabilities and expenses (including reasonable legal fees) arising from: (a) your breach of these Terms or any policy; (b) your violation of any law or of any third party’s rights, including intellectual-property and privacy rights; or (c) any content or information you submit on the platform. This obligation survives termination of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.13 Limitation of Liability</h2>
            <p className="mb-4">
              The Limitation of Liability set out in Section 2.9 of the Disclaimer applies to these Terms and to your entire use of FinExamsEdge, and is incorporated here by reference.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.14 Severability, Waiver and Third Parties</h2>
            <p className="mb-4">
              If any provision of these Terms is held invalid or unenforceable in any jurisdiction, the remaining provisions remain in full force. Our failure to enforce any provision is not a waiver of it. These Terms do not confer any rights or remedies on any third party.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.15 Governing Law and Jurisdiction</h2>
            <p className="mb-4">
              These Terms and all policies are governed by the laws of India. Subject to any mandatory consumer-protection forum available to you, the courts at Chennai, Tamil Nadu shall have exclusive jurisdiction over all disputes arising out of or relating to FinExamsEdge.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3.16 Grievances and Contact</h2>
            <p className="mb-4">
              For complaints or questions about these Terms, contact our Grievance Officer: <br />
              <strong>[Grievance Officer Name]</strong> <br />
              Email: grievance@finexamsedge.com <br />
              Phone: [Phone Number] <br />
              Address: [Registered Address, Chennai, Tamil Nadu] <br />
              We acknowledge consumer grievances within 48 hours and aim to resolve them within 30 days, in line with the Consumer Protection (E-Commerce) Rules, 2020.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
