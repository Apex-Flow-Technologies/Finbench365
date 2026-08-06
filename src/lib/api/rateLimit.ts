import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Transaction } from 'firebase-admin/firestore';
import crypto from 'crypto';

/**
 * Durable, cross-instance rate limiting backed by Firestore.
 *
 * The in-memory limiter in middleware.ts resets on every cold start and is not
 * shared between serverless instances, which makes it useless as a security
 * control — an attacker just needs their requests to land on different
 * instances. Auth endpoints use this instead: the counter survives restarts and
 * is consistent across every instance because the read-modify-write happens in
 * a transaction.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function rateLimit(opts: {
  /** Logical bucket, e.g. 'otp-request:ip' */
  scope: string;
  /** Identifier within the bucket — hashed before storage. */
  identifier: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const { scope, identifier, limit, windowMs } = opts;
  // Identifiers (IPs, emails) are hashed so the collection never becomes a
  // browsable list of who has been hitting the API.
  const id = crypto.createHash('sha256').update(`${scope}:${identifier}`).digest('hex');
  // Typed explicitly: `adminDb` is `any`, so an untyped ref makes tx.get()
  // resolve to the Query overload and `.exists` / `.data()` stop type-checking.
  const ref: FirebaseFirestore.DocumentReference =
    adminDb.collection('rate_limits').doc(id);
  const now = Date.now();

  try {
    return await adminDb.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data()! : null;
      const windowStart: number = data?.windowStart ?? 0;
      const count: number = data?.count ?? 0;

      if (!data || now - windowStart >= windowMs) {
        tx.set(ref, { count: 1, windowStart: now, scope, updatedAt: FieldValue.serverTimestamp() });
        return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
      }

      if (count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
        };
      }

      tx.update(ref, { count: count + 1, updatedAt: FieldValue.serverTimestamp() });
      return { allowed: true, remaining: limit - (count + 1), retryAfterSeconds: 0 };
    });
  } catch (err) {
    // A limiter that errors must not become an outage. Fail open, but loudly —
    // the endpoints behind this also enforce their own per-record attempt caps,
    // so this is not the only thing standing between an attacker and the data.
    console.error(`rateLimit(${scope}) failed, allowing request:`, err);
    return { allowed: true, remaining: 0, retryAfterSeconds: 0 };
  }
}

/** Best-effort client IP from the proxy chain in front of the app. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
