import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function RefundsPage() {
  return (
    <div className="min-h-screen bg-[#121419] text-[#FBFBF9] py-16 px-6 font-sans selection:bg-amber-500/30">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors mb-12 group">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-bold tracking-wide">Back to Home</span>
        </Link>
        
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Refund & Cancellation Policy</h1>
          <p className="text-slate-400 text-lg">Last updated: July 2026</p>
        </div>

        <div className="space-y-12 text-slate-300 leading-relaxed text-lg">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5.1 Nature of the Product</h2>
            <p className="mb-4">
              FinExamsEdge plans are digital content with immediate access: your plan activates on successful payment (or manual activation) and its time-limited validity begins the same day. Before purchasing, you can evaluate the platform through the free demo test, and the features, price and validity of each tier are clearly displayed on the Pricing page. Please choose your plan carefully.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5.2 All Sales Are Final — No Refunds</h2>
            <p className="mb-4">
              Except as stated in Section 5.3, all purchases on FinExamsEdge are final, non-refundable and non-transferable. In particular, no refund, credit or exchange is available for:
            </p>
            <ol className="list-decimal pl-6 space-y-2 mb-4">
              <li>change of mind, wrong plan selected, or dissatisfaction with the content or your mock-test scores;</li>
              <li>unused tests, attempts or days remaining when your plan expires — these lapse and carry no cash value;</li>
              <li>failure to pass, or dissatisfaction with your result in, the actual examination (see the Disclaimer — we guarantee no exam outcome);</li>
              <li>temporary interruptions or scheduled maintenance; where a verified technical fault on our side prevents access for more than 24 continuous hours, your sole remedy is extension of your plan by the number of days lost;</li>
              <li>accounts suspended or terminated for breach of the Terms of Service (e.g., content scraping, account sharing, timer tampering);</li>
              <li>plans bought under a free or promotional offer, to the extent of the free or discounted component.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5.3 Sole Exception — Payment Without Delivery</h2>
            <p className="mb-4">
              If your payment is successfully charged but the corresponding plan is never activated on your account, and our support team is unable to activate it within 48 hours of your report, the amount charged will be refunded to your original payment method. Verified duplicate charges for the same plan are likewise reversed. These are the only circumstances in which money is returned, and they exist because the service was never delivered. Refunds under this section are processed within 7–10 business days of verification; gateway and bank timelines are additional.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5.4 No Cancellation Needed</h2>
            <p className="mb-4">
              Plans are one-time purchases, not auto-renewing subscriptions. There is no recurring charge to cancel: your access simply lapses automatically at the end of the purchased validity period. If auto-renewal is ever introduced, it will be strictly opt-in with advance notice before each charge and a one-click cancellation option.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5.5 Questions</h2>
            <p className="mb-4">
              For payment issues (failed activation, duplicate charge) email <strong>support@finexamsedge.com</strong> from your registered email with your payment ID. We respond within 48 hours.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
