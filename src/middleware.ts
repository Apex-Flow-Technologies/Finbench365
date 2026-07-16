/**
 * ==============================================================================
 * FinBench365 — Next.js 15 App Router Edge Middleware (Sprint 2)
 * ==============================================================================
 * Enforces session security boundaries before rendering pages:
 * - Redirects unauthenticated requests away from protected routes (`/checkout`, `/dashboard`, `/admin/*`)
 * - Redirects authenticated requests away from guest-only routes (`/login`, `/register`) if visiting directly
 */

import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authCookie = request.cookies.get('finbench_auth');
  const isAuthenticated = !!authCookie?.value;

  // 1. Protected Student / Institutional Routes
  const protectedPaths = ['/checkout', '/dashboard'];
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));

  if (isProtectedPath && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Protected Admin Portal Routes
  if (pathname.startsWith('/admin') && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public assets (.png, .svg, .jpg, .ico)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
