# -*- coding: utf-8 -*-
"""Builds the short daily update PDF — one page, what changed that day.

Deliberately plainer than build_progress_update.py: no cover, no tables, no
status columns. That document is the considered summary of a round of work;
this is a note saying what happened today, and it stops being useful the moment
it needs a contents page.

Regenerated in place. What we said on any given day is the diff on this file.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "MyExams365-Daily-Update.pdf")

DATE = "27 August 2026"

# ---------------------------------------------------------------- fonts
FONT, FONT_B = "Helvetica", "Helvetica-Bold"
try:
    win = r"C:\Windows\Fonts"
    pdfmetrics.registerFont(TTFont("Arial", os.path.join(win, "arial.ttf")))
    pdfmetrics.registerFont(TTFont("Arial-Bold", os.path.join(win, "arialbd.ttf")))
    from reportlab.pdfbase.pdfmetrics import registerFontFamily
    registerFontFamily("Arial", normal="Arial", bold="Arial-Bold")
    FONT, FONT_B = "Arial", "Arial-Bold"
except Exception as e:      # pragma: no cover
    print("Font fallback:", e)

# ---------------------------------------------------------------- palette
INK      = colors.HexColor("#12141A")
SLATE    = colors.HexColor("#3F4652")
MUTED    = colors.HexColor("#6B7280")
AMBER    = colors.HexColor("#B4780A")
RULE     = colors.HexColor("#DFE3EA")
GREEN    = colors.HexColor("#0F7A54")
BLUE     = colors.HexColor("#1F5FA8")
BLUE_BG  = colors.HexColor("#EDF3FA")

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm
COL_W = PAGE_W - 2 * MARGIN


def S(name, **kw):
    base = dict(name=name, fontName=FONT, fontSize=10, leading=15,
                textColor=SLATE, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(**base)


st_title  = S("t",  fontName=FONT_B, fontSize=20, leading=25, textColor=INK)
st_date   = S("d",  fontSize=11, leading=15, textColor=MUTED)
st_h1     = S("h1", fontName=FONT_B, fontSize=12.5, leading=16, textColor=INK,
              spaceBefore=10, spaceAfter=4)
st_body   = S("b",  spaceAfter=4)
st_label  = S("l",  fontName=FONT_B, fontSize=9, leading=13, textColor=AMBER,
              spaceBefore=3)
st_note   = S("n",  fontSize=9, leading=13, textColor=MUTED)


def h_rule(space_after=8):
    t = Table([[""]], colWidths=[COL_W], rowHeights=[0.1])
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.6, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), space_after),
    ]))
    return t


def note_box(text):
    t = Table([[Paragraph(text, st_note)]], colWidths=[COL_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BLUE_BG),
        ("LINEBEFORE", (0, 0), (0, -1), 2.2, BLUE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def item(reported, cause, fixed):
    return [
        Paragraph("WHAT YOU REPORTED", st_label),
        Paragraph(reported, st_body),
        Paragraph("WHY IT HAPPENED", st_label),
        Paragraph(cause, st_body),
        Paragraph("WHAT WE CHANGED", st_label),
        Paragraph('<font color="#0F7A54">' + fixed + '</font>', st_body),
    ]


def page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT, 7.8)
    canvas.drawString(MARGIN, 11.5 * mm, "MentraEdge \u2014 MyExams365")
    canvas.drawRightString(PAGE_W - MARGIN, 11.5 * mm, DATE)
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 15.5 * mm, PAGE_W - MARGIN, 15.5 * mm)
    canvas.restoreState()


doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=MARGIN, rightMargin=MARGIN,
                      topMargin=MARGIN, bottomMargin=MARGIN,
                      title="MyExams365 \u2014 Update, " + DATE,
                      author="MentraEdge",
                      subject="Daily update")
doc.addPageTemplates([PageTemplate(
    id="Body",
    frames=[Frame(MARGIN, MARGIN, COL_W, PAGE_H - 2 * MARGIN - 6 * mm, showBoundary=0)],
    onPage=page)])

E = [
    Paragraph("What we did today", st_title),
    Spacer(1, 3),
    Paragraph(DATE, st_date),
    Spacer(1, 10),
    h_rule(),
    Paragraph(
        "You reported two problems from a phone. Both are fixed and are now live on the site.", st_body),
    Spacer(1, 4),
]

E += [Paragraph("1. The timer started again from the beginning", st_h1)]
E += item(
    "On a phone, leaving Chrome and coming back to the exam restarted the clock "
    "from the full duration. Answers were still there. On a laptop it never happened.",

    "The remaining time was only held in the page itself, never saved. A laptop keeps "
    "the page open, so the clock kept counting. A phone closes the page when you switch "
    "away, so returning loaded a brand-new page \u2014 and it started the clock over. Answers "
    "were unaffected because those are saved as you work.",

    "The clock is now worked out from the time the exam actually started, so it picks up "
    "exactly where it left off however many times the page is reopened. If the time has "
    "already run out, the paper is submitted rather than reopened.",
)
E += [
    Spacer(1, 2),
    Paragraph(
        "Worth knowing: this also closed a way of getting extra time on any device, not just "
        "a phone \u2014 closing and reopening the exam gave a full clock every time.", st_note),
    Spacer(1, 4),
]

E += [Paragraph("2. The Submit button was off the edge of the screen", st_h1)]
E += item(
    "On a phone the Submit Exam button could not be seen, so there was no way to hand "
    "the paper in.",

    "The bar along the top of the exam holds the exam name, the warning counter, the clock, "
    "the calculator and the Submit button, all on one line. On a phone that line was 92 "
    "pixels wider than the screen, and Submit \u2014 being last \u2014 was the part pushed off the "
    "right-hand edge.",

    "The exam name is now shortened to fit, and the Submit button is the last thing that "
    "gives way rather than the first. Measured on a 375-pixel phone screen before and after: "
    "the bar overflowed by 92 pixels, and now fits with room to spare.",
)

E += [
    Spacer(1, 10),
    h_rule(),
    note_box(
        "<b>Now live.</b> Both fixes are on the site, released together with the changes "
        "covered in the 23 August update — discount codes usable once per person, and the "
        "new attempt limits of three sittings on an Exam Mode paper and ten on a practice test."),
]

doc.build(E)
print("WROTE", OUT, os.path.getsize(OUT), "bytes")
