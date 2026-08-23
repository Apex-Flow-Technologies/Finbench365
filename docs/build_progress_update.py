# -*- coding: utf-8 -*-
"""Builds the MyExams365 client progress update PDF.

Shares the visual language of build_guide.py deliberately — same palette,
same chrome — so the two documents read as coming from one company.

There is one current progress update, regenerated from this file rather than
edited as a PDF. What we told the client on any given date is then a reviewable
diff in version control instead of a binary nobody can read.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    PageBreak, NextPageTemplate,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "MyExams365-Progress-Update.pdf")

DATE = "23 August 2026"
SUPERSEDES = "Progress Update, 20 August 2026"

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
BLUE     = colors.HexColor("#1F5FA8")
BLUE_BG  = colors.HexColor("#EDF3FA")

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
st_h2     = S("h2", fontName=FONT_B, fontSize=10.5, leading=14, textColor=INK,
              spaceBefore=8, spaceAfter=3)
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
    """The two-line 'Before / Now' pattern used throughout these updates."""
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
                      subject="Changes delivered against client feedback")

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
    Paragraph("Coupon reuse, attempt<br/>limits, and study material", st_title),
    Spacer(1, 7),
    Paragraph("The three points you raised are built, tested and ready to go live.", st_sub),
    Spacer(1, 12),
    h_rule(),
    Spacer(1, 4),
]

meta = [
    ["Product", "MyExams365 \u2014 institutional CBT examination &amp; preparation platform"],
    ["Operator", "MentraEdge Academy LLP"],
    ["Document", "Progress update against client feedback"],
    ["Date", DATE],
    ["Supersedes", SUPERSEDES],
]
E += [table([["Field", "Detail"]] + meta, [34 * mm, COL_W - 34 * mm]), Spacer(1, 8)]

E += [callout(
    "STATUS",
    "Everything in this document is written and tested. It is not on the live site yet — "
    "we will confirm as soon as it has been deployed.",
    accent=BLUE, bg=BLUE_BG)]

E += [NextPageTemplate("Body"), PageBreak()]

# ================================================================ 1
E += [Paragraph("1. A discount code now works once per person", st_h1)]
E += before_after(
    "A code could be limited to a total number of uses, but nothing tied those uses to "
    "people. The same candidate could apply the same code again every time they came back.",
    "A code can be used once per email address, permanently. Presenting it a second time "
    "is refused and the full price is charged.",
)
E += [
    Paragraph(
        "This matters most at renewal. Buying again once access has run out is deliberately "
        "allowed \u2014 that is a renewal, and you want those. What was not intended is that the "
        "discount came back with it. A candidate on a 30-day plan holding a launch code was "
        "renewing at that discount every month, indefinitely, and a 100%-off code meant a free "
        "enrolment every time.", st_body),
    Spacer(1, 3),
]
E += bullets([
    "The record of having used a code outlives the access it bought. That is the whole point \u2014 expiry is exactly when the old behaviour paid out.",
    "It is checked when the code is applied and again when the order is priced, so the figure a candidate is quoted is the figure they are charged.",
    "Addresses are matched exactly. <b>alice@</b> and <b>alice+1@</b> count as two people. If you would rather treat those as one person, tell us and we will change it \u2014 it is a policy choice, not a technical limit.",
    "Nobody who has used a code in the past is affected. The rule applies from the day it goes live, as agreed.",
])
E += [
    Spacer(1, 4),
    callout(
        "WHERE THIS IS ENFORCED",
        "On the server, when the order is priced \u2014 never in the browser. A code presented against "
        "an address that has already used it is refused and full price is charged, whatever the "
        "page was showing. Two people checking out at the same instant with the same code and "
        "address cannot both slip through: the check and the record happen as one operation.",
        accent=GREEN, bg=GREEN_BG),
    Spacer(1, 4),
    Paragraph(
        "We also found and fixed a related fault while doing this work. A 100%-off enrolment could "
        "be triggered twice by a double click, which granted the course twice, counted two uses of "
        "the code and sent two invoice emails. It now resolves to a single enrolment.", st_note),
    Spacer(1, 8),
]

# ================================================================ 2
E += [Paragraph("2. Three attempts on the real exam, ten on practice", st_h1)]
E += before_after(
    "Every test allowed 10 attempts, and the limit was only applied when a paper was "
    "handed in.",
    "<b>Exam Mode</b> \u2014 the timed sitting with answers withheld \u2014 allows 3 attempts. "
    "<b>Practice Mode</b> keeps 10. The limit is applied before the candidate starts.",
)
E += [
    Paragraph(
        "You asked for the mode you already choose in the panel to decide this, and that is how "
        "it works: pick Exam Mode and the paper gets a timer and three attempts, pick Practice "
        "Mode and it gets no timer and ten.", st_body),
    Spacer(1, 3),
    Paragraph("Starting the exam is what uses an attempt", st_h2),
    Paragraph(
        "As you asked: pressing Start spends one. Running out of time and pressing submit both "
        "simply close the attempt that was already spent. The candidate is told this on the "
        "screen before they begin, and is shown how many they have left.", st_body),
]
E += bullets([
    "If a candidate's browser crashes or they close the tab, reopening puts them back into the <b>same</b> attempt. It does not cost them a second one.",
    "A candidate who has used all three is told so plainly, rather than being shown a button that does nothing.",
    "Staff previewing a paper are not limited, so you can keep testing your own exams.",
])
E += [
    Spacer(1, 4),
    callout(
        "A FAULT THIS REPLACES",
        "Until now the limit was only checked when a paper was submitted. A candidate could sit a "
        "full timed exam and be refused at the moment they handed it in, losing every answer, over "
        "a limit that could have been applied before they started. That is gone.",
        accent=GREEN, bg=GREEN_BG),
    Spacer(1, 8),
]

# ================================================================ 3
E += [Paragraph("3. Study material as PDF and Excel", st_h1)]
E += before_after(
    "Nothing. Spreadsheets already uploaded, downloaded and were labelled correctly \u2014 "
    "only the wording in the panel mentioned PDFs alone.",
    "The wording now says what it does. The button reads <b>Add study note</b> rather than "
    "<b>Add PDF</b>.",
)
E += [
    Paragraph(
        "Worth stating plainly so you can plan the content: PDF, Excel, Word, PowerPoint and plain "
        "links all upload today, up to 50 MB each. Excel files already show with a spreadsheet "
        "icon and are labelled \u201cExcel workbook\u201d for candidates. Access is still controlled per "
        "note, so you can restrict a file to the 60-day plan if you want to.", st_body),
    Spacer(1, 8),
]

E += [
    h_rule(),
    Paragraph(
        "This document describes changes that are complete and tested. We will confirm once "
        "they are live on the site.", st_note),
]

doc.build(E)
print("WROTE", OUT, os.path.getsize(OUT), "bytes")
