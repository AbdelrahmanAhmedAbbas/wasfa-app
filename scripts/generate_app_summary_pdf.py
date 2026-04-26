from __future__ import annotations

from pathlib import Path

import fitz
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import KeepInFrame, Paragraph, Spacer
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PDF = ROOT / "output" / "pdf" / "meal-planner-app-summary.pdf"
OUTPUT_PNG = ROOT / "tmp" / "pdfs" / "meal-planner-app-summary-page-1.png"


APP_NAME = "Wasfa (meal-planner)"
TAGLINE = "One-page repo summary generated from code, configs, migrations, and docs in this repository."

WHAT_IT_IS = (
    "Wasfa is an Expo/React Native mobile app for saving and organizing cooking recipes. "
    "It combines social-link recipe import, folders, grocery-list generation, onboarding, "
    "and English/Arabic support with guest mode or Google sign-in."
)

WHO_ITS_FOR = (
    "Primary persona: home cooks who save recipes from Instagram or TikTok and want them "
    "organized in a bilingual mobile app with shopping-list support."
)

WHAT_IT_DOES = [
    "Supports guest mode plus Google sign-in, with persisted Supabase sessions.",
    "Runs an onboarding flow for diet, allergies, referral source, age, measurement system, and nutrition-display preferences.",
    "Accepts shared or pasted recipe links and creates import jobs from the app.",
    "Polls import status, applies localized recipe text, and confirms recipe drafts into saved recipes.",
    "Organizes saved recipes into folders and searchable recipe-library views.",
    "Shows recipe details with ingredients, steps, source link, delete action, and add-to-shopping-list action.",
    "Builds a grocery list from recipe ingredients, groups similar items, and lets users check or remove entries.",
]

HOW_IT_WORKS = [
    "UI and navigation: Expo Router screens under app/ with tabs for recipes, grocery, planner, profile, plus import and recipe-detail routes.",
    "Cross-cutting providers: Root layout wires ShareIntentProvider, LanguageProvider, and AuthProvider before navigation.",
    "Local state and persistence: AsyncStorage stores auth session, language, onboarding progress/answers, and import client ID.",
    "Backend data access: Supabase JS clients read/write recipes, recipe_folders, shopping_list_items, and onboarding_profiles.",
    "Import pipeline: share or paste flow calls Supabase Edge functions import-create, import-share, import-status, and import-confirm.",
    "Data flow: import_jobs -> recipe_drafts -> recipes/job_events in Postgres; functions README says drafts store localized en/ar text and use OpenRouter plus Apify fallback.",
]

HOW_TO_RUN = [
    "npm install",
    "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env; without real values the repo warns that auth will not work, but guest mode remains usable.",
    "If you want the import pipeline/backend too: run supabase db push and deploy the four import functions documented in supabase/functions/README.md.",
    "npm start, then npm run ios or npm run android",
]

NOT_FOUND = [
    "Production deployment workflow beyond local/dev setup: Not found in repo.",
]


def section_title(text: str) -> Paragraph:
    return Paragraph(text.upper(), STYLES["section"])


def body_paragraph(text: str) -> Paragraph:
    return Paragraph(text, STYLES["body"])


def bullet_paragraph(text: str) -> Paragraph:
    return Paragraph(f"<bullet>&bull;</bullet>{text}", STYLES["bullet"])


def build_column(content: list[object]) -> KeepInFrame:
    return KeepInFrame(COLUMN_WIDTH, COLUMN_HEIGHT, content, mode="shrink")


def add_section(story: list[object], heading: str, text: str | None = None, bullets: list[str] | None = None) -> None:
    story.append(section_title(heading))
    story.append(Spacer(1, 4))
    if text:
        story.append(body_paragraph(text))
        story.append(Spacer(1, 8))
    if bullets:
        for item in bullets:
            story.append(bullet_paragraph(item))
            story.append(Spacer(1, 3))
        story.append(Spacer(1, 6))


def build_pdf() -> None:
    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PNG.parent.mkdir(parents=True, exist_ok=True)

    c = canvas.Canvas(str(OUTPUT_PDF), pagesize=letter)
    page_w, page_h = letter

    c.setTitle("Meal Planner App Summary")

    c.setFillColor(colors.HexColor("#F3F0E8"))
    c.roundRect(28, page_h - 118, page_w - 56, 78, 18, fill=1, stroke=0)

    c.setFillColor(colors.HexColor("#22412D"))
    c.setFont("Helvetica-Bold", 23)
    c.drawString(46, page_h - 74, APP_NAME)

    c.setFillColor(colors.HexColor("#506255"))
    c.setFont("Helvetica", 9.5)
    c.drawString(46, page_h - 92, fit_text(TAGLINE, page_w - 120, "Helvetica", 9.5))

    c.setStrokeColor(colors.HexColor("#D8D2C4"))
    c.setLineWidth(1)
    c.line(page_w / 2, 74, page_w / 2, page_h - 138)

    left_story: list[object] = []
    right_story: list[object] = []

    add_section(left_story, "What It Is", text=WHAT_IT_IS)
    add_section(left_story, "Who It's For", text=WHO_ITS_FOR)
    add_section(left_story, "What It Does", bullets=WHAT_IT_DOES)

    add_section(right_story, "How It Works", bullets=HOW_IT_WORKS)
    add_section(right_story, "How to Run", bullets=HOW_TO_RUN)
    add_section(right_story, "Not Found in Repo", bullets=NOT_FOUND)

    left_box = build_column(left_story)
    right_box = build_column(right_story)

    _, left_h = left_box.wrapOn(c, COLUMN_WIDTH, COLUMN_HEIGHT)
    left_box.drawOn(c, LEFT_X, COLUMN_TOP - left_h)

    _, right_h = right_box.wrapOn(c, COLUMN_WIDTH, COLUMN_HEIGHT)
    right_box.drawOn(c, RIGHT_X, COLUMN_TOP - right_h)

    c.setFillColor(colors.HexColor("#6A7269"))
    c.setFont("Helvetica", 7.5)
    footer = (
        "Evidence used: package.json, QUICK_START.md, .env.example, app/*, lib/*, "
        "supabase/migrations/*, and supabase/functions/README.md."
    )
    c.drawString(36, 30, fit_text(footer, page_w - 72, "Helvetica", 7.5))

    c.showPage()
    c.save()


def fit_text(text: str, max_width: float, font_name: str, font_size: float) -> str:
    current = text
    while stringWidth(current, font_name, font_size) > max_width and len(current) > 3:
        current = current[:-4].rstrip() + "..."
    return current


def verify_pdf() -> None:
    reader = PdfReader(str(OUTPUT_PDF))
    if len(reader.pages) != 1:
        raise RuntimeError(f"Expected 1 page, found {len(reader.pages)}")


def render_preview() -> None:
    doc = fitz.open(str(OUTPUT_PDF))
    try:
      page = doc.load_page(0)
      pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
      pix.save(str(OUTPUT_PNG))
    finally:
      doc.close()


def main() -> None:
    build_pdf()
    verify_pdf()
    render_preview()
    print(OUTPUT_PDF)
    print(OUTPUT_PNG)


STYLES = getSampleStyleSheet()
STYLES.add(
    ParagraphStyle(
        name="section",
        fontName="Helvetica-Bold",
        fontSize=9.4,
        leading=10,
        textColor=colors.HexColor("#2E5A3E"),
        spaceAfter=0,
    )
)
STYLES.add(
    ParagraphStyle(
        name="body",
        fontName="Helvetica",
        fontSize=8.8,
        leading=11,
        textColor=colors.HexColor("#20241E"),
        spaceAfter=0,
    )
)
STYLES.add(
    ParagraphStyle(
        name="bullet",
        parent=STYLES["body"],
        leftIndent=10,
        firstLineIndent=-8,
        bulletIndent=0,
        bulletFontName="Helvetica",
        bulletFontSize=9,
        spaceAfter=0,
    )
)

PAGE_W, PAGE_H = letter
MARGIN = 36
GAP = 22
COLUMN_TOP = PAGE_H - 152
COLUMN_BOTTOM = 56
COLUMN_HEIGHT = COLUMN_TOP - COLUMN_BOTTOM
COLUMN_WIDTH = (PAGE_W - (MARGIN * 2) - GAP) / 2
LEFT_X = MARGIN
RIGHT_X = MARGIN + COLUMN_WIDTH + GAP


if __name__ == "__main__":
    main()
