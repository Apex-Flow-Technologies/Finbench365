import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { rateLimit, clientIp } from '@/lib/api/rateLimit';
import { sendPasswordResetMail } from '@/lib/email';
import { emailKey, normalizeEmail, isValidEmail } from '@/lib/auth/otp';

const WINDOW_MS = 60 * 60 * 1000;

/**
 * Issues a password reset link and delivers it through Resend.
 *
 * Firebase's client-side sendPasswordResetEmail() uses Firebase's own mailer
 * (noreply@<project>.firebaseapp.com), which is unaligned with our domain and
 * frequently spam-filtered — for a reset, that means the user stays locked out.
 * Here the link is minted with the Admin SDK and sent from our verified domain.
 */
export async function POST(req: Request) {
  try {
    const { email: rawEmail } = await req.json().catch(() => ({}));

    if (typeof rawEmail !== 'string' || !isValidEmail(rawEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    const email = normalizeEmail(rawEmail);
    const ip = clientIp(req);

    const [byIp, byEmail] = await Promise.all([
      rateLimit({ scope: 'pwreset:ip', identifier: ip, limit: 10, windowMs: WINDOW_MS }),
      rateLimit({ scope: 'pwreset:email', identifier: emailKey(email), limit: 3, windowMs: WINDOW_MS }),
    ]);
    const blocked = !byIp.allowed ? byIp : !byEmail.allowed ? byEmail : null;
    if (blocked) {
      return NextResponse.json(
        { error: 'Too many reset requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(blocked.retryAfterSeconds) } },
      );
    }

    // The response below is identical whether or not an account exists, so this
    // endpoint cannot be used to discover which addresses are registered.
    try {
      const link = await adminAuth.generatePasswordResetLink(email);
      await sendPasswordResetMail({ email, link });
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        console.log('Password reset requested for an address with no account.');
      } else {
        // A genuine fault is logged but still answered generically — telling the
        // caller "send failed" for one address and "sent" for another would
        // leak exactly what the uniform response is designed to hide.
        console.error('Password reset failed:', err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('request-password-reset error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
