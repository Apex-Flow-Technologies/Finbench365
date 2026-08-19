# -*- coding: utf-8 -*-
"""Builds the MyExams365 client progress update PDF.

Shares the visual language of build_guide.py deliberately — same palette,
same chrome — so the two documents read as coming from one company.

The report is regenerated from this file rather than edited as a PDF, so a
correction to what was delivered is a diff rather than a new binary nobody
can review.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, NextPageTemplate,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "MyExams365-Progress-Update.pdf")

DATE = "20 August 2026"

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
GREEN_BG = colors.HexColor("#EAF6F1")

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm
COL_W = PAGE_W - 2 * MARGIN

# ---------------------------------------------------------------- styles
ss = getSampleStyleSheet()


def S(name, **kw):
    base = dict(name=name, fontName=FONT, fontSize=9.5, leading=14,
                textColor=SLATE, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(**base)


st_title  = S("t",  fontName=FONT_B, fontSize=27, leading=32, textColor=INK)
st_sub    = S("st", fontSize=12.5, leading=18, textColor=MUTED)
st_h1     = S("h1", fontName=FONT_B, fontSize=14, leading=18, textColor=INK,
              spaceBefore=2, spaceAfter=5)
st_body   = S("b",  spaceAfter=4)
st_bullet = S("bu", leftIndent=11, bulletIndent=2, spaceAfter=3)
st_cell   = S("c",  fontSize=8.6, leading=11.8)
st_cell_b = S("cb", fontSize=8.6, leading=11.8, fontName=FONT_B, textColor=INK)
st_cell_h = S("ch", fontSize=8.3, leading=11, fontName=FONT_B, textColor=colors.white)
st_note   = S("n",  fontSize=8.7, leading=12.5, textColor=MUTED)
st_kicker = S("k",  fontName=FONT_B, fontSize=8, leading=11, textColor=AMBER)


def bullets(items, style=st_bullet):
    return [Paragraph(t, style, bulletText="\u2022") for t in items]


def h_rule(color=RULE, thick=0.6, space_before=0, space_after=6):
    t = Table([[""]], colWidths=[COL_W], rowHeights=[0.1])
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), thick, color),
        ("TOPPADDING", (0, 0), (-1, -1), space_before),
        ("BOTTOMPADDING", (0, 0), (-1, -1), space_after),
    ]))
    return t


def table(rows, widths, header=True, zebra=True):
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


def callout(title, body, accent=AMBER, bg=AMBER_BG):
    inner = [[Paragraph(title, ParagraphStyle("ct", parent=st_kicker, textColor=accent))],
             [Paragraph(body, ParagraphStyle("cbdy", parent=st_note, textColor=SLATE))]]
    t = Table(inner, colWidths=[COL_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 2.2, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (0, 0), 8),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (0, 0), 2),
        ("TOPPADDING", (0, -1), (-1, -1), 0),
    ]))
    return t


def before_after(before, after):
    """The two-line 'Before / Now' pattern used throughout the first report."""
    return [
        Paragraph('<font color="#6B7280"><b>Before:</b></font> ' + before, st_body),
        Paragraph('<font color="#0F7A54"><b>Now:</b></font> ' + after, st_body),
    ]


# ---------------------------------------------------------------- chrome
def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(INK)
    canvas.rect(0, PAGE_H - 78 * mm, PAGE_W, 78 * mm, stroke=0, fill=1)
    canvas.setFillColor(AMBER)
    canvas.rect(0, PAGE_H - 79.6 * mm, PAGE_W, 1.6 * mm, stroke=0, fill=1)
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
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT, 8)
    canvas.drawString(MARGIN, 14 * mm, "Confidential \u2014 prepared for client review")
    canvas.restoreState()


def content_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT, 7.8)
    canvas.drawString(MARGIN, PAGE_H - 12 * mm,
                      "MyExams365 \u2014 Progress Update, " + DATE)
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
                      title="MyExams365 \u2014 Progress Update, " + DATE,
                      author="MentraEdge",
                      subject="Changes delivered against client testing feedback")

cover_frame = Frame(MARGIN, MARGIN, COL_W, PAGE_H - 2 * MARGIN - 62 * mm,
                    id="cover", showBoundary=0)
body_frame = Frame(MARGIN, MARGIN, COL_W, PAGE_H - 2 * MARGIN - 6 * mm,
                   id="body", showBoundary=0)
doc.addPageTemplates([
    PageTemplate(id="Cover", frames=[cover_frame], onPage=cover_page),
    PageTemplate(id="Body", frames=[body_frame], onPage=content_page),
])

E = []

# ================================================================ COVER
E += [
    Spacer(1, 26 * mm),
    Paragraph("PROGRESS UPDATE", st_kicker),
    Spacer(1, 4),
    Paragraph("Changes delivered<br/>against your testing", st_title),
    Spacer(1, 7),
    Paragraph("What you raised, what was changed, and what it means for "
              "candidates and for revenue.", st_sub),
    Spacer(1, 12),
    h_rule(),
    Spacer(1, 4),
]

meta = [
    ["Product", "MyExams365 \u2014 institutional CBT examination &amp; preparation platform"],
    ["Operator", "MentraEdge Academy LLP"],
    ["Document", "Progress update against client testing feedback"],
    ["Date", DATE],
    ["Supersedes", "Progress Update, 19 August 2026"],
]
E += [table([["Field", "Detail"]] + meta, [34 * mm, COL_W - 34 * mm]), Spacer(1, 8)]

E += [callout(
    "WHAT CHANGED SINCE THE 19 AUGUST UPDATE",
    "Point 1 has been extended. Discount codes were limited to a single exam; they can "
    "now be limited to any combination of exams. The related checkout behaviour was "
    "corrected at the same time. Points 2 to 4 are unchanged from the previous update "
    "and are restated here so this document stands on its own.")]

E += [NextPageTemplate("Body")]
from reportlab.platypus import PageBreak
E += [PageBreak()]

# ================================================================ 1
E += [
    Paragraph("1. Discount codes can be limited to the exams you choose", st_h1),
]
E += before_after(
    "A code worked on every exam in the portal, so a discount meant for one exam "
    "could be used against any of them.",
    "When you create a code you tick the exams it applies to \u2014 one, several, or all "
    "of them. A code is refused at checkout for any exam you did not tick.",
)
E += [
    Paragraph(
        "The earlier version of this change allowed one exam only, which covered the "
        "straightforward case but not a campaign spanning part of the catalogue. A "
        "code for two of four exams previously had to be issued either as two separate "
        "codes or as one unrestricted code that also discounted the exams it was not "
        "meant for.", st_body),
    Spacer(1, 3),
]
E += bullets([
    "The exam list is a set of tick boxes. Tick as many as apply; untick to remove one; a single control clears the lot back to <b>all exams</b>.",
    "The codes list shows exactly which exams each code covers, so scope is visible without opening anything.",
    "Leaving every box unticked means the code works across the whole catalogue \u2014 the behaviour every code had before scoping existed.",
    "Codes you created earlier are unaffected and keep working exactly as they do today.",
])
E += [
    Spacer(1, 4),
    callout(
        "WHERE THE LIMIT IS ENFORCED",
        "Scope is checked on the server when the order is created and priced \u2014 not in the "
        "browser. A code presented against an exam outside its scope is refused and the "
        "full price is charged, whatever the browser was showing. The same check runs "
        "when the code is applied in the order summary, so the figure a candidate is "
        "quoted and the figure charged at the gateway come from one decision rather "
        "than two that could drift apart.",
        accent=GREEN, bg=GREEN_BG),
    Spacer(1, 6),
]
E += [
    Paragraph("A related correction at checkout", st_h1),
]
E += before_after(
    "Moving between exams on the checkout page kept a discount that had been applied "
    "to the previous exam. The summary could therefore show a discount the payment "
    "step would not honour.",
    "Changing exam clears the applied discount and asks for the code to be checked "
    "again. The typed code is kept, so re-checking it is a single click.",
)
E += [
    Paragraph(
        "No candidate was ever charged less than the correct amount \u2014 the server "
        "priced the order correctly throughout. The fault was that the summary could "
        "promise a discount the payment step would then decline, so a candidate could "
        "be quoted one figure and billed another.", st_note),
    Spacer(1, 8),
]

# ================================================================ 2
E += [
    Paragraph("2. The plans page", st_h1),
]
E += bullets([
    "Every plan card now lights up when the mouse moves over it, not only when it is clicked.",
    "<b>\u201cMost Popular Choice\u201d is removed.</b> It is not a claim worth making while starting out, and highlighting one plan pushed the choice before the other two had been read.",
    "All three plans now look the same. The middle one is no longer enlarged or pre-selected.",
    "All three buttons read <b>Select Plan &amp; Checkout</b>.",
])
E += [Spacer(1, 8)]

# ================================================================ 3
E += [
    Paragraph("3. GST on the plans page", st_h1),
]
E += before_after(
    "The note at the bottom said prices were <b>inclusive</b> of 18% GST, while the "
    "plan cards themselves showed \u201c+ GST\u201d. The two contradicted each other.",
    "The cards were right, so the note was corrected. It now says prices exclude GST, "
    "that 18% is added at checkout, and that the total is shown before paying.",
)
E += [Spacer(1, 8)]

# ================================================================ 4
E += [
    Paragraph("4. Terms and Privacy pages", st_h1),
]
E += bullets([
    "The <b>Grievance Officer name</b> is removed from both pages. They were showing the unfilled placeholder \u201c[Grievance Officer Name]\u201d to anyone who read them.",
    "The registered address is now published in full on both pages.",
    "The contact email on both is now <b>support@myexams365.com</b>.",
    "The privacy page asked people to write to <b>privacy@myexams365.com</b> to withdraw consent. That mailbox does not exist, so those messages would have gone nowhere. It now points to support as well.",
])
E += [
    Spacer(1, 4),
    callout(
        "WORTH KNOWING",
        "Under the data protection rules the grievance address has to be one that "
        "actually receives complaints. Publishing an address that bounces is a "
        "compliance problem in itself, which is why all of these now point at a "
        "mailbox you read."),
    Spacer(1, 8),
]

# ================================================================ summary
E += [
    h_rule(),
    Paragraph("Summary of this update", st_h1),
]
E += [table([
    ["Item", "Status"],
    ["Discount codes limited to chosen exams", "Extended \u2014 any combination of exams, was one exam only"],
    ["Discount cleared when the exam changes at checkout", "New in this update"],
    ["Plans page \u2014 hover, equal cards, button wording", "Delivered, unchanged since 19 August"],
    ["Plans page \u2014 GST wording corrected", "Delivered, unchanged since 19 August"],
    ["Terms and Privacy \u2014 contacts and address", "Delivered, unchanged since 19 August"],
], [78 * mm, COL_W - 78 * mm]), Spacer(1, 8)]

E += [
    h_rule(),
    Paragraph(
        "This document describes the platform as deployed at the time of writing. "
        "Items marked delivered are implemented in the live system.", st_note),
]

doc.build(E)
print("WROTE", OUT, os.path.getsize(OUT), "bytes")
