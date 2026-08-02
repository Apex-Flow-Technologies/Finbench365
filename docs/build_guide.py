# -*- coding: utf-8 -*-
"""Builds the MyExams365 Platform Capability & Reliability Guide PDF."""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, NextPageTemplate,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "MyExams365-Platform-Guide.pdf")

# ---------------------------------------------------------------- fonts
FONT, FONT_B = "Helvetica", "Helvetica-Bold"
try:
    win = r"C:\Windows\Fonts"
    pdfmetrics.registerFont(TTFont("Arial", os.path.join(win, "arial.ttf")))
    pdfmetrics.registerFont(TTFont("Arial-Bold", os.path.join(win, "arialbd.ttf")))
    pdfmetrics.registerFont(TTFont("Arial-Italic", os.path.join(win, "ariali.ttf")))
    from reportlab.pdfbase.pdfmetrics import registerFontFamily
    registerFontFamily("Arial", normal="Arial", bold="Arial-Bold", italic="Arial-Italic")
    FONT, FONT_B = "Arial", "Arial-Bold"
except Exception as e:      # pragma: no cover
    print("Font fallback:", e)

# ---------------------------------------------------------------- palette
INK      = colors.HexColor("#12141A")
SLATE    = colors.HexColor("#3F4652")
MUTED    = colors.HexColor("#6B7280")
AMBER    = colors.HexColor("#B4780A")
AMBER_BG = colors.HexColor("#FDF6E7")
RULE     = colors.HexColor("#DFE3EA")
BAND     = colors.HexColor("#F5F7FA")
GREEN    = colors.HexColor("#0F7A54")

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm

# ---------------------------------------------------------------- styles
ss = getSampleStyleSheet()

def S(name, **kw):
    base = dict(name=name, fontName=FONT, fontSize=9.5, leading=14,
                textColor=SLATE, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(**base)

st_title    = S("t",  fontName=FONT_B, fontSize=27, leading=32, textColor=INK)
st_sub      = S("st", fontSize=12.5, leading=18, textColor=MUTED)
st_h1       = S("h1", fontName=FONT_B, fontSize=16, leading=20, textColor=INK,
                spaceBefore=2, spaceAfter=6)
st_h2       = S("h2", fontName=FONT_B, fontSize=11.5, leading=15, textColor=INK,
                spaceBefore=9, spaceAfter=3.5)
st_h3       = S("h3", fontName=FONT_B, fontSize=9.8, leading=13, textColor=AMBER,
                spaceBefore=8, spaceAfter=3)
st_body     = S("b",  spaceAfter=4)
st_bullet   = S("bu", leftIndent=11, bulletIndent=2, spaceAfter=2.6)
st_cell     = S("c",  fontSize=8.6, leading=11.8)
st_cell_b   = S("cb", fontSize=8.6, leading=11.8, fontName=FONT_B, textColor=INK)
st_cell_h   = S("ch", fontSize=8.3, leading=11, fontName=FONT_B,
                textColor=colors.white)
st_note     = S("n",  fontSize=8.7, leading=12.5, textColor=MUTED)
st_kicker   = S("k",  fontName=FONT_B, fontSize=8, leading=11, textColor=AMBER)
st_toc      = S("toc", fontSize=10, leading=17, textColor=SLATE)


def bullets(items, style=st_bullet):
    return [Paragraph(t, style, bulletText="•") for t in items]


def h_rule(color=RULE, thick=0.6, space_before=0, space_after=6):
    t = Table([[""]], colWidths=[PAGE_W - 2 * MARGIN], rowHeights=[0.1])
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), thick, color),
        ("TOPPADDING", (0, 0), (-1, -1), space_before),
        ("BOTTOMPADDING", (0, 0), (-1, -1), space_after),
    ]))
    return t


def table(rows, widths, header=True, zebra=True):
    """rows: list of lists of strings (already plain text)."""
    data = []
    for r_i, row in enumerate(rows):
        if header and r_i == 0:
            data.append([Paragraph(c, st_cell_h) for c in row])
        else:
            data.append([Paragraph(row[0], st_cell_b)] +
                        [Paragraph(c, st_cell) for c in row[1:]])
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
        ("BOX", (0, 0), (-1, -1), 0.5, RULE),
    ]
    if header:
        style += [("BACKGROUND", (0, 0), (-1, 0), INK),
                  ("LINEBELOW", (0, 0), (-1, 0), 0.5, INK)]
    if zebra:
        start = 1 if header else 0
        for i in range(start, len(data)):
            if (i - start) % 2 == 1:
                style.append(("BACKGROUND", (0, i), (-1, i), BAND))
    t.setStyle(TableStyle(style))
    return t


def callout(title, body):
    inner = [[Paragraph(title, ParagraphStyle("ct", parent=st_kicker))],
             [Paragraph(body, ParagraphStyle("cbdy", parent=st_note,
                                             textColor=SLATE))]]
    t = Table(inner, colWidths=[PAGE_W - 2 * MARGIN])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), AMBER_BG),
        ("LINEBEFORE", (0, 0), (0, -1), 2.2, AMBER),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (0, 0), 8),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (0, 0), 2),
        ("TOPPADDING", (0, -1), (-1, -1), 0),
    ]))
    return t


# ---------------------------------------------------------------- chrome
def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(INK)
    canvas.rect(0, PAGE_H - 78 * mm, PAGE_W, 78 * mm, stroke=0, fill=1)
    canvas.setFillColor(AMBER)
    canvas.rect(0, PAGE_H - 79.6 * mm, PAGE_W, 1.6 * mm, stroke=0, fill=1)
    # brand mark
    canvas.setFillColor(AMBER)
    canvas.roundRect(MARGIN, PAGE_H - 34 * mm, 13 * mm, 13 * mm, 3, stroke=0, fill=1)
    canvas.setFillColor(INK)
    canvas.setFont(FONT_B, 13)
    canvas.drawCentredString(MARGIN + 6.5 * mm, PAGE_H - 30 * mm, "M")
    canvas.setFillColor(colors.white)
    canvas.setFont(FONT_B, 15)
    canvas.drawString(MARGIN + 17 * mm, PAGE_H - 27.5 * mm, "MyExams365")
    canvas.setFillColor(colors.HexColor("#9AA3B2"))
    canvas.setFont(FONT, 8.2)
    canvas.drawString(MARGIN + 17 * mm, PAGE_H - 32 * mm, "BY MENTRAEDGE")
    # footer
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT, 8)
    canvas.drawString(MARGIN, 14 * mm, "Confidential — prepared for client review")
    canvas.restoreState()


def content_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT, 7.8)
    canvas.drawString(MARGIN, PAGE_H - 12 * mm,
                      "MyExams365 — Platform Capability & Reliability Guide")
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, PAGE_H - 14.5 * mm, PAGE_W - MARGIN, PAGE_H - 14.5 * mm)
    canvas.line(MARGIN, 15.5 * mm, PAGE_W - MARGIN, 15.5 * mm)
    canvas.setFont(FONT, 7.8)
    canvas.drawString(MARGIN, 11.5 * mm, "MentraEdge")
    canvas.drawRightString(PAGE_W - MARGIN, 11.5 * mm, str(canvas.getPageNumber()))
    canvas.restoreState()


doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=MARGIN, rightMargin=MARGIN,
                      topMargin=MARGIN, bottomMargin=MARGIN,
                      title="MyExams365 — Platform Capability & Reliability Guide",
                      author="MentraEdge",
                      subject="Platform features, safeguards and failure handling")

cover_frame = Frame(MARGIN, MARGIN, PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN - 62 * mm,
                    id="cover", showBoundary=0)
body_frame = Frame(MARGIN, MARGIN, PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN - 6 * mm,
                   id="body", showBoundary=0)
doc.addPageTemplates([
    PageTemplate(id="Cover", frames=[cover_frame], onPage=cover_page),
    PageTemplate(id="Body", frames=[body_frame], onPage=content_page),
])

E = []   # story

# ================================================================ COVER
E += [
    Spacer(1, 26 * mm),
    Paragraph("PLATFORM DOCUMENTATION", st_kicker),
    Spacer(1, 4),
    Paragraph("Platform Capability<br/>&amp; Reliability Guide", st_title),
    Spacer(1, 7),
    Paragraph("A complete walkthrough of what the platform does, how it protects "
              "candidates and revenue, and exactly how it behaves when something "
              "goes wrong.", st_sub),
    Spacer(1, 12),
    h_rule(),
    Spacer(1, 4),
]

meta = [
    ["Product", "MyExams365 — institutional CBT examination &amp; preparation platform"],
    ["Operator", "MentraEdge Academy LLP"],
    ["Document", "Capability, safeguards and failure-handling reference"],
    ["Audience", "Client stakeholders and operations staff"],
    ["Status", "Live in production"],
]
mt = Table([[Paragraph(a, st_cell_b), Paragraph(b, st_cell)] for a, b in meta],
           colWidths=[32 * mm, PAGE_W - 2 * MARGIN - 32 * mm])
mt.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (0, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
E += [mt, NextPageTemplate("Body"), PageBreak()]

# ================================================================ 1
E += [
    Paragraph("1. About this document", st_h1),
    Paragraph(
        "This guide describes the MyExams365 platform as it is actually built and "
        "deployed today. It is written for two kinds of reader: a stakeholder who "
        "wants to understand what the product does, and an operator who needs to "
        "know how the system behaves under failure and what actions are available "
        "to them.", st_body),
    Paragraph(
        "Every capability listed here is implemented and live. Where a process is "
        "manual rather than automatic, this document says so explicitly rather than "
        "implying automation that does not exist. Section 6 is dedicated entirely to "
        "failure handling, because in an examination and payments product the "
        "behaviour on a bad day matters more than the behaviour on a good one.", st_body),
    Spacer(1, 4),
    callout("How to read section 6",
            "Section 6 lists concrete failure scenarios — a dropped network mid-exam, "
            "a payment that fails after money leaves the account, a duplicate webhook "
            "— and states the guaranteed platform behaviour for each. It is the "
            "section to consult when a candidate reports a problem."),
    Spacer(1, 6),

    Paragraph("2. Platform at a glance", st_h1),
    Paragraph(
        "MyExams365 is a computer-based-test (CBT) preparation and examination "
        "platform for financial certification candidates. It sells time-bound access "
        "to course catalogues, delivers full-length simulated examinations under exam "
        "conditions, and grades them server-side.", st_body),
]

glance = [
    ["Area", "What it provides"],
    ["Delivery", "Web application, works on desktop and mobile browsers; no install required."],
    ["Examinations", "Full-length timed certification simulations plus untimed practice tests, with a question-bank authoring tool."],
    ["Integrity", "Fullscreen enforcement, tab-switch detection, a three-strike warning system, copy/inspect suppression, and server-side grading."],
    ["Commerce", "Razorpay checkout supporting UPI, cards and net banking; coupon engine; automatic GST-inclusive invoicing by email."],
    ["Administration", "Revenue and enrolment dashboard, user management, order ledger, and a payment reconciliation sweep."],
    ["Resilience", "Layered recovery for interrupted payments and interrupted examinations — detailed in section 6."],
]
E += [table(glance, [30 * mm, PAGE_W - 2 * MARGIN - 30 * mm]), Spacer(1, 6)]

# ================================================================ 3
E += [
    Paragraph("3. Access model and roles", st_h1),
    Paragraph(
        "Accounts are created with an email address and password. Every account "
        "carries exactly one role, and role checks are enforced on the server — not "
        "merely by hiding buttons in the interface.", st_body),
]
roles = [
    ["Role", "Can do", "Cannot do"],
    ["Student", "Browse the catalogue, purchase access, sit practice and certification exams, view results and invoices, edit their own profile.",
     "See other candidates' data, read certification answer keys, alter their own enrolments, lifetime spend or role."],
    ["Editor", "Everything a student can, plus create and edit courses, chapters, mock tests and question banks; import questions from Word documents.",
     "Manage users, view revenue, issue refunds or suspend accounts."],
    ["Administrator", "Full access: revenue and enrolment dashboard, user management, order ledger, suspend/reactivate accounts, revoke course access, run payment reconciliation.",
     "— (highest privilege level)"],
]
E += [table(roles, [30 * mm, 72 * mm, PAGE_W - 2 * MARGIN - 102 * mm]), Spacer(1, 6)]

E += [
    Paragraph("Session control", st_h3),
    Paragraph(
        "Each account may hold one active browser session at a time. If the same "
        "credentials are used on a second device, the earlier session is signed out "
        "in real time with an on-screen security notice. This is enforced "
        "continuously while the user is signed in, not only at login, and is the "
        "platform's primary defence against account sharing.", st_body),
    Spacer(1, 5),
]

# ================================================================ 4
E += [Paragraph("4. Feature catalogue", st_h1)]

E += [
    Paragraph("4.1  Public website", st_h2),
    Paragraph("Publicly reachable without an account:", st_body),
]
E += bullets([
    "Landing page with an interactive examination-simulator preview.",
    "Course and examination track listings with pricing.",
    "Candidate testimonials, FAQ and contact details.",
    "Complete legal set: Terms of Service, Privacy Policy, Refund &amp; Cancellation Policy, and Disclaimer.",
    "Light, dark and system-matched display themes, remembered per visitor.",
])

E += [
    Paragraph("4.2  Accounts and authentication", st_h2),
]
E += bullets([
    "Email and password registration and sign-in, with the candidate's display name captured at signup.",
    "Profile management from the candidate dashboard.",
    "Single active session per account, enforced in real time (section 3).",
    "Administrator-controlled account suspension, which signs the candidate out immediately and blocks new purchases and exam submissions.",
])

E += [
    Paragraph("4.3  Catalogue, plans and enrolment", st_h2),
    Paragraph(
        "Access is sold as a time-bound enrolment in a specific course. Three "
        "durations are offered, each priced in code and applied server-side so the "
        "amount charged can never be altered from the browser.", st_body),
]
plans = [
    ["Plan", "Duration", "Price", "Payable incl. 18% GST"],
    ["Plan 1", "10 days access", "₹499.00", "₹588.82"],
    ["Plan 2", "30 days access", "₹599.00", "₹706.82"],
    ["Plan 3", "60 days access", "₹699.00", "₹824.82"],
]
E += [table(plans, [30 * mm, 40 * mm, 35 * mm, PAGE_W - 2 * MARGIN - 105 * mm]),
      Spacer(1, 4),
      Paragraph("Enrolment expiry is calculated from the moment access is granted. "
                "Plan pricing is managed in code and applied at both order creation "
                "and payment verification, so a tampered browser request cannot "
                "purchase an expensive plan at a cheap plan's price.", st_note),
      Spacer(1, 6)]

E += [
    Paragraph("4.4  The examination engine", st_h2),
    Paragraph(
        "The examination interface is modelled on real CBT test-centre software. "
        "Candidates get the same navigation grammar they will encounter on exam day.", st_body),
    Paragraph("Navigation and answering", st_h3),
]
E += bullets([
    "Four-state question palette: not visited, visited but unanswered, answered, and marked for review — matching official CBT conventions.",
    "Jump-to-question grid alongside sequential next/previous movement.",
    "Mark for review, which also advances to the next question.",
    "A countdown timer on certification examinations, formatted to the second.",
    "Every answer is saved as it is selected, both to the server and to a local backup in the browser.",
])
E += [Paragraph("Two examination modes", st_h3)]
modes = [
    ["", "Practice mode", "Certification mode"],
    ["Purpose", "Learning and reinforcement.", "Realistic examination rehearsal."],
    ["Timer", "Untimed.", "Enforced countdown; automatic submission at zero."],
    ["Feedback", "Immediate — the correct answer and its explanation are revealed once an option is chosen, and the answer then locks.",
     "None during the exam; results are computed after submission."],
    ["Grading", "Computed in the browser for instant feedback.", "Computed on the server against an answer key the browser never receives."],
    ["Answer key", "Released to signed-in candidates as part of the learning flow.", "Never transmitted to the browser under any circumstances."],
]
E += [table(modes, [22 * mm, 72 * mm, PAGE_W - 2 * MARGIN - 94 * mm]), Spacer(1, 6)]

E += [
    Paragraph("4.5  Examination integrity controls", st_h2),
    Paragraph(
        "Certification attempts run under an enforced integrity regime. These "
        "controls raise the effort required to cheat substantially; they are "
        "deterrent and detection measures, not a claim of absolute prevention on "
        "candidate-owned hardware.", st_body),
]
integrity = [
    ["Control", "Behaviour"],
    ["Fullscreen enforcement", "The exam enters fullscreen on start. Leaving fullscreen registers a strike."],
    ["Focus monitoring", "Switching tabs or minimising the window registers a strike."],
    ["Three-strike rule", "Each strike raises a blocking warning with a 15-second countdown that the candidate must acknowledge to continue. A third strike, or letting a countdown expire, ends the attempt immediately and submits it as disqualified."],
    ["Content protection", "Right-click, text selection, copy and cut are disabled during an attempt."],
    ["Shortcut suppression", "Developer-tools and print/copy shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+P, Ctrl+C, Ctrl+X) are intercepted."],
    ["Server-side grading", "Certification scores are computed on the server from a protected answer key, so a manipulated browser cannot award itself marks."],
    ["Attempt ceiling", "A maximum of 10 completed attempts per candidate per test, enforced on the server."],
    ["Resubmission lock", "Once an attempt is submitted it is permanently sealed and cannot be re-scored or edited."],
]
E += [table(integrity, [42 * mm, PAGE_W - 2 * MARGIN - 42 * mm]), Spacer(1, 4)]
E += [callout("Administrator and editor preview",
              "Staff previewing an examination are exempt from the disconnect "
              "enforcement described in section 6, and see an on-screen preview "
              "banner so a review session is never mistaken for a live attempt."),
      Spacer(1, 5)]

E += [
    Paragraph("4.6  Payments, billing and GST", st_h2),
    Paragraph(
        "Checkout is handled by Razorpay, supporting UPI (including QR and app "
        "hand-off), credit and debit cards, and net banking, inside a secure overlay "
        "on the site.", st_body),
]
E += bullets([
    "Prices, discounts and GST are calculated on the server; the browser cannot influence the amount charged.",
    "Coupon engine with percentage discounts, activation flags, expiry and redemption caps. Redemption counts are updated atomically, so a limited coupon cannot be over-redeemed by simultaneous checkouts.",
    "A 100% discount is granted directly without a payment round-trip.",
    "Payment authenticity is verified cryptographically, and the plan and course granted are read from the order record held by the payment gateway rather than from the browser request.",
    "Access is granted only once the gateway confirms funds are captured — an authorised-but-uncaptured payment does not unlock content.",
    "A GST-itemised invoice is emailed automatically on successful enrolment, exactly once per order.",
    "Every order is written to an administrator-visible ledger with its status and how access was granted.",
])
E += [Spacer(1, 6)]

E += [
    Paragraph("4.7  Administration console", st_h2),
]
E += bullets([
    "Overview dashboard: total registered users, active enrolments and net revenue.",
    "User directory with per-candidate enrolment counts.",
    "Order ledger covering created, successful, bypassed and refunded orders.",
    "Account actions: suspend, reactivate, and revoke access to a specific course.",
    "Revoking a course also marks the associated successful orders as refunded, preserving an audit trail.",
    "On-demand reconciliation sweep that re-checks unresolved orders against the payment gateway and grants any access that was paid for but never completed in the browser (up to 50 orders per run).",
])
E += [Spacer(1, 6)]

E += [
    Paragraph("4.8  Content and examination authoring", st_h2),
]
E += bullets([
    "Course, chapter and mock-test creation with publish control — unpublished material is not reachable by candidates.",
    "Question-bank editor with per-question options, correct answer and explanation.",
    "Bulk import of questions from Microsoft Word documents, parsed automatically into the question bank.",
    "Per-test configuration of duration, question count and mode (practice or certification).",
    "For certification tests, correct answers and explanations are stripped from the candidate payload at save time and stored separately.",
])
E += [Spacer(1, 6)]

E += [
    Paragraph("4.9  Transactional email", st_h2),
    Paragraph(
        "Enrolment confirmation and GST invoice emails are dispatched automatically "
        "on successful payment, addressed to the candidate's registered email and "
        "itemised with base price, GST and total. Invoice dispatch is tied to the "
        "same one-time guarantee as the enrolment itself, so a retried or duplicated "
        "payment notification cannot produce a second invoice.", st_body),
    Spacer(1, 5),
]

# ================================================================ 5
E += [
    Paragraph("5. Security posture", st_h1),
    Paragraph(
        "The platform is built on the principle that the browser is untrusted. Every "
        "decision that affects money or marks is taken on the server.", st_body),
]
sec = [
    ["Layer", "Measure"],
    ["Identity", "Managed authentication provider; every protected API call carries a verified identity token, re-checked server-side on each request."],
    ["Authorisation", "Ownership and role checks on the server for payment status, examination submission, and all administrative actions."],
    ["Data access", "Database rules prevent candidates from altering their own role, enrolments, lifetime spend or suspension status, and restrict examination content to entitled users."],
    ["Payments", "Cryptographic signature verification with constant-time comparison on both the checkout callback and the gateway webhook; gateway-held order metadata is treated as the source of truth."],
    ["Transport &amp; headers", "Enforced HTTPS with strict transport security, content security policy, clickjacking protection, MIME-sniffing protection, referrer policy, and a restrictive permissions policy."],
    ["Abuse control", "Request rate limiting on payment and administrative endpoints."],
    ["Secrets", "All credentials held as environment configuration; none are present in the codebase or shipped to the browser."],
]
E += [table(sec, [34 * mm, PAGE_W - 2 * MARGIN - 34 * mm]), Spacer(1, 6)]

# ================================================================ 6
E += [
    Paragraph("6. Failure handling and fallbacks", st_h1),
    Paragraph(
        "This section states the platform's guaranteed behaviour when things go "
        "wrong. It is organised by the scenario a candidate or operator would "
        "actually observe.", st_body),
    Spacer(1, 3),
    Paragraph("6.1  Payment and checkout", st_h2),
]
pay_fail = [
    ["Scenario", "Platform behaviour"],
    ["Candidate closes the payment window without paying",
     "The pending order is discarded and the candidate is returned to a normal checkout page. No warning, no charge, no access."],
    ["Payment genuinely fails, and it is unclear whether funds moved",
     "The candidate sees a holding screen that explicitly tells them not to pay again, explains that access will be granted automatically if money did leave their account, and offers a re-check button. Access is never granted on an unconfirmed payment, and the candidate is never told to retry a payment that may have succeeded."],
    ["Browser or tab is closed immediately after paying",
     "The order reference is preserved. On returning to checkout the platform re-checks the payment with the gateway and grants access if it succeeded."],
    ["Payment succeeds but the confirmation call back to the site fails",
     "The gateway webhook grants access independently. The candidate does not need to do anything."],
    ["Webhook is delayed or never arrives",
     "Three further nets exist: the candidate's own re-check button, the automatic re-check on returning to checkout, and the administrator reconciliation sweep."],
    ["The same payment notification is delivered more than once",
     "Enrolment, revenue totals and invoice email are all governed by a single one-time guarantee keyed to the order. Duplicates are recognised and ignored."],
    ["Candidate double-clicks the pay button",
     "Blocked twice over: an immediate click lock in the interface, and server-side reuse of the existing open order rather than creating a second one."],
    ["Candidate returns with an order from a superseded gateway configuration",
     "The order is recognised as no longer applicable and cleared silently, rather than trapping the candidate on a confirmation screen."],
    ["Candidate is certain they never paid",
     "An explicit opt-out on the holding screen lets them clear the pending order and start again. It is deliberate and manual, so it cannot mask a real in-flight payment."],
]
E += [table(pay_fail, [52 * mm, PAGE_W - 2 * MARGIN - 52 * mm]), Spacer(1, 6)]

E += [callout("The controlling principle",
              "Course access is only ever granted after the payment gateway itself "
              "confirms that funds were captured. A cancelled, failed, abandoned or "
              "merely authorised payment never unlocks content — and equally, a "
              "payment that did succeed is never silently lost, because four "
              "independent mechanisms can recover it."),
      Spacer(1, 5)]

E += [
    Paragraph("6.2  Examinations", st_h2),
]
exam_fail = [
    ["Scenario", "Platform behaviour"],
    ["Browser crashes or the tab is closed mid-exam",
     "Answers and review marks are continuously mirrored to local browser storage and to the server. On return, the in-progress attempt is restored with answers intact."],
    ["Network connection drops mid-exam",
     "The attempt survives. A heartbeat records activity every ten seconds; the candidate may reconnect and continue."],
    ["Disconnection exceeds 15 minutes",
     "The attempt is finalised and counted as one used attempt, with a clear on-screen explanation. This mirrors real test-centre regulation."],
    ["Timer reaches zero on a certification exam",
     "The attempt is submitted automatically with whatever has been answered."],
    ["Three integrity strikes are accumulated",
     "The attempt is ended and submitted immediately, and recorded as disqualified."],
    ["Candidate tries to submit the same attempt twice",
     "Rejected on the server; a completed attempt is permanently sealed."],
    ["Candidate exceeds the attempt ceiling",
     "Blocked on the server before grading, with a clear message."],
    ["Stale local data from an abandoned session",
     "Detected and cleared automatically, so a candidate is never wrongly locked out by leftover browser state."],
    ["Exam content fails to load or is unpublished",
     "A clear error screen with a route back to the dashboard, rather than a blank page."],
]
E += [table(exam_fail, [52 * mm, PAGE_W - 2 * MARGIN - 52 * mm]), Spacer(1, 6)]

E += [
    Paragraph("6.3  Account and application", st_h2),
]
acct_fail = [
    ["Scenario", "Platform behaviour"],
    ["Credentials used on a second device",
     "The earlier session is signed out in real time with a security notice."],
    ["Account suspended by an administrator",
     "The candidate is signed out immediately, and both new purchases and exam submissions are refused server-side."],
    ["Unexpected application error on any page",
     "A global error screen is shown with a retry action and a route back to the dashboard, instead of a broken or blank page."],
    ["Page or record not found",
     "A dedicated not-found page with navigation back into the product."],
    ["Slow connection",
     "Progress indication on navigation and in-flight actions; buttons disable while working to prevent duplicate submissions."],
]
E += [table(acct_fail, [52 * mm, PAGE_W - 2 * MARGIN - 52 * mm]), Spacer(1, 6)]

# ================================================================ 7
E += [
    Paragraph("7. Operational runbook", st_h1),
    Paragraph("Common support situations and the action available to an administrator.", st_body),
]
run = [
    ["Situation", "Action"],
    ["Candidate paid but reports no access",
     "Run the reconciliation sweep from the admin console. It re-checks unresolved orders directly with the payment gateway and grants any access that was genuinely paid for. Check the order ledger to confirm."],
    ["Candidate requests a refund",
     "Issue the refund in the Razorpay dashboard, then use Revoke Course in the admin console to withdraw access. The associated order is marked refunded automatically for the audit trail."],
    ["Suspected account sharing",
     "Session control already limits an account to one device at a time. For repeat abuse, suspend the account; it takes effect immediately."],
    ["Candidate disqualified and disputes it",
     "The attempt record retains the submitted answers and score. Attempts are capped at ten per test, so a further attempt is normally available."],
    ["Candidate locked out by the 15-minute disconnect rule",
     "The attempt is final by design. Remaining attempts, if any, can be used immediately."],
    ["Pricing or plan change required",
     "Plan pricing is code-managed and applied server-side; changes are made by the development team and deployed. This is deliberate — it removes any path for prices to be altered from a browser."],
]
E += [table(run, [46 * mm, PAGE_W - 2 * MARGIN - 46 * mm]), Spacer(1, 6)]

# ================================================================ 8
E += [
    Paragraph("8. Manual processes and boundaries", st_h1),
    Paragraph(
        "Stated plainly, so expectations are accurate. None of the following affects "
        "the correctness of payments or grading; they describe where a human step is "
        "required.", st_body),
]
E += bullets([
    "<b>Refunds are operator-initiated.</b> A refund issued in the payment gateway does not automatically withdraw platform access; an administrator performs the revoke action, which also records the refund against the order.",
    "<b>Plan pricing is deployed, not edited live.</b> Prices live in code and are applied server-side, by design.",
    "<b>Examination integrity is deterrent, not absolute.</b> On candidate-owned hardware, browser-based controls raise the cost of cheating and record violations; they cannot guarantee prevention the way a supervised test centre can.",
    "<b>Reconciliation is on demand.</b> The sweep is triggered by an administrator rather than running on a schedule, and processes up to 50 unresolved orders per run.",
    "<b>Practice results are informational.</b> Practice-mode scores are graded in the browser to give instant feedback; certification results are the authoritative, server-graded record.",
])
E += [
    Spacer(1, 6),
    h_rule(),
    Paragraph(
        "This document describes the platform as deployed at the time of writing. "
        "Capabilities and safeguards described here are implemented in the live "
        "system.", st_note),
]

doc.build(E)
print("WROTE", OUT, os.path.getsize(OUT), "bytes")
