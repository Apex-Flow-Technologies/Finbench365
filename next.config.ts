import type { NextConfig } from "next";

// Razorpay Checkout loads scripts/frames from MULTIPLE subdomains, not just
// checkout.razorpay.com — e.g. cdn.razorpay.com for its fraud/risk-detection
// bundle. A too-narrow allowlist here silently breaks payments (blocked
// script -> Razorpay rejects the payment-create call -> false "payment
// failed"), so razorpay.com uses a wildcard rather than enumerating
// subdomains one at a time. Firebase needs websocket + REST access; Vercel
// Analytics needs its script + endpoint.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.razorpay.com https://va.vercel-scripts.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.razorpay.com https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://vitals.vercel-insights.com",
  "frame-src 'self' https://*.razorpay.com https://apis.google.com https://pay.google.com https://*.firebaseapp.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['firebase-admin'],
  // The exam editor moved from its own /editor shell into the unified admin
  // panel. These keep existing bookmarks and any pasted links working instead
  // of 404ing. Permanent so browsers stop re-requesting the old path.
  async redirects() {
    return [
      { source: '/editor', destination: '/admin/content', permanent: true },
      // /admin/users was itself renamed to /admin/students, so pointing here
      // would have redirected an old bookmark straight into a 404.
      { source: '/editor/settings', destination: '/admin/students', permanent: true },
      { source: '/editor/courses/:id', destination: '/admin/content/courses/:id', permanent: true },
      { source: '/editor/tests/:id', destination: '/admin/content/tests/:id', permanent: true },
      // Anything else that lived under /editor lands on the section index.
      { source: '/editor/:path*', destination: '/admin/content', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
