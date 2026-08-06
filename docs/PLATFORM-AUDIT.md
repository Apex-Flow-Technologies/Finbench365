# MyExams365 — Platform Audit & Change Record

**Scope:** full read of the codebase, plus the fixes arising from it and from the
UAT round (`RECTIFICATIONS FOR NEXT UAT`, the Team & Developer Checklist, and the
Code Red scenarios sheet).

**State at time of writing:** 108 unit tests passing · 0 TypeScript errors ·
0 lint errors · production build clean (33 routes).

---

## 1. What this platform is

An exam-preparation service for Indian financial certifications. A candidate buys
time-boxed access to a NISM exam track, then sits CBT-style practice and
certification mocks in the browser.

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Firebase
(Auth + Firestore) · Razorpay · Resend · Vercel.

### Access model

Access is an **entitlement**, not a subscription:
`users/{uid}.enrolledCourses[courseId] = { expiresAt, planId, … }`.
Plans live in `src/constants/pricing.ts` and are priced **server-side only** —
the client never supplies an amount. Expiry is enforced in three places that must
agree: `firestore.rules`, `lib/api/requireEntitlement.ts`, and the UI.

### Roles

Two: `student` and `admin`. An `editor` role existed in code but was never
assigned, could not be granted from any UI, and would have locked out any account
given it. Removed.

---

## 2. Findings and resolutions

Severity reflects impact on a candidate or on money.

### Critical

| # | Finding | Resolution |
|---|---|---|
| C1 | **Auto-submit graded a blank answer sheet.** Timer and anti-cheat effects closed over `answers` from the render in which they last ran — the moment the exam began. Every attempt that timed out or hit the third strike was scored on an empty map. | Effects call through a ref that always resolves to the current submit. Synchronous re-entrancy guard added; `isSubmitting` was both stale and async. |
| C2 | **Candidates could write their own score.** The `test_attempts` update rule allowed any field change while in progress, so a client could write `{score, status:'completed'}` and bypass the grader — on certification exams, not just practice. | Client writes restricted to `answers`, `markedForReview`, `lastSavedAt`, `lastHeartbeatAt`. Create rule additionally forbids an attempt born `completed` or carrying a score. |
| C3 | **Coupon discounts were silently discarded.** The duplicate-order guard matched on course + freshness only, so applying a coupon after an abandoned attempt returned the original undiscounted order to Razorpay. | Dedup pointer now carries `amountPaise` and `couponCode`; reuse requires an exact match. |

### High

| # | Finding | Resolution |
|---|---|---|
| H1 | Attempt timestamps had **three names** (`startTime`/`endTime`/`endedAt`) while readers looked for `startedAt`/`submittedAt`. Server-side over-time checking was dead code; "Total CBT Time" was permanently `0h 0m`. | Normalised, with legacy fallbacks so historical attempts still count. |
| H2 | **Coupon uses were consumed at checkout**, so every abandoned checkout permanently burned one. | Increment moved into the transaction that transitions the order. |
| H3 | `/api/payments/validate-coupon` was **unauthenticated**, behind only a per-instance limiter — a free oracle over the coupon namespace. | Bearer token required; durable per-account and per-IP limits. |
| H4 | Firebase Admin **exported `{}`** when misconfigured, so every server route failed with `TypeError: adminDb.collection is not a function`. | Proxy that stays importable at build time but throws `FirebaseAdminNotConfiguredError` naming the missing variables. |
| H5 | A **live 100%-off coupon** (`TESTER100`, 1000 uses, no expiry) was committed to the repo. | Removed; the script now takes arguments and requires an expiry. |
| H6 | **Refunds never happened.** "Refunding" marked the order `refunded` and revoked access without ever contacting Razorpay — the ledger claimed money had been returned when none moved. | `/api/admin/refund` calls the gateway, revokes only on confirmation, guards double-refund transactionally *and* with an idempotency key, and decrements `totalSpent`. |

### Medium

| # | Finding | Resolution |
|---|---|---|
| M1 | `/admin/orders` **crashed on search** — `.toLowerCase()` on `paymentId`, absent on unpaid orders. Masked because an empty query short-circuits. | Null-safe filter; the `Order` interface now models optionality honestly. |
| M2 | Orders showed the **ex-GST list price** while every other screen used the captured amount — a ₹10 coupon order read ₹599. | Shows `amountPaid` with a base + GST breakdown; "unknown" rather than ₹0.00 when absent. |
| M3 | **Three** user-management surfaces existed, one containing a **fabricated audit log** and non-functional feature-flag/pricing controls that persisted nowhere. | Consolidated into `/admin/users`; the other two deleted. |
| M4 | Razorpay webhook read notes only off the payment entity, which Razorpay does not reliably populate — granting nothing and answering 200. | Falls back to the embedded order entity, then the API; answers 500 so delivery retries. |
| M5 | `ignoreBuildErrors` and `ignoreDuringBuilds` were both `true`, and a legacy `.eslintrc.json` meant every rule override — including `react-hooks/exhaustive-deps`, which catches C1 — was silently inert. | Both removed after fixing 12 pre-existing type errors. Flat config only. |
| M6 | The admin Overview **surfaced only the users error**, so a failed orders read rendered a confident ₹0. | All three loaders report their own failure. |
| M7 | No `.env.example`; README was create-next-app boilerplate. | 21 variables documented; README describes the real architecture. |
| M8 | **Zero tests, zero CI.** | 108 tests over money, coupons, credentials, scoring, shuffling and parsing. CI runs lint + typecheck + test. |

### Content integrity — the largest finding

The marketing surface described a product that does not exist.

- **Third-party trademarks.** The landing page, the site metadata Google indexes,
  and the candidate profile dropdown advertised **CFA®, FRM® and GARP®**
  certifications. None are sold here; none are licensed.
- **Invented statistics presented as fact:** *"94.2% Charterholder Pass Rate"*,
  *"96.8% First-Attempt Mastery"*, *"6,400+ Algorithmic Qs"*, *"14,800+
  Algorithmic Qs"*. The pass-rate claims contradicted the site's own disclaimer,
  which states plainly that no exam result is guaranteed.
- **Fabricated testimonials.** Every entry was invented — candidates who do not
  exist, job titles, specific score improvements (*"Mock Score: 62% → 89%"*,
  *"96th Percentile Overall"*), praising machinery never built: an
  Item-Response Theory diagnostic engine, a Two-Parameter Logistic model, Monte
  Carlo problems that regenerate their numbers.
- The **FAQ** answered questions about that same fictional product.

Fabricated social proof and invented pass rates are the most exposed content a
site can carry under the Consumer Protection Act 2019 and the ASCI code. All of
it is removed. The testimonials section was **deleted rather than reworded** — it
cannot be corrected by editing; it needs real candidates.

---

## 3. Features delivered

**Negative marking.** Configured per test, seeded from the official NISM pattern
table. Pure, unit-tested grader (`lib/exams/scoring.ts`). Unattempted questions
are never penalised — the distinction that makes negative marking meaningful.
The scheme is snapshotted onto each attempt so a later edit cannot silently
reinterpret a historical result.

**Document parser, rewritten** for the locked-in format and validated against the
real `NISM-XV-RA_Mock_Test_1`: 100 questions, 5 cases × 4, all answers resolved.
Two properties drove the design — the correct answer is stated *only* inside the
explanation block, and every option carries its own explanation. Where no option
is marked Correct there is nothing to recover, so it **reports** rather than
defaulting a whole paper's answer key to "A". Reads duration, pass mark and
negative marking from the document header and applies them.

**Case-study (caselet) support** end to end: parsed, stored, and shown as a
collapsible scenario shared across its four questions.

**Per-option explanations.** Stored in the protected `solutions` subcollection —
the wording alone identifies the correct option — and shown after a practice
answer, marked with which option the candidate chose.

**Question randomisation.** Deterministic, seeded from the attempt id, so a
refresh or reconnect does not reshuffle the paper. Fisher-Yates.

**On-screen calculator.** Four functions, matching what NISM provides. Keystrokes
are captured and stopped from reaching the anti-cheat handler.

**Admin operations:** real refunds, manual access grant/extension, unpaid-order
follow-up queue, bulk question delete, revenue on the ledger page.

**Identity:** logo (transparent + dark variants + favicon), MentraEdge copyright,
`Materials` → `Study Notes`, exam metadata on the storefront.

---

## 4. Open risks

### Blocking

1. **Firestore rules have never been executed.** Edited across six commits.
   Run `firebase emulators:start --only firestore` before relying on them.
2. **Email is dead in production.** Resend delivers only to the account owner
   until `myexams365.com` is verified — this blocks signup, password reset and
   invoices simultaneously.
3. **No end-to-end run.** Every change is reviewed and unit-tested; none has been
   clicked. `sign up → pay → attempt → result` is the gate.

### High

4. **Refunds untested against the live gateway.** Verify one with test keys.
5. **Negative marking is off until each test is configured.** By design.
6. **`LEGAL_ENTITY` carries no incorporation suffix.** An Indian tax invoice needs
   the registered name; the governing-law clause names this entity.
7. **`support@`, `privacy@`, `grievance@` must exist.** The grievance address is a
   statutory DPDP Act contact.

### Medium

8. Payment endpoints rely on a per-instance rate limiter that resets on cold start.
9. **The 15-minute disconnect rule is display-only** — the runner tells a candidate
   the attempt "has been finalized and recorded as 1 attempt" while writing nothing.
10. Admin screens read whole collections client-side; fine at 50 users, not 5,000.
11. No per-question analytics.

### Concurrency, from code reading

Transactions make entitlement grants and coupon redemption safe under load, and
Vercel scales horizontally. The gaps are the per-instance payment limiter, the
whole-collection admin reads, and the absence of any load test. The single-session
lock is `localStorage`-based, so clearing storage logs out your own other device.
Real numbers need a staging environment — currently Not Started.

---

## 5. Not built

Per-option explanations can be imported but not authored by hand in the editor.
Bulk plan assignment, monthly revenue analytics, international payments,
referrals, and watermarked PDFs (explicitly descoped) remain outstanding — all
Low or unassigned on the source checklists.
