import crypto from 'crypto';

/**
 * One-time codes for email-verified signup.
 *
 * Codes are never stored in readable form. Each record carries its own random
 * salt, and an optional deployment-wide pepper (OTP_PEPPER) that lives only in
 * the environment — so a leaked database alone is not enough to recover a code
 * before it expires.
 */

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;        // code is valid for 10 minutes
export const OTP_MAX_ATTEMPTS = 5;                // wrong guesses before a code dies
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;  // min gap between sends to one address
export const OTP_MAX_SENDS_PER_WINDOW = 5;        // sends per address per hour
export const OTP_SEND_WINDOW_MS = 60 * 60 * 1000;

/** Cryptographically uniform 6-digit code — Math.random() is not acceptable here. */
export function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;
  // Rejection sampling keeps every code equally likely (a plain modulo would
  // bias the low end of the range).
  const limit = Math.floor(0xffffffff / max) * max;
  let n: number;
  do {
    n = crypto.randomBytes(4).readUInt32BE(0);
  } while (n >= limit);
  return String(n % max).padStart(OTP_LENGTH, '0');
}

export function newSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function hashOtp(otp: string, salt: string): string {
  const pepper = process.env.OTP_PEPPER || '';
  return crypto.createHash('sha256').update(`${salt}:${otp}:${pepper}`).digest('hex');
}

/** Constant-time comparison so a wrong code cannot be narrowed down by timing. */
export function verifyOtp(otp: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtp(otp, salt), 'utf8');
  const expected = Buffer.from(expectedHash, 'utf8');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/**
 * Firestore document id for an address. Emails are lowercased and hashed so the
 * pending-signup collection does not become a plaintext list of addresses that
 * have attempted to register.
 */
export function emailKey(email: string): string {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Intentionally conservative: no unicode, no leading/trailing dots, single @.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

export function isValidEmail(email: string): boolean {
  const e = email.trim();
  return e.length >= 5 && e.length <= 254 && EMAIL_RE.test(e) && !e.includes('..');
}

export function passwordProblem(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (password.length > 128) return 'Password is too long.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one letter and one number.';
  }
  return null;
}
