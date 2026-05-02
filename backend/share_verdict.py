"""One-page shareable verdict PDF with QR code for project URL."""
import io
from datetime import datetime
from typing import Dict, Any
import qrcode
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage,
)

PRIMARY = colors.HexColor("#1B4332")
GOLD = colors.HexColor("#D4A017")
ALERT = colors.HexColor("#C0392B")
WARN = colors.HexColor("#E67E22")
GREEN = colors.HexColor("#27AE60")
NAVY = colors.HexColor("#1A3C5E")
LIGHT_BG = colors.HexColor("#F5F9F5")

LEVEL_COLORS = {
    "conforme": GREEN,
    "attention": WARN,
    "grave": ALERT,
    "critique": ALERT,
}


def _qr_png_bytes(url: str) -> bytes:
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1B4332", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def generate_share_verdict(project: Dict[str, Any], report_data: Dict[str, Any],
                           share_url: str, user_email: str = "") -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=1.8 * cm, rightMargin=1.8 * cm,
        topMargin=1.8 * cm, bottomMargin=1.5 * cm,
        title=f"Verdict — {project.get('name','')}",
    )

    base = getSampleStyleSheet()
    styles = {
        "Hero": ParagraphStyle("Hero", parent=base["Title"], fontName="Helvetica-Bold",
                               fontSize=26, textColor=PRIMARY, alignment=TA_CENTER, leading=30),
        "Tagline": ParagraphStyle("Tag", parent=base["Normal"], fontName="Helvetica-Oblique",
                                   fontSize=10, textColor=GOLD, alignment=TA_CENTER, leading=13),
        "H2": ParagraphStyle("H2", parent=base["Heading2"], fontName="Helvetica-Bold",
                              fontSize=13, textColor=NAVY, leading=16, spaceBefore=8, spaceAfter=4),
        "Body": ParagraphStyle("Body", parent=base["BodyText"], fontName="Helvetica",
                                fontSize=10, leading=13),
        "Small": ParagraphStyle("Small", parent=base["BodyText"], fontName="Helvetica",
                                fontSize=8, textColor=colors.grey, leading=10, alignment=TA_CENTER),
        "Huge": ParagraphStyle("Huge", parent=base["Title"], fontName="Helvetica-Bold",
                                fontSize=72, leading=76, alignment=TA_CENTER),
    }

    summary = report_data.get("summary", {})
    counters = summary.get("compteurs", {})
    fin = summary.get("indicateurs_financiers", {})
    finr = report_data.get("financier") or {}
    niv = (summary.get("niveau_global") or "attention").lower()
    niv_color = LEVEL_COLORS.get(niv, WARN)

    story = []

    # Header
    story.append(Paragraph(f"<b>VERDICT — {project.get('name','')}</b>", styles["Hero"]))
    story.append(Paragraph(
        f"{project.get('country','')} · {project.get('sector','').capitalize()} · {project.get('resource_type','')}",
        styles["Body"]))
    story.append(Paragraph("La transparence contractuelle au service du peuple", styles["Tagline"]))
    story.append(Spacer(1, 0.5 * cm))

    # Big score
    score = summary.get("score_global", 0)
    score_para = ParagraphStyle("ScoreStyle", parent=styles["Huge"], textColor=niv_color)
    story.append(Paragraph(f"{score}<font size='28'> / 100</font>", score_para))
    story.append(Paragraph(
        f"<para alignment='center'><font size='14' color='{niv_color.hexval()}'>"
        f"<b>{niv.upper()}</b></font></para>", styles["Body"]))
    story.append(Spacer(1, 0.4 * cm))

    # 3 key alerts
    story.append(Paragraph("3 alertes phares", styles["H2"]))
    alerts = [
        ("Violations critiques", counters.get("violations_critiques", 0), ALERT),
        ("Violations graves", counters.get("violations_graves", 0), WARN),
        ("Clauses abusives", counters.get("clauses_abusives", 0), GOLD),
    ]
    alert_rows = [[
        Paragraph(f"<para alignment='center'><font size='9'>{a[0]}</font></para>", styles["Body"])
        for a in alerts
    ]]
    alert_rows.append([
        Paragraph(
            f"<para alignment='center'><font size='24' color='{a[2].hexval()}'><b>{a[1]}</b></font></para>",
            styles["Body"]) for a in alerts
    ])
    t_alerts = Table(alert_rows, colWidths=[5.7 * cm] * 3)
    t_alerts.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_BG),
    ]))
    story.append(t_alerts)
    story.append(Spacer(1, 0.4 * cm))

    # Impact financier
    mag_total_m = round((finr.get("manque_a_gagner_total", 0) or 0) / 1e6, 1)
    part_etat = finr.get("part_etat_pct", 0) or 0
    story.append(Paragraph("Impact économique", styles["H2"]))
    story.append(Paragraph(
        f"Part de l'État : <b>{part_etat}%</b> · "
        f"Manque à gagner total estimé : <font color='{ALERT.hexval()}'><b>{mag_total_m} M USD</b></font>",
        styles["Body"]))
    if finr.get("cadeau_fiscal"):
        story.append(Paragraph("<b><font color='#C0392B'>⚠ Cadeau fiscal détecté</font></b>", styles["Body"]))
    story.append(Spacer(1, 0.4 * cm))

    # Scores 4 axes
    scores_axes = [
        ["Juridique", summary.get("score_juridique", 0)],
        ["Environnement (SEC)", summary.get("score_sec", 0)],
        ["Social (SSC)", summary.get("score_ssc", 0)],
        ["Souveraineté (SOS)", summary.get("score_sos", 0)],
    ]
    t_scores = Table(
        [[Paragraph(f"<b>{s[0]}</b>", styles["Body"]),
          Paragraph(f"<para alignment='right'><font color='{LEVEL_COLORS.get(_lvl(s[1]), WARN).hexval()}'>"
                    f"<b>{s[1]} / 100</b></font></para>", styles["Body"])]
         for s in scores_axes],
        colWidths=[10 * cm, 7 * cm],
    )
    t_scores.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.25, colors.grey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT_BG, colors.white]),
    ]))
    story.append(t_scores)
    story.append(Spacer(1, 0.5 * cm))

    # QR code + share text
    qr_png = _qr_png_bytes(share_url)
    qr_img = RLImage(io.BytesIO(qr_png), width=3.5 * cm, height=3.5 * cm)
    qr_text = Paragraph(
        f"<para alignment='left'><b>Scanner pour consulter l'analyse complète</b><br/><br/>"
        f"<font size='8'>{share_url}</font><br/><br/>"
        f"<font size='8' color='grey'>Rapport généré le "
        f"{datetime.now().strftime('%d/%m/%Y %H:%M')} UTC{' par ' + user_email if user_email else ''}</font>"
        f"</para>",
        styles["Body"],
    )
    t_qr = Table([[qr_img, qr_text]], colWidths=[4 * cm, 13 * cm])
    t_qr.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.5, GOLD),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t_qr)
    story.append(Spacer(1, 0.3 * cm))

    # Disclaimer
    story.append(Paragraph(
        "DOCUMENT PÉDAGOGIQUE — Ne constitue pas un avis juridique. "
        "Consultez un avocat qualifié avant toute action. "
        "Méthodologie : Ahmed ELY Mustapha · RESOURCES-ANALYZER PRO",
        styles["Small"]))

    doc.build(story)
    return buf.getvalue()


def _lvl(s):
    v = float(s or 0)
    if v >= 80: return "conforme"
    if v >= 60: return "attention"
    if v >= 40: return "grave"
    return "critique"
