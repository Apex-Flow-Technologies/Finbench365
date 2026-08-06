# MyExams365

Exam-preparation platform for Indian financial certifications (NISM Series V-A and
similar). Candidates buy time-boxed access to a certification track, then sit
CBT-style practice and certification mock exams in the browser.

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Firebase
(Auth + Firestore) · Razorpay · Resend · deployed on Vercel.

## Getting started

```bash
npm ci
```

Copy `.env.example` to `.env.local` and fill it in — the file documents where
each value comes from and what breaks when it is missing. The app will not build
without at least the Firebase client keys.

```bash
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` | Production build (typechecks and lints — see below) |
| `npm test` | Unit tests (Vitest, no emulator or network needed) |
| `npm run test:watch` | Tests in watch mode |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

`next.config.ts` deliberately does **not** set `ignoreBuildErrors` or
`ignoreDuringBuilds`. Both were once `true`, which shipped type errors and lint
failures to production silently. If a build fails on one, fix the error rather
than restoring the flag.

## How it fits together

### Roles

Two: `student` and `admin`. There is no separate editor role — authoring content
is admin work. Roles live on the user document (`users/{uid}.role`) and are
granted in the Firebase console; the admin panel can demote but deliberately
cannot promote.

### Access model

Access is an **entitlement**, not a subscription:
`users/{uid}.enrolledCourses[courseId] = { expiresAt, planId, ... }`. Plans are
defined in `src/constants/pricing.ts` and priced server-side only — the client
never supplies an amount. Expiry is enforced in three places that must agree:
`firestore.rules`, `src/lib/api/requireEntitlement.ts`, and the UI.

### Payment flow

```
/checkout
   │  POST /api/payments/create-order   ← server prices the plan, validates the
   │                                      coupon (read-only), creates the
   │                                      Razorpay order, writes orders/{id}
   ▼
Razorpay checkout popup
   │
   ├─ browser succeeds  → POST /api/payments/verify        (signature + re-fetch)
   ├─ webhook fires     → POST /api/payments/razorpay-webhook
   └─ neither happens   → POST /api/payments/check-order-status, or the
                          "Reconcile Stuck Orders" sweep in /admin/orders
                                    │
                                    ▼
                    grantEntitlementIdempotent()   ← the only way access is granted
```

All four paths converge on `src/lib/payments/grantEntitlement.ts`, which is
idempotent on `orderId` inside a single Firestore transaction. They race
routinely; that is expected and safe. Side effects that must happen exactly once
(the invoice email, the `totalSpent` increment, the coupon `usedCount`
increment) only fire on the call that actually transitions the order.

`verify` treats the Razorpay order's own `notes` as the source of truth for
plan and course — never the client's request body — and requires
`order.status === 'paid'`, because a valid signature can exist for a payment
that was authorised but never captured.

### Exam flow

Test metadata is public so the storefront can list what a course contains.
Questions and answer keys are not: `mock_tests/{id}/questions` and
`.../solutions` are gated on a live entitlement by `firestore.rules`.

**Grading is server-side, always** — `/api/exams/submit` scores against the
`solutions` subcollection using the Admin SDK. Firestore rules permit a browser
to write only `answers`, `markedForReview` and the liveness timestamps on its own
in-progress attempt; `score`, `status` and `submittedAt` are server-owned. If you
add a client-side write to `test_attempts`, expect it to be rejected — that is
the rule working.

### Signup

Two steps, so an account can only exist for an address that has been proven
reachable: `/api/auth/request-otp` emails a code (hashed with a per-record salt
plus `OTP_PEPPER`, stored under a hash of the email), and
`/api/auth/verify-otp` redeems it and creates the Firebase user already marked
verified. Both are rate-limited per-IP and per-email in Firestore, which — unlike
the in-memory limiter in `middleware.ts` — survives cold starts.

## Layout

```
src/
  app/
    api/          route handlers — auth, payments, exams, admin
    admin/        admin panel (overview, students, orders)
    editor/       course and question-bank authoring (admin-only)
    dashboard/    candidate portal, incl. the CBT exam runner
  components/
    admin/        shared admin primitives — use these, don't hand-roll tables
  hooks/          useAdminUsers / useAdminOrders / useAdminContent
  lib/
    api/          requireAdmin, requireEntitlement, rateLimit
    auth/         OTP generation, hashing, password rules
    payments/     grantEntitlement (the money path), coupon rules
    admin/        revenue summarisation
    firebase/     client SDK config, Admin SDK init, Firestore helpers
firestore.rules   the real access control — read this before changing data shape
```

## Testing

`npm test` covers the pure logic — revenue summarisation, coupon rules, OTP and
password handling, the DOCX question parser. No emulator, no credentials, no
network; it runs in about a second.

Anything transactional is **not** covered. `grantEntitlementIdempotent` and the
security rules both need the Firestore emulator:

```bash
firebase emulators:start --only firestore
```

Deploy rule changes only after exercising them there. A mistake in
`firestore.rules` either exposes paid content or locks out paying customers, and
neither is visible from a passing build.

## Deployment

Vercel. Set every variable from `.env.example` in the project settings, and point
the Razorpay webhook at `https://<domain>/api/payments/razorpay-webhook`.

Security headers and the CSP live in `next.config.ts`. The Razorpay allowlist is
a wildcard on `razorpay.com` on purpose — checkout pulls scripts from several
subdomains, and a too-narrow list breaks payments in a way that surfaces to the
candidate as a false "payment failed".
