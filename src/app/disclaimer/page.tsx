import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-[#121419] text-[#FBFBF9] py-16 px-6 font-sans selection:bg-amber-500/30">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors mb-12 group">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-bold tracking-wide">Back to Home</span>
        </Link>
        
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Disclaimer</h1>
          <p className="text-slate-400 text-lg">Last updated: July 2026</p>
        </div>

        <div className="space-y-12 text-slate-300 leading-relaxed text-lg">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2.1 Independence from NISM, SEBI and Other Bodies</h2>
            <p className="mb-4">
              FinExamsEdge is an independent, privately operated exam-preparation platform run by FinExamsEdge EdTech Private Limited. FinExamsEdge is not affiliated with, endorsed by, sponsored by, licensed by, or in any other way officially connected with the National Institute of Securities Markets (NISM), the Securities and Exchange Board of India (SEBI), any stock exchange, or any other regulator, examination authority, or certification body in India or elsewhere. Nothing on this website should be understood as suggesting such a connection.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2.2 Trademarks</h2>
            <p className="mb-4">
              "NISM", "SEBI" and all other examination, institute, exchange and certification names, marks and logos referred to on this website are trademarks or registered trademarks of their respective owners. They appear on FinExamsEdge only to identify and describe the examinations for which our practice material is designed. Their use does not imply, and must not be taken to imply, any endorsement of FinExamsEdge by their owners.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2.3 Our Questions Are Original — Not Real Exam Content</h2>
            <p className="mb-4">
              Every practice question, mock test, answer and explanation on FinExamsEdge is original content created by our team to simulate the format, difficulty, syllabus coverage and rules (including negative marking, duration and passing thresholds) of the corresponding official examination. Our questions are NOT actual questions from any live or past NISM examination. We have no access to live examination content, question banks or papers of NISM or any other examination body, and we make no attempt to obtain such access.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2.4 Purpose of the Mock Tests</h2>
            <p className="mb-4">
              The purpose of FinExamsEdge mock tests — free demos and paid tests alike — is to help you assess your own preparedness for the official examination conducted by the relevant authority. A FinExamsEdge mock test is a practice exercise only. It is not the official examination, is not conducted on behalf of any examination body, and passing a FinExamsEdge mock test does not certify you, qualify you, or confer any credential, licence or eligibility of any kind. Only the official examination body (for example, NISM) can issue certification.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2.5 No Guarantee of Results</h2>
            <p className="mb-4">
              While our content is designed and reviewed with care, FinExamsEdge gives no guarantee, warranty or assurance that a user who performs well on our mock tests will pass the actual examination, or achieve any particular score, ranking, eligibility, employment or professional outcome. The questions and pattern of the actual examination may differ from our practice tests. Your result in the real examination depends on many factors outside our control.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2.6 Not a Substitute for Official Material</h2>
            <p className="mb-4">
              FinExamsEdge content supports your preparation but is not a substitute for the official workbooks, syllabus and announcements published by the examination body. You are responsible for keeping yourself updated on changes to the official syllabus, exam pattern, eligibility rules, registration procedure and fees. For official information on NISM examinations, visit nism.ac.in.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2.7 Not Financial, Investment or Professional Advice</h2>
            <p className="mb-4">
              FinExamsEdge deals with securities-market subject matter because that is what the examinations cover. However, everything on this platform — questions, answers, explanations, notes and blog content — is provided strictly for examination study and general education. It does not constitute investment advice, financial advice, legal advice, tax advice, or professional advice of any kind, and it is not a recommendation to buy, sell or hold any security or financial product. Do not make financial decisions based on FinExamsEdge content; consult a SEBI-registered adviser or other qualified professional instead.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2.8 Accuracy — Content Provided "As Is"</h2>
            <p className="mb-4">
              All content on FinExamsEdge is provided on an "as is" and "as available" basis, without warranties of any kind, express or implied, including any implied warranty of accuracy, completeness, currency, reliability, merchantability or fitness for a particular purpose. Despite our review process, individual questions, answers or explanations may contain errors, typographical mistakes or outdated references, and content may be modified, corrected or removed at any time without notice. If you believe an answer is incorrect, please report it through the in-test feedback option or write to support@finexamsedge.com; we will review and correct verified errors, but we accept no liability arising from reliance on any individual question or answer.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2.9 Limitation of Liability</h2>
            <p className="mb-4">
              To the fullest extent permitted by applicable law, FinExamsEdge EdTech Private Limited, its proprietor/directors, employees and partners shall not be liable for any indirect, incidental, special, consequential or punitive damages, or for loss of profits, opportunity, data or goodwill, arising out of or in connection with your use of (or inability to use) FinExamsEdge — including, without limitation, failure in the actual examination, errors or omissions in content, interruption or unavailability of the service, or loss of test progress due to technical failure. In all cases, our total aggregate liability for any claim arising from your use of FinExamsEdge shall not exceed the amount actually paid by you to FinExamsEdge for the plan giving rise to the claim during the six (6) months preceding the event. Nothing in this section limits liability that cannot be limited under Indian law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2.10 Service Availability and Technical Risk</h2>
            <p className="mb-4">
              Online services can be affected by outages, maintenance, network failures, or malicious code. We work to keep FinExamsEdge secure and available, and we save your in-test progress so that a disconnection or refresh does not cost you your answers or remaining time. However, we do not warrant uninterrupted or error-free operation. Where a verified technical failure on our side prevents you from using your plan for more than 24 hours, our Refund & Cancellation Policy provides for plan extension or proportional refund.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2.11 Third-Party Links</h2>
            <p className="mb-4">
              FinExamsEdge may link to third-party websites (for example, nism.ac.in for official registration, or our payment gateway). Such links are provided only for your convenience. We do not control, monitor or endorse third-party websites and are not responsible for their content, accuracy, security or privacy practices. Accessing them is at your own risk, and any information you provide to a third-party site (including payment details entered on the payment gateway’s pages) is governed by that site’s own terms and privacy policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2.12 Intellectual Property and Anti-Scraping</h2>
            <p className="mb-4">
              All content on FinExamsEdge — questions, answers, explanations, mock-test structures, reports, text, graphics, software and design — is the copyright and property of FinExamsEdge EdTech Private Limited or its licensors. You receive only a limited, personal, non-transferable, revocable licence to use the content for your own exam preparation. You must not copy, reproduce, screenshot for redistribution, scrape, crawl, data-mine, decompile, publish, sell, share, or otherwise redistribute any FinExamsEdge content, and you must not use it to create or contribute to any competing product, question bank, course, app or dataset (including for training machine-learning models). Violation will result in immediate termination of access without refund and may result in legal action under applicable copyright and information-technology laws.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
