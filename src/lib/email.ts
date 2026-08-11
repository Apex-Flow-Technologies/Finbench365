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

/**
 * True when we are falling back to Resend's shared sandbox sender.
 *
 * That address only delivers to the mailbox that owns the Resend account, so
 * with it configured every mail to a real candidate is rejected. This is the
 * single most common cause of "the verification code never arrived", and the
 * rejection Resend returns says nothing about the sender being the reason —
 * which is why failures are re-thrown below with that context attached.
 */
const SENDER_IS_SANDBOX = FROM_EMAIL === 'onboarding@resend.dev';

/** Raised when a send failed because of OUR configuration, not the recipient. */
export class EmailSenderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailSenderNotConfiguredError';
  }
}

/**
 * Turns a Resend rejection into an error that names the most likely cause.
 *
 * Deliberately leads with what Resend actually said, and only then offers a
 * likely cause. An earlier version asserted "RESEND_FROM_EMAIL is not set" for
 * every failure that happened while the sandbox sender was active — so a
 * rejected API key was reported as a sender problem, and the real fault (a 401)
 * stayed hidden behind a confident, wrong explanation.
 */
function sendFailure(detail: string): Error {
  const text = detail.toLowerCase();
  const isAuth =
    text.includes('api key') || text.includes('api_key') ||
    text.includes('unauthorized') || text.includes('invalid token') ||
    text.includes('restricted');

  if (isAuth) {
    return new EmailSenderNotConfiguredError(
      `Resend rejected our credentials: ${detail}\n` +
      `RESEND_API_KEY is missing, revoked or from another account. Create a fresh key ` +
      `in Resend (API Keys -> Create API Key) and update it in the environment.`,
    );
  }

  if (SENDER_IS_SANDBOX) {
    return new EmailSenderNotConfiguredError(
      `Resend rejected the message: ${detail}\n` +
      `RESEND_FROM_EMAIL is not set, so the shared sandbox sender ` +
      `(onboarding@resend.dev) was used — Resend only delivers that to the account ` +
      `owner's own address. Verify a domain in Resend (Domains -> Add Domain) and set ` +
      `RESEND_FROM_EMAIL to an address on it.`,
    );
  }

  // A genuine per-message failure: bad recipient, blocked content, quota.
  return new Error(`Resend: ${detail}`);
}

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

/**
 * Signup verification code. Sent before any account exists, so it must not
 * imply one does — if this lands with someone who never asked to register, the
 * correct action for them is to ignore it, and the copy says so.
 */
export async function sendOtpEmail({ email, code, minutes }: {
  email: string; code: string; minutes: number;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set. Skipping OTP dispatch.');
    return { skipped: true as const };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr><td style="background:#12141A;padding:22px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;">MyExams365</span><span style="color:#F59E0B;font-size:18px;font-weight:700;">.</span>
        </td></tr>
        <tr><td style="padding:28px 28px 8px;">
          <h1 style="margin:0 0 8px;font-size:19px;color:#111827;">Confirm your email address</h1>
          <p style="margin:0;font-size:14px;line-height:22px;color:#4b5563;">
            Enter this code to finish creating your MyExams365 account.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:22px 28px;">
          <div style="display:inline-block;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 30px;">
            <span style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:9px;color:#111827;">${esc(code)}</span>
          </div>
        </td></tr>
        <tr><td style="padding:0 28px 22px;font-size:13px;line-height:21px;color:#6b7280;">
          This code expires in ${minutes} minutes and can only be used once.<br/>
          <strong style="color:#374151;">Didn't request this?</strong> You can safely ignore this email — no account has been created, and nobody can register with your address without this code.
        </td></tr>
        <tr><td style="padding:14px 28px 22px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
          Never share this code. MyExams365 staff will never ask you for it.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    'Confirm your email address — MyExams365', '',
    `Your verification code is: ${code}`, '',
    `It expires in ${minutes} minutes and can only be used once.`,
    "Didn't request this? Ignore this email — no account has been created.",
    'Never share this code. MyExams365 staff will never ask you for it.',
  ].join('\n');

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: email,
    replyTo: SUPPORT_EMAIL,
    subject: `${code} is your MyExams365 verification code`,
    html,
    text,
  });

  if (error) {
    console.error('Resend rejected the OTP email:', error);
    throw sendFailure(error.message ?? 'send failed');
  }
  return data;
}

/**
 * Password reset link, sent through Resend rather than Firebase's own mailer.
 *
 * Firebase sends from noreply@<project>.firebaseapp.com, which has no SPF/DKIM
 * alignment with our domain — Gmail routinely files those as spam, which for a
 * password reset means the user is simply locked out. Sending it ourselves from
 * the verified myexams365.com domain keeps it aligned, branded and deliverable.
 */
export async function sendPasswordResetMail({ email, link }: { email: string; link: string }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set. Skipping password reset dispatch.');
    return { skipped: true as const };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr><td style="background:#12141A;padding:22px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;">MyExams365</span><span style="color:#F59E0B;font-size:18px;font-weight:700;">.</span>
        </td></tr>
        <tr><td style="padding:28px 28px 6px;">
          <h1 style="margin:0 0 8px;font-size:19px;color:#111827;">Reset your password</h1>
          <p style="margin:0;font-size:14px;line-height:22px;color:#4b5563;">
            Click the button below to choose a new password for your MyExams365 account.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:24px 28px 8px;">
          <a href="${link}" style="display:inline-block;background:#F59E0B;color:#12141A;text-decoration:none;font-weight:700;font-size:14px;padding:13px 34px;border-radius:10px;">
            Choose a new password
          </a>
        </td></tr>
        <tr><td style="padding:12px 28px 20px;font-size:12px;line-height:19px;color:#6b7280;">
          This link expires in about an hour and can only be used once.<br/>
          <strong style="color:#374151;">Didn't request this?</strong> You can safely ignore this email — your password will not change unless you use the link above.
        </td></tr>
        <tr><td style="padding:14px 28px 22px;border-top:1px solid #e5e7eb;font-size:11px;line-height:17px;color:#9ca3af;word-break:break-all;">
          If the button doesn't work, paste this into your browser:<br/>${link}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    'Reset your MyExams365 password', '',
    'Use this link to choose a new password:', link, '',
    'The link expires in about an hour and can only be used once.',
    "Didn't request this? Ignore this email — your password will not change.",
  ].join('\n');

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: email,
    replyTo: SUPPORT_EMAIL,
    subject: 'Reset your MyExams365 password',
    html,
    text,
  });

  if (error) {
    console.error('Resend rejected the password reset email:', error);
    throw sendFailure(error.message ?? 'send failed');
  }
  return data;
}

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

  // A fully-discounted enrolment is not a taxable supply, so it must not be
  // presented as a tax invoice — it is an access confirmation.
  const isFree = total <= 0;

  // Email clients (Gmail, Outlook) do not support flexbox or grid — the layout
  // below is deliberately table-based with inline styles for that reason.
  const row = (label: string, value: string, bold = false) => `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:${bold ? '#111827' : '#4b5563'};${bold ? 'font-weight:700;' : ''}">${label}</td>
      <td align="right" style="padding:8px 0;font-size:14px;color:${bold ? '#111827' : '#4b5563'};${bold ? 'font-weight:700;' : ''}">${value}</td>
    </tr>`;

  const legalBlock = (!isFree && (LEGAL_NAME || LEGAL_GSTIN || LEGAL_ADDRESS)) ? `
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
            ${isFree ? 'Your access was granted in full using a discount code.' : 'This email is also your tax invoice — keep it for your records.'}
          </p>
        </td></tr>

        <tr><td style="padding:20px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
            <tr><td style="padding:16px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${row(isFree ? 'Date' : 'Invoice date', esc(issued))}
                ${row('Order ID', esc(orderId))}
                ${row('Plan', esc(planName))}
                <tr><td colspan="2" style="border-top:1px solid #e5e7eb;height:1px;line-height:1px;">&nbsp;</td></tr>
                ${row('Base price', inr(amount))}
                ${row('GST @ 18%', inr(gstAmount))}
                <tr><td colspan="2" style="border-top:2px solid #e5e7eb;height:1px;line-height:1px;">&nbsp;</td></tr>
                ${row(isFree ? 'Total' : 'Total paid', inr(total), true)}
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
    isFree
      ? `Your access to ${courseTitle} is now active (granted in full using a discount code).`
      : `Your access to ${courseTitle} is now active. This email is also your tax invoice.`, '',
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

  // A blind copy of every invoice, so the business holds the same document the
  // customer received rather than only a row in a database. Blind, not a second
  // "to", because the customer must not see an internal address on their tax
  // invoice. Set INVOICE_BCC_EMAIL to switch it on; unset, nothing changes.
  const bcc = process.env.INVOICE_BCC_EMAIL?.trim();

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: email,
    ...(bcc ? { bcc } : {}),
    replyTo: SUPPORT_EMAIL,
    subject: isFree
      ? `Enrolment confirmed — ${courseTitle}`
      : `Invoice ${orderId} — enrolment confirmed for ${courseTitle}`,
    html,
    text,
  });

  if (error) {
    // Surfaced to the caller, which logs it without failing the entitlement
    // grant — a delivery problem must never cost someone the access they paid for.
    console.error('Resend rejected the invoice email:', error);
    throw sendFailure(error.message ?? 'send failed');
  }

  console.log(`Invoice email queued (${data?.id}) for order ${orderId}`);
  return data;
}
