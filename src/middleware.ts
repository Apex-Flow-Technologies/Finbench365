import { NextRequest, NextResponse } from 'next/server';

// Best-effort in-memory rate limiter. This resets on cold start and is NOT
// shared across serverless instances, so it does not enforce a hard global
// limit — it only raises the cost of casual scripted abuse (coupon brute-force,
// order-creation spam) without adding an external dependency (Upstash/Redis).
// For a real multi-instance guarantee, replace this with Vercel Edge Config
// or Upstash Ratelimit.
const WINDOW_MS = 60_000;
const LIMITS: Record<string, number> = {
  '/api/payments/create-order': 10,
  '/api/payments/verify': 10,
  '/api/payments/check-order-status': 20,
  '/api/payments/validate-coupon': 15,
  '/api/admin': 60,
  // Coarse first line of defence only. The auth routes additionally enforce
  // durable, cross-instance limits in Firestore (see lib/api/rateLimit.ts),
  // because this counter resets on cold start and is per-instance.
  '/api/auth/request-otp': 10,
  '/api/auth/verify-otp': 20,
};

const hits = new Map<string, { count: number; resetAt: number }>();

function matchLimit(pathname: string): { key: string; limit: number } | null {
  for (const prefix of Object.keys(LIMITS)) {
    if (pathname.startsWith(prefix)) {
      return { key: prefix, limit: LIMITS[prefix] };
    }
  }
  return null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const matched = matchLimit(pathname);
  if (!matched) return NextResponse.next();

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const bucketKey = `${matched.key}:${ip}`;
  const now = Date.now();

  const entry = hits.get(bucketKey);
  if (!entry || entry.resetAt < now) {
    hits.set(bucketKey, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  entry.count += 1;
  if (entry.count > matched.limit) {
    return NextResponse.json(
      { error: 'Too many requests, please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/payments/:path*', '/api/admin/:path*', '/api/auth/:path*'],
};
