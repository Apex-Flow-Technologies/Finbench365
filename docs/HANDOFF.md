# Handoff — MyExams365

Point a new session at this file. Everything below is verified against the live
project, not assumed.

## State

- Branch `feat/admin-revamp-phase-3` — **6 commits ahead of `main`, NOT deployed**
- Production runs `main`, which stops at Phase 2. The admin rework, coupons,
  grant-access, security fixes and exam fixes are all unmerged.
- Working tree clean, everything pushed.

## Do these first (only you can)

1. **Merge + deploy the branch.** Nothing below Phase 2 is live.
   `https://github.com/Apex-Flow-Technologies/Finbench365/pull/new/feat/admin-revamp-phase-3`
   (`gh` is not installed locally and there is no token, so the PR must be opened in the browser.)
2. **Disable `TESTER100`** — 100% off, live, ~990 uses left. One click at `/admin/coupons` once deployed.
3. **`pord test 2` is live with zero published tests** — purchasable and empty. Publish its test or unpublish the course.
4. **Rename courses** — customers currently see "pord test 1 / 2 / 3".
5. **Publish one exam-type test and sit it end to end.** Both published tests are
   `practice`; the server-side grading path has never run in production.
6. **MX records for `support@myexams365.com`** — no MX exists, so every invoice's
   reply-to bounces. Get values from Zoho admin.
7. **GSTIN env vars** (`INVOICE_LEGAL_NAME`, `INVOICE_GSTIN`, `INVOICE_ADDRESS`)
   or invoices aren't claimable by business buyers.
8. Delete test accounts (`test@`, `audit@`, `admin@myems365.com`). Decide on the
   orphaned ₹588.82 order whose user document no longer exists.

## Done this session

Phases 0–5 of the admin revamp: data correctness at source, a backfill of
existing records, unified `/admin` shell with real numbers, the exam editor
folded in as `/admin/content`, a single-student view, grant/extend access,
coupon management, an audit log, and removal of the `editor` role.

Then a three-way audit (security / performance / UX) and its fixes:

- **Privilege escalation** — the `users` create rule had no field allowlist, so
  any authenticated user could write their own profile with `role: 'admin'`.
  Fixed and verified with a real client-SDK write against deployed rules.
- **Coupon oracle** — `/api/payments/validate-coupon` was unauthenticated and
  returned the discount, letting anyone brute-force codes. Now authenticated +
  durably rate limited.
- **Auto-submit scored 0** — the anti-cheat and timer effects captured `answers`
  from the closure at exam start (empty), so every automatic submission graded
  nothing. Now reads live values via refs.
- **One strike disqualified** despite the UI promising three.
- **Practice tests were fully proctored** — fullscreen, strikes, copy blocking —
  on a mode that reveals the answers. Now certification-only.
- **Fabricated data removed** — settings showed hardcoded "42 Days Left",
  "Tier 2 — NISM V-A Pro Pack", "85% Complete" to every user.
- Pricing said "inclusive of GST" while checkout added 18% on top.
- Revenue was recomputed from list price in two places, ignoring discounts.

## Known remaining (Tier 2 — matters at scale, not at 6 users)

- Exam runner writes ~630×/candidate/exam; the heartbeat effect re-fires on
  every answer. Split it out, debounce `saveTestProgress`, raise interval to 30–60s.
- `useAdminUsers` is an unbounded `onSnapshot` over all users, instantiated 3×.
  Paginate; `createdAt` is now guaranteed so ordered queries are safe again.
- Storefront N+1: `exams`/`checkout` query per course just to count tests.
  Denormalise `publishedTestCount` onto the course doc.
- `/api/admin/backfill` will time out past ~500 users (serial Auth + Razorpay calls).
- `startTestAttempt` writes `startTime` but `submit/route.ts` and
  `getUserAnalytics` read `startedAt` — server timer validation is dead code and
  analytics always show 0.
- Accessibility: login/settings inputs lack `htmlFor`/`id`; body text at ~2.2:1
  contrast (needs 4.5:1), including the checkout consent label.
- Admin panel unusable below ~500px (fixed `w-64` sidebar, no toggle).
- `test_attempts` create rule accepts arbitrary fields — a client can self-report
  a completed attempt with any score. Bounded (no certificates exist).
- 8 mock tests reference deleted/missing courses. Unpublished, so harmless, but
  they cannot be opened by anyone. Deletion needs a human decision.
- `docs/MyExams365-Platform-Guide.pdf` is stale — it predates the role change.
  Regenerate with `python docs/build_guide.py`.

## Environment notes

- Firebase deploys: no `.firebaserc`, no global CLI. Use
  `npx firebase-tools deploy --only firestore:rules --project finbench365`
- `.env.local` uses `KEY = value` with spaces around `=`; `dotenv` handles it,
  a strict `^KEY=` regex does not.
- Razorpay is on **live** keys.
