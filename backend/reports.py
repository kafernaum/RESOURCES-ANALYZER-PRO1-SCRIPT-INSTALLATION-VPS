"""PDF report generation with reportlab.
3 presets implemented: parlementaire, juridique, rejd.
"""
import io
from datetime import datetime
from typing import Dict, Any
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)


PRIMARY = colors.HexColor("#1B4332")
SECONDARY = colors.HexColor("#D4A017")
TERTIARY = colors.HexColor("#1A3C5E")
ALERT = colors.HexColor("#C0392B")
WARNING_C = colors.HexColor("#E67E22")
EQUI = colors.HexColor("#27AE60")
LIGHT_BG = colors.HexColor("#F5F9F5")


def _styles():
    base = getSampleStyleSheet()
    s = {}
    s["Title"] = ParagraphStyle(
        "T1", parent=base["Title"], fontName="Helvetica-Bold", fontSize=22,
        textColor=PRIMARY, alignment=TA_CENTER, spaceAfter=12, leading=26
    )
    s["Subtitle"] = ParagraphStyle(
        "T2", parent=base["Heading2"], fontName="Helvetica", fontSize=13,
        textColor=TERTIARY, alignment=TA_CENTER, spaceAfter=18, leading=16
    )
    s["H1"] = ParagraphStyle(
        "H1", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=16,
        textColor=PRIMARY, spaceBefore=14, spaceAfter=8, leading=20
    )
    s["H2"] = ParagraphStyle(
        "H2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=12,
        textColor=TERTIARY, spaceBefore=10, spaceAfter=6, leading=15
    )
    s["Body"] = ParagraphStyle(
        "Body", parent=base["BodyText"], fontName="Helvetica", fontSize=10,
        leading=14, alignment=TA_JUSTIFY, spaceAfter=6
    )
    s["Small"] = ParagraphStyle(
        "Small", parent=base["BodyText"], fontName="Helvetica", fontSize=8,
        textColor=colors.grey, leading=10
    )
    s["Disclaimer"] = ParagraphStyle(
        "Disclaimer", parent=base["BodyText"], fontName="Helvetica-Oblique",
        fontSize=9, textColor=ALERT, leading=12, alignment=TA_CENTER
    )
    s["Alert"] = ParagraphStyle(
        "Alert", parent=base["BodyText"], fontName="Helvetica-Bold",
        fontSize=10, textColor=ALERT, leading=13
    )
    s["Mono"] = ParagraphStyle(
        "Mono", parent=base["BodyText"], fontName="Courier", fontSize=10, leading=13
    )
    return s


def _header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(SECONDARY)
    canvas.setLineWidth(0.5)
    canvas.line(2 * cm, A4[1] - 1.4 * cm, A4[0] - 2 * cm, A4[1] - 1.4 * cm)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(PRIMARY)
    canvas.drawString(2 * cm, A4[1] - 1.2 * cm, "RESOURCES-ANALYZER PRO")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.grey)
    canvas.drawRightString(A4[0] - 2 * cm, A4[1] - 1.2 * cm,
                           "La transparence contractuelle au service du peuple")
    # Footer
    canvas.line(2 * cm, 1.4 * cm, A4[0] - 2 * cm, 1.4 * cm)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(2 * cm, 1.0 * cm, "Méthodologie : Ahmed ELY Mustapha")
    canvas.drawCentredString(A4[0] / 2, 1.0 * cm, f"Page {canvas.getPageNumber()}")
    canvas.drawRightString(A4[0] - 2 * cm, 1.0 * cm, datetime.now().strftime("%d/%m/%Y"))
    canvas.restoreState()


def _kpi_table(report_data: Dict[str, Any]):
    summary = report_data.get("summary", {})
    data = [
        ["Indicateur", "Valeur", "Niveau"],
        ["Score Conformité Juridique", f"{summary.get('score_juridique', 0)} / 100", _level(summary.get('score_juridique', 0))],
        ["Score Environnemental (SEC)", f"{summary.get('score_sec', 0)} / 100", _level(summary.get('score_sec', 0))],
        ["Score Social (SSC)", f"{summary.get('score_ssc', 0)} / 100", _level(summary.get('score_ssc', 0))],
        ["Score Souveraineté (SOS)", f"{summary.get('score_sos', 0)} / 100", _level(summary.get('score_sos', 0))],
        ["Score Global", f"{summary.get('score_global', 0)} / 100", _level(summary.get('score_global', 0))],
    ]
    t = Table(data, colWidths=[7 * cm, 5 * cm, 4 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("FONTNAME", (1, 1), (1, -1), "Courier"),
        ("ALIGN", (1, 1), (1, -1), "CENTER"),
        ("ALIGN", (2, 1), (2, -1), "CENTER"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT_BG, colors.white]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return t


def _level(score):
    s = float(score or 0)
    if s >= 80: return "Conforme"
    if s >= 60: return "Attention"
    if s >= 40: return "Grave"
    return "Critique"


def _disclaimer(styles):
    return Paragraph(
        "DOCUMENT PÉDAGOGIQUE — Ce rapport est généré à titre d'aide à la réflexion juridique. "
        "Il ne constitue pas un avis juridique et n'a aucune valeur juridictionnelle. "
        "Consultez un avocat qualifié avant toute action.",
        styles["Disclaimer"]
    )


def _build_title_page(story, project, preset_label, styles):
    story.append(Spacer(1, 3 * cm))
    story.append(Paragraph("RAPPORT D'EXPERTISE", styles["Title"]))
    story.append(Paragraph(preset_label.upper(), styles["Title"]))
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph(
        f"Convention d'exploitation — {project.get('sector', '').capitalize()}",
        styles["Subtitle"]))
    story.append(Paragraph(
        f"{project.get('country', 'Pays non précisé')} — {project.get('resource_type', 'Ressource non précisée')}",
        styles["Subtitle"]))
    story.append(Spacer(1, 2 * cm))
    story.append(Paragraph(
        "<b>RESOURCES-ANALYZER PRO</b><br/>La transparence contractuelle au service du peuple",
        styles["Subtitle"]))
    story.append(Spacer(1, 1.5 * cm))
    story.append(Paragraph(
        f"<i>Date d'analyse : {datetime.now().strftime('%d %B %Y')}</i>", styles["Body"]))
    story.append(Paragraph(
        "<i>Méthodologie : Ahmed ELY Mustapha — Juriste, Expert en Finances Publiques</i>",
        styles["Body"]))
    story.append(Spacer(1, 2 * cm))
    story.append(_disclaimer(styles))
    story.append(PageBreak())


def _build_summary_section(story, project, report_data, styles):
    story.append(Paragraph("1. Synthèse exécutive", styles["H1"]))
    summary = report_data.get("summary", {})
    counters = summary.get("compteurs", {})
    fin = summary.get("indicateurs_financiers", {})
    niv = summary.get("niveau_global", "attention").upper()

    story.append(Paragraph(
        f"Score global de conformité : <b>{summary.get('score_global', 0)} / 100</b> — Niveau <b>{niv}</b>",
        styles["Body"]))
    story.append(_kpi_table(report_data))
    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("Indicateurs d'alerte", styles["H2"]))
    alert_data = [
        ["Type", "Nombre"],
        ["Violations critiques", str(counters.get("violations_critiques", 0))],
        ["Violations graves", str(counters.get("violations_graves", 0))],
        ["Clauses abusives", str(counters.get("clauses_abusives", 0))],
        ["Violations droit national", str(counters.get("violations_droit_national", 0))],
    ]
    t = Table(alert_data, colWidths=[10 * cm, 5 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TERTIARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (1, 1), (1, -1), "Courier-Bold"),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("Indicateurs financiers clés", styles["H2"]))
    story.append(Paragraph(f"Part de l'État : <b>{fin.get('part_etat_pct', 0)}%</b> de la valeur totale du gisement.", styles["Body"]))
    story.append(Paragraph(f"Manque à gagner annuel estimé : <b>{fin.get('manque_a_gagner_an', 0):,.0f} USD</b>", styles["Body"]))
    story.append(Paragraph(f"Manque à gagner sur la durée : <b>{fin.get('manque_a_gagner_total', 0):,.0f} USD</b>", styles["Body"]))
    story.append(Paragraph(f"Indice de Déséquilibre Contractuel (IDC) : <b>{fin.get('idc', 0)}</b>", styles["Body"]))
    if fin.get("cadeau_fiscal"):
        story.append(Paragraph("⚠ ALERTE : Cadeau fiscal détecté (élément don > 70%).", styles["Alert"]))
    story.append(PageBreak())


def _build_violations_section(story, report_data, styles):
    jur = report_data.get("juridique") or {}
    story.append(Paragraph("2. Constats juridiques", styles["H1"]))

    story.append(Paragraph("2.1 Violations du droit international", styles["H2"]))
    vint = jur.get("violations_droit_international") or []
    if not vint:
        story.append(Paragraph("Aucune violation du droit international détectée.", styles["Body"]))
    else:
        for v in vint[:10]:
            story.append(Paragraph(
                f"<b>[{v.get('norme_violee','?')}] {v.get('norme_libelle','')}</b> — Gravité : {v.get('gravite','?').upper()}",
                styles["Body"]))
            story.append(Paragraph(f"Nature : {v.get('nature_violation','')}", styles["Body"]))
            story.append(Paragraph(f"Qualification : {v.get('qualification_juridique','')}", styles["Body"]))
            story.append(Paragraph(f"Impact souveraineté : {v.get('impact_souverainete','')}", styles["Body"]))
            story.append(Paragraph(f"<i>Solution : {v.get('solution','')}</i>", styles["Body"]))
            story.append(Paragraph(f"<i>Moyen de dénonciation : {v.get('moyen_denonciation','')}</i>", styles["Body"]))
            story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("2.2 Violations du droit national", styles["H2"]))
    vnat = jur.get("violations_droit_national") or []
    if not vnat:
        story.append(Paragraph("Aucune violation du droit national détectée par l'analyse automatique.", styles["Body"]))
    else:
        for v in vnat[:10]:
            story.append(Paragraph(
                f"<b>{v.get('code_national_viole','')} — {v.get('article_exact','')}</b> — Gravité : {v.get('gravite','?').upper()}",
                styles["Body"]))
            story.append(Paragraph(f"Nature : {v.get('nature_violation','')}", styles["Body"]))
            story.append(Paragraph(f"Type de dérogation : {v.get('type_derogation','')}", styles["Body"]))
            story.append(Paragraph(f"Qualification pénale : {v.get('qualification_penale_potentielle','')}", styles["Body"]))
            story.append(Paragraph(f"<i>Solution : {v.get('solution','')}</i>", styles["Body"]))
            story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("2.3 Clauses abusives", styles["H2"]))
    abus = jur.get("clauses_abusives") or []
    if not abus:
        story.append(Paragraph("Aucune clause abusive détectée.", styles["Body"]))
    else:
        for c in abus[:10]:
            story.append(Paragraph(
                f"<b>{c.get('type_abus','?')}</b> — Gravité : {c.get('gravite','?').upper()}",
                styles["Body"]))
            story.append(Paragraph(c.get("analyse", ""), styles["Body"]))
            story.append(Paragraph(f"<i>Base juridique de contestation : {c.get('base_juridique_contestation','')}</i>", styles["Body"]))
            story.append(Spacer(1, 0.3 * cm))
    story.append(PageBreak())


def _build_diagnostic_section(story, report_data, styles):
    fiches = (report_data.get("diagnostics") or {}).get("fiches") or []
    story.append(Paragraph("3. Fiches diagnostic & moyens de dénonciation", styles["H1"]))
    if not fiches:
        story.append(Paragraph("Aucune fiche diagnostic n'a encore été générée.", styles["Body"]))
        return
    for i, f in enumerate(fiches, 1):
        story.append(Paragraph(
            f"FICHE {i} — {f.get('anomalie','')[:120]}", styles["H2"]))
        story.append(Paragraph(f"Gravité : <b>{(f.get('gravite') or '').upper()}</b> — Priorité : <b>{(f.get('priorite') or '').upper()}</b>", styles["Body"]))
        story.append(Paragraph(f"Qualification juridique : {f.get('qualification_juridique','')}", styles["Body"]))
        story.append(Paragraph(f"Argument jurisprudentiel : {f.get('argument_jurisprudentiel_principal','')}", styles["Body"]))
        story.append(Paragraph(f"Ratio decidendi : {f.get('ratio_decidendi','')}", styles["Body"]))
        if f.get("impact_financier_usd"):
            story.append(Paragraph(f"Impact financier : <b>{float(f.get('impact_financier_usd') or 0):,.0f} USD</b>", styles["Body"]))
        sols = f.get("solutions") or []
        if sols:
            story.append(Paragraph("Solutions :", styles["Body"]))
            for s in sols[:4]:
                story.append(Paragraph(f"• <b>{s.get('type','')}</b> — {s.get('description','')}", styles["Body"]))
        moyens = f.get("moyens_denonciation") or []
        if moyens:
            story.append(Paragraph("Moyens de dénonciation :", styles["Body"]))
            for m in moyens[:6]:
                story.append(Paragraph(f"• <b>{m.get('type','')}</b> — {m.get('description','')} ({m.get('autorite_competente','')})", styles["Body"]))
        story.append(Spacer(1, 0.4 * cm))
    story.append(PageBreak())


def _build_conclusion(story, report_data, styles):
    story.append(Paragraph("4. Conclusions de l'expertise", styles["H1"]))
    summary = report_data.get("summary", {})
    counters = summary.get("compteurs", {})
    niv = (summary.get("niveau_global") or "attention").upper()
    story.append(Paragraph(
        f"Au terme de l'analyse, le niveau global de conformité de la convention est qualifié de <b>{niv}</b>. "
        f"L'expertise relève {counters.get('violations_critiques',0)} violation(s) critique(s), "
        f"{counters.get('violations_graves',0)} violation(s) grave(s), "
        f"{counters.get('clauses_abusives',0)} clause(s) abusive(s).",
        styles["Body"]))
    story.append(Paragraph(
        "Il est conclu, sous réserve de l'analyse complémentaire d'un avocat qualifié, "
        "à la nécessité de renégocier ou de contester les clauses identifiées, "
        "selon les voies recommandées dans le présent rapport.",
        styles["Body"]))
    story.append(Spacer(1, 1 * cm))
    story.append(_disclaimer(styles))


def generate_pdf(project: Dict[str, Any], report_data: Dict[str, Any], preset: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2.2 * cm, bottomMargin=2 * cm,
        title=f"Rapport {preset} — {project.get('name','')}"
    )
    styles = _styles()
    story = []

    preset_labels = {
        "parlementaire": "Rapport Parlementaire",
        "juridique": "Rapport Juridique Complet",
        "citoyen": "Rapport Citoyen / ONG",
        "environnemental": "Rapport Environnemental",
        "renegociation": "Rapport de Renégociation",
        "comparatif": "Rapport Comparatif",
        "rejd": "Rapport d'Expertise Juridique Défendable (REJD)",
    }
    label = preset_labels.get(preset, "Rapport")

    _build_title_page(story, project, label, styles)
    _build_summary_section(story, project, report_data, styles)

    if preset in ("juridique", "rejd", "parlementaire"):
        _build_violations_section(story, report_data, styles)
    if preset in ("juridique", "rejd"):
        _build_diagnostic_section(story, report_data, styles)
    _build_conclusion(story, report_data, styles)

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()
