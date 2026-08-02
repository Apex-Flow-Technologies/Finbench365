import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { rateLimit, clientIp } from '@/lib/api/rateLimit';
import {
  verifyOtp, emailKey, normalizeEmail, isValidEmail, passwordProblem,
  OTP_MAX_ATTEMPTS, OTP_LENGTH, OTP_SEND_WINDOW_MS,
} from '@/lib/auth/otp';

/**
 * Step 2 of signup: redeem the emailed code and create the account.
 *
 * The Firebase user is created here, server-side, already marked verified —
 * so an account only ever exists for an address that has been proven reachable.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail, otp, name, password, organization } = body ?? {};

    if (typeof rawEmail !== 'string' || !isValidEmail(rawEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (typeof otp !== 'string' || !new RegExp(`^\\d{${OTP_LENGTH}}$`).test(otp.trim())) {
      return NextResponse.json({ error: `Enter the ${OTP_LENGTH}-digit code from your email.` }, { status: 400 });
    }
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 });
    }
    const pwProblem = passwordProblem(password);
    if (pwProblem) return NextResponse.json({ error: pwProblem }, { status: 400 });

    const email = normalizeEmail(rawEmail);
    const key = emailKey(email);
    const ip = clientIp(req);

    // Caps guessing across addresses; the per-record attempt counter below
    // caps guessing against one specific code.
    const byIp = await rateLimit({
      scope: 'otp-verify:ip', identifier: ip, limit: 30, windowMs: OTP_SEND_WINDOW_MS,
    });
    if (!byIp.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(byIp.retryAfterSeconds) } },
      );
    }

    const ref = adminDb.collection('pending_signups').doc(key);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: 'This code has expired or was already used. Please request a new one.' },
        { status: 400 },
      );
    }
    const rec = snap.data()!;

    const expiresAtMs: number = rec.expiresAt?.toMillis?.() ?? 0;
    if (Date.now() > expiresAtMs) {
      await ref.delete().catch(() => {});
      return NextResponse.json(
        { error: 'This code has expired. Please request a new one.' }, { status: 400 },
      );
    }

    if ((rec.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      await ref.delete().catch(() => {});
      return NextResponse.json(
        { error: 'Too many incorrect attempts. Please request a new code.' }, { status: 400 },
      );
    }

    if (!verifyOtp(otp.trim(), rec.salt, rec.otpHash)) {
      // Count the miss before responding so a burst of parallel guesses still
      // consumes the budget.
      await ref.update({ attempts: FieldValue.increment(1) });
      const left = Math.max(0, OTP_MAX_ATTEMPTS - ((rec.attempts ?? 0) + 1));
      return NextResponse.json(
        { error: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.` : 'Incorrect code. Please request a new one.' },
        { status: 400 },
      );
    }

    // Code is good — create the account. emailVerified is set at creation
    // because reachability was just proven.
    let uid: string;
    try {
      const created = await adminAuth.createUser({
        email,
        password,
        displayName: name.trim(),
        emailVerified: true,
      });
      uid = created.uid;
    } catch (err: any) {
      if (err?.code === 'auth/email-already-exists') {
        await ref.delete().catch(() => {});
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in instead.', accountExists: true },
          { status: 409 },
        );
      }
      if (err?.code === 'auth/invalid-password') {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
      }
      throw err;
    }

    // Role is assigned server-side and never taken from the request.
    await adminDb.collection('users').doc(uid).set({
      email,
      name: name.trim(),
      organization: typeof organization === 'string' ? organization.trim().slice(0, 120) : '',
      role: 'student',
      emailVerifiedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });

    // Single-use: burn the code so it can never be replayed.
    await ref.delete().catch(() => {});

    return NextResponse.json({ success: true, uid });
  } catch (error) {
    console.error('verify-otp error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
