# Change Record — 6 August 2026

Everything shipped in one session, from a full codebase audit through the UAT
round. Written to be readable by anyone on the team, not only engineers.

**Shipped to `main` as 7 commits · 92 files · +6,900 / −2,600 lines.**
108 unit tests passing · 0 type errors · 0 lint errors · production build clean.

---

## The short version

Three things were quietly wrong that cost money or marks:

1. Candidates whose exam ran out of time were **graded on a blank answer sheet**.
2. Applying a coupon after an abandoned checkout **charged the full price anyway**.
3. "Refunding" a customer revoked their access but **never returned any money** —
   the ledger said they had been repaid when their card had not been touched.

And one thing was wrong at a different level: the marketing pages advertised
**CFA®, FRM® and GARP®** certifications we do not sell, with invented pass-rate
statistics and testimonials from people who do not exist.

All four are fixed. Details below.

---

## Fixed — exam engine

**Auto-submit graded an empty paper.**
The timer and anti-cheat code held onto the answers as they were *at the moment
the exam started* — which is to say, none. Any candidate who ran out of time, or
was disqualified on the third anti-cheat strike, was marked on nothing. Now
submits the answers actually given.

**Candidates could set their own score.**
The database rules let a browser write any field to an in-progress attempt,
including the score and a "completed" status. That skipped the grader entirely,
on certification exams as well as practice. Browsers may now write only their
answers, review flags and keep-alive timestamps; marks are server-only.

**Exam time was never recorded.**
The code saved the start time under one name and read it under another, so
duration checking did nothing and "Total CBT Time" on the dashboard showed
`0h 0m` for everyone, permanently. Time taken now appears on the result screen,
flagged amber if the attempt overran.

**Practice tests marked themselves.**
Practice grading happened in the browser. It now goes through the same
server-side grader as certification exams, so one scorer produces one answer.

---

## Fixed — payments

**Coupons were silently discarded.**
Open checkout → click Pay → close the Razorpay popup → apply a coupon → click Pay
again, and the *original, undiscounted* order came back. The coupon validated,
a discount was calculated, and then thrown away at the gateway. The same fault in
reverse would have honoured a coupon the candidate had removed.

**Coupon uses were burned by window-shoppers.**
A use was consumed when checkout opened, not when payment succeeded, so every
abandoned checkout permanently spent one. A launch coupon could be exhausted
entirely by people who never paid.

**The coupon checker was open to anyone.**
No login required and no durable rate limit, which made it a free tool for
guessing coupon codes — and a 100%-off code is free course access. Now requires
sign-in, with limits that survive server restarts.

**A live 100%-off coupon was sitting in the source code.**
`TESTER100` — 1,000 uses, never expiring — committed to the repository. Removed.
*If it was ever created in the live system it is still active; that needs
checking in Firestore.*

**Paid candidates could be left with nothing.**
When Razorpay's confirmation arrived without the buyer's details attached — which
it does not always include — the system granted nothing and told Razorpay it had
succeeded, so it never tried again. It now looks in two more places and asks to
be retried if it still cannot tell.

**Refunds now actually refund.**
Previously access was revoked and the order marked "refunded" without Razorpay
ever being contacted. There is now a real refund that calls the gateway, revokes
access only once it confirms, blocks the same order being refunded twice, and
corrects the candidate's lifetime spend.

---

## Fixed — admin panel

**"No activity on the dashboard".** The Overview showed a confident ₹0 / 0
students / 0 courses whenever a read failed, because only one of the three
possible errors was ever displayed. An empty panel and a broken panel now look
different.

**The Orders page crashed when you searched it.** It only broke once someone
typed, which is why it looked fine.

**The money column showed the wrong number** — the pre-tax list price, while every
other screen showed what was actually charged. A ₹10 coupon order displayed as
₹599.

**Students and admins are now separate tables**, and a student row lists the exams
they are enrolled in with days remaining, without needing a click.

**There were three different user-management screens.** One contained a *fabricated
audit log* — invented security events with invented email addresses — and
feature-flag and pricing controls that saved nowhere, so switching them changed
nothing while appearing to work. Consolidated into one.

**Support can now repair access** without a developer: grant or extend a course by
any number of days, from the current expiry if access is live or from today if it
has lapsed.

**Unpaid and abandoned orders can be isolated** for follow-up — the cases where
money may have left a candidate's account without the order completing.

---

## Fixed — content and claims

The marketing pages described a different product.

| Was | Reality |
|---|---|
| CFA®, FRM®, GARP® certifications | We sell NISM preparation. These are third-party trademarks we have no licence to use. |
| "94.2% Charterholder Pass Rate", "96.8% First-Attempt Mastery" | Invented. They also contradicted our own disclaimer, which says no result is guaranteed. |
| "6,400+ / 14,800+ Algorithmic Qs" | Invented. |
| Testimonials with names, job titles and score improvements | Every one invented, praising features that were never built. |
| FAQ about an "Item-Response Theory diagnostic engine" | Replaced with the eight real answers supplied by the team. |
| Site title and Google description | Advertised CFA/FRM. Now describes the NISM exams actually offered. |

The testimonials section was **removed rather than reworded** — it cannot be fixed
by editing; it needs real candidates. Restore it once those exist.

The old `/exams` hero, and the footer's Certifications, Pedagogy and Socials
columns, are gone as requested. "Your Enrolled Tracks" is now "Your Enrolled
Exams", the invented "Track A / Foundation Tier" labels are replaced by the real
NISM series code, and "Materials" reads "Study Notes" throughout.

---

## Added

**Negative marking**, configured per test from the official NISM pattern table.
Choosing a series fills in duration, marks, pass mark and penalty automatically.
Unattempted questions are never penalised — skipping correctly beats guessing
wrong. Tests that have not been configured deduct nothing rather than guessing.

**Case-study (caselet) questions** end to end. The scenario appears as a
collapsible panel shared across its four questions.

**A rewritten document parser** for the locked-in format, checked against the real
`NISM-XV-RA_Mock_Test_1`: 100 questions, 5 cases, all answers found. Where a
question has no option marked "Correct" it **reports the problem** instead of
guessing — the old parser silently answered "A", which on a malformed import gave
a whole paper an answer key of A. It also reads duration, pass mark and negative
marking out of the document header and applies them.

**An explanation for every option**, not just the correct one — shown after
answering in practice mode, marked with which option the candidate chose. The
parser flags any option whose explanation is missing or blank.
*Note: several in the current paper are blank, and one contains an author's
working note ("The question may have inconsistencies") that would reach candidates.*

**Question randomisation**, on by default. The order is fixed within a single
attempt, so refreshing or reconnecting does not reshuffle the paper.

**An on-screen calculator** in both practice and exam mode, matching the basic one
NISM provides.

**Delete-all-questions**, for when the wrong document is imported — previously it
had to be undone one question at a time.

**The logo**, in light and dark variants plus a favicon. The supplied files had a
white background baked in, so it was removed; a light variant was generated
because the brand navy is nearly invisible on the dark theme.

---

## Removed

Two duplicate user-management screens · the fabricated testimonials · the
`editor` role (never assigned, and would have locked out anyone given it) · two
unused page sections · two spent one-off scripts · a dead lint config that was
silently disabling every rule.

---

## Safety net

There were **no tests and no CI**, and the build was configured to ignore type and
lint errors — including the exact rule that catches the blank-answer-sheet bug.

Now: **108 tests** covering revenue, coupons, passwords and one-time codes,
scoring and negative marking, question shuffling, and document parsing. CI runs
on every push. Type and lint errors block the build again.

Also: `.env.example` documenting all 21 environment variables, a README that
describes the real architecture, and clear error messages when Firebase or email
is misconfigured — previously both failed with messages that pointed nowhere.

---

## Before this can go live

1. **Deploy the database rules.** Pushing code does not deploy them. Until then a
   student can still write their own exam score. Test with the emulator first.
2. **Verify `myexams365.com` in Resend**, and add the mail settings to Vercel.
   Until then no one can sign up — signup codes, password resets and invoices all
   fail together.
3. **Walk the whole flow yourself**: sign up → pay → sit an exam → get a result.
   None of this has been clicked, only reviewed and unit-tested.
4. **Set each course's NISM series and each test's marking scheme** in the editor.
   Negative marking stays off until you do.
5. **Test one refund** with Razorpay test keys.
6. **Confirm the registered company name** — the legal pages currently name
   "MyExams365 by MentraEdge", which has no incorporation suffix. An Indian tax
   invoice needs the registered name.
7. **Create `support@`, `privacy@` and `grievance@`** at myexams365.com. The
   grievance address is a statutory contact under the DPDP Act.

---

## Known gaps

The 15-minute disconnect rule is **display-only** — the screen tells a candidate
their attempt "has been finalized and recorded as 1 attempt" while nothing is
saved. Per-option explanations can be imported but not written by hand in the
editor. No per-question analytics. Admin screens load whole collections, which is
fine at 50 users and not at 5,000. Watermarked PDFs were descoped.

A concurrency assessment from reading the code is in `PLATFORM-AUDIT.md`; real
numbers need a staging environment, which does not exist yet.
