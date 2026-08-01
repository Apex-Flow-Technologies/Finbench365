import { Resend } from 'resend';

/**
 * Sender address. Resend's shared `onboarding@resend.dev` only delivers to the
 * address that owns the Resend account — using it in production means every
 * customer invoice is rejected and silently lost. Set RESEND_FROM_EMAIL to an
 * address on a domain verified in Resend (Domains -> Add Domain -> DNS records).
 */
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const FROM_NAME = process.env.RESEND_FROM_NAME || 'MyExams365';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@myexams365.com';

// Optional legal-entity details. An Indian tax invoice must carry the seller's
// registered name and GSTIN to be claimable by the buyer, so they are rendered
// when configured and omitted rather than faked when not.
const LEGAL_NAME = process.env.INVOICE_LEGAL_NAME || '';
const LEGAL_GSTIN = process.env.INVOICE_GSTIN || '';
const LEGAL_ADDRESS = process.env.INVOICE_ADDRESS || '';

const inr = (n: number) =>
  `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export interface InvoiceEmailParams {
  email: string;
  name: string;
  courseTitle: string;
  planName: string;
  orderId: string;
  amount: number;    // base price, excl. GST
  gstAmount: number;
  total: number;     // amount actually paid
}

export async function sendInvoiceEmail(params: InvoiceEmailParams) {
  const { email, name, courseTitle, planName, orderId, amount, gstAmount, total } = params;

  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set. Skipping email dispatch.');
    return { skipped: true as const };
  }

  if (FROM_EMAIL === 'onboarding@resend.dev') {
    console.warn(
      '[email] Sending from onboarding@resend.dev — Resend only delivers this to the ' +
      'account owner, so customer invoices will NOT arrive. Set RESEND_FROM_EMAIL to a verified domain.'
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const issued = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // Email clients (Gmail, Outlook) do not support flexbox or grid — the layout
  // below is deliberately table-based with inline styles for that reason.
  const row = (label: string, value: string, bold = false) => `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:${bold ? '#111827' : '#4b5563'};${bold ? 'font-weight:700;' : ''}">${label}</td>
      <td align="right" style="padding:8px 0;font-size:14px;color:${bold ? '#111827' : '#4b5563'};${bold ? 'font-weight:700;' : ''}">${value}</td>
    </tr>`;

  const legalBlock = (LEGAL_NAME || LEGAL_GSTIN || LEGAL_ADDRESS) ? `
    <tr><td style="padding:18px 28px 0;font-size:11px;line-height:17px;color:#9ca3af;border-top:1px solid #e5e7eb;">
      ${LEGAL_NAME ? `<strong style="color:#6b7280;">${esc(LEGAL_NAME)}</strong><br/>` : ''}
      ${LEGAL_ADDRESS ? `${esc(LEGAL_ADDRESS)}<br/>` : ''}
      ${LEGAL_GSTIN ? `GSTIN: ${esc(LEGAL_GSTIN)}` : ''}
    </td></tr>` : '';

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

        <tr><td style="background:#12141A;padding:24px 28px;">
          <span style="color:#ffffff;font-size:19px;font-weight:700;">MyExams365</span>
          <span style="color:#F59E0B;font-size:19px;font-weight:700;">.</span>
          <div style="color:#9AA3B2;font-size:11px;letter-spacing:.5px;margin-top:2px;">BY MENTRAEDGE</div>
        </td></tr>

        <tr><td style="padding:28px 28px 6px;">
          <h1 style="margin:0 0 6px;font-size:20px;color:#111827;">Enrolment confirmed</h1>
          <p style="margin:0;font-size:14px;line-height:22px;color:#4b5563;">
            Hi ${esc(name)}, your access to <strong style="color:#111827;">${esc(courseTitle)}</strong> is now active.
            This email is also your tax invoice — keep it for your records.
          </p>
        </td></tr>

        <tr><td style="padding:20px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
            <tr><td style="padding:16px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${row('Invoice date', esc(issued))}
                ${row('Order ID', esc(orderId))}
                ${row('Plan', esc(planName))}
                <tr><td colspan="2" style="border-top:1px solid #e5e7eb;height:1px;line-height:1px;">&nbsp;</td></tr>
                ${row('Base price', inr(amount))}
                ${row('GST @ 18%', inr(gstAmount))}
                <tr><td colspan="2" style="border-top:2px solid #e5e7eb;height:1px;line-height:1px;">&nbsp;</td></tr>
                ${row('Total paid', inr(total), true)}
              </table>
            </td></tr>
          </table>
        </td></tr>

        <tr><td align="center" style="padding:24px 28px 6px;">
          <a href="https://myexams365.com/dashboard"
             style="display:inline-block;background:#F59E0B;color:#12141A;text-decoration:none;font-weight:700;font-size:14px;padding:13px 30px;border-radius:10px;">
            Go to your dashboard
          </a>
        </td></tr>

        <tr><td style="padding:16px 28px 22px;font-size:12px;line-height:19px;color:#6b7280;">
          Questions about this invoice? Reply to this email or contact
          <a href="mailto:${esc(SUPPORT_EMAIL)}" style="color:#B4780A;">${esc(SUPPORT_EMAIL)}</a>.
        </td></tr>

        ${legalBlock}

        <tr><td style="padding:16px 28px 24px;font-size:11px;color:#9ca3af;">
          You received this because a purchase was made with this email address on myexams365.com.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Enrolment confirmed — MyExams365`, '',
    `Hi ${name},`,
    `Your access to ${courseTitle} is now active. This email is also your tax invoice.`, '',
    `Invoice date: ${issued}`,
    `Order ID:     ${orderId}`,
    `Plan:         ${planName}`,
    `Base price:   ${inr(amount)}`,
    `GST @ 18%:    ${inr(gstAmount)}`,
    `Total paid:   ${inr(total)}`, '',
    `Dashboard: https://myexams365.com/dashboard`,
    `Support:   ${SUPPORT_EMAIL}`,
    LEGAL_NAME ? `\n${LEGAL_NAME}` : '',
    LEGAL_GSTIN ? `GSTIN: ${LEGAL_GSTIN}` : '',
  ].filter(Boolean).join('\n');

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: email,
    replyTo: SUPPORT_EMAIL,
    subject: `Invoice ${orderId} — enrolment confirmed for ${courseTitle}`,
    html,
    text,
  });

  if (error) {
    // Surfaced to the caller, which logs it without failing the entitlement
    // grant — a delivery problem must never cost someone the access they paid for.
    console.error('Resend rejected the invoice email:', error);
    throw new Error(`Resend: ${error.message ?? 'send failed'}`);
  }

  console.log(`Invoice email queued (${data?.id}) for order ${orderId}`);
  return data;
}
