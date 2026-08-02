import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { rateLimit, clientIp } from '@/lib/api/rateLimit';
import { sendOtpEmail } from '@/lib/email';
import {
  generateOtp, newSalt, hashOtp, emailKey, normalizeEmail, isValidEmail,
  OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS, OTP_MAX_SENDS_PER_WINDOW, OTP_SEND_WINDOW_MS,
} from '@/lib/auth/otp';

/**
 * Step 1 of signup: prove the address is reachable before any account exists.
 *
 * No Firebase user is created here. A short-lived code is emailed and held
 * (hashed) in pending_signups until step 2 redeems it.
 */
export async function POST(req: Request) {
  try {
    const { email: rawEmail } = await req.json().catch(() => ({}));

    if (typeof rawEmail !== 'string' || !isValidEmail(rawEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    const email = normalizeEmail(rawEmail);
    const key = emailKey(email);
    const ip = clientIp(req);

    // Two independent limits: one stops a single address being spammed, the
    // other stops one client cycling through many addresses to burn our
    // sending quota or use us as an email relay.
    const [byIp, byEmail] = await Promise.all([
      rateLimit({ scope: 'otp-request:ip', identifier: ip, limit: 15, windowMs: OTP_SEND_WINDOW_MS }),
      rateLimit({ scope: 'otp-request:email', identifier: key, limit: OTP_MAX_SENDS_PER_WINDOW, windowMs: OTP_SEND_WINDOW_MS }),
    ]);
    const blocked = !byIp.allowed ? byIp : !byEmail.allowed ? byEmail : null;
    if (blocked) {
      return NextResponse.json(
        { error: 'Too many verification requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(blocked.retryAfterSeconds) } },
      );
    }

    // An existing account is reported plainly. This is technically an
    // enumeration signal, but signup cannot be usable otherwise — the
    // alternative is silently doing nothing and stranding a returning user.
    try {
      await adminAuth.getUserByEmail(email);
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in instead.', accountExists: true },
        { status: 409 },
      );
    } catch (err: any) {
      if (err?.code !== 'auth/user-not-found') throw err;
    }

    const ref = adminDb.collection('pending_signups').doc(key);
    const existing = await ref.get();
    if (existing.exists) {
      const lastSentMs: number = existing.data()?.lastSentAt?.toMillis?.() ?? 0;
      const since = Date.now() - lastSentMs;
      if (since < OTP_RESEND_COOLDOWN_MS) {
        return NextResponse.json(
          { error: 'A code was just sent. Please wait a moment before requesting another.' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((OTP_RESEND_COOLDOWN_MS - since) / 1000)) } },
        );
      }
    }

    const otp = generateOtp();
    const salt = newSalt();

    // Written before sending: if the email send fails we would rather have a
    // dead code on record than send a code we cannot verify.
    await ref.set({
      emailHash: key,
      otpHash: hashOtp(otp, salt),
      salt,
      attempts: 0,
      expiresAt: Timestamp.fromMillis(Date.now() + OTP_TTL_MS),
      lastSentAt: FieldValue.serverTimestamp(),
      createdAt: existing.exists ? existing.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      requestIpHash: emailKey(ip),
    }, { merge: true });

    try {
      await sendOtpEmail({ email, code: otp, minutes: Math.round(OTP_TTL_MS / 60000) });
    } catch (sendErr) {
      console.error('OTP send failed:', sendErr);
      // Drop the code we just stored — a user who never received it must not be
      // left facing a code entry screen with no way forward.
      await ref.delete().catch(() => {});
      return NextResponse.json(
        { error: 'We could not send the verification email. Please check the address and try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, expiresInMinutes: Math.round(OTP_TTL_MS / 60000) });
  } catch (error) {
    console.error('request-otp error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
