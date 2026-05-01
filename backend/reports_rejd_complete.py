"""REJD complet 8 parties + 8 annexes — extension de reports.py."""
import io
from datetime import datetime
from typing import Dict, Any, List
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)

from reports import _styles, _header_footer, _disclaimer, _kpi_table
from normative_data import NORMATIVE_REFERENCES, INTERNATIONAL_JURISPRUDENCE


PRIMARY = colors.HexColor("#1B4332")
SECONDARY = colors.HexColor("#D4A017")
ALERT = colors.HexColor("#C0392B")
LIGHT_BG = colors.HexColor("#F5F9F5")


def _watermark_first_page(canvas, doc, user_info=""):
    """First page header/footer with user-specific watermark for traceability."""
    canvas.saveState()
    canvas.setStrokeColor(SECONDARY)
    canvas.setLineWidth(0.5)
    canvas.line(2 * cm, A4[1] - 1.4 * cm, A4[0] - 2 * cm, A4[1] - 1.4 * cm)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(PRIMARY)
    canvas.drawString(2 * cm, A4[1] - 1.2 * cm, "RESOURCES-ANALYZER PRO — REJD")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.grey)
    canvas.drawRightString(A4[0] - 2 * cm, A4[1] - 1.2 * cm,
                           "La transparence contractuelle au service du peuple")
    # Watermark — user info + timestamp
    if user_info:
        canvas.setFont("Helvetica", 6)
        canvas.setFillColor(colors.lightgrey)
        canvas.drawCentredString(A4[0] / 2, 0.4 * cm, user_info)
    # Footer
    canvas.line(2 * cm, 1.4 * cm, A4[0] - 2 * cm, 1.4 * cm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.grey)
    canvas.drawString(2 * cm, 1.0 * cm, "Méthodologie : Ahmed ELY Mustapha")
    canvas.drawCentredString(A4[0] / 2, 1.0 * cm, f"Page {canvas.getPageNumber()}")
    canvas.drawRightString(A4[0] - 2 * cm, 1.0 * cm, datetime.now().strftime("%d/%m/%Y"))
    canvas.restoreState()


def _section(story, title, styles, level=1):
    if level == 1:
        story.append(Paragraph(title, styles["H1"]))
    else:
        story.append(Paragraph(title, styles["H2"]))


def generate_rejd_complete(project: Dict[str, Any], report_data: Dict[str, Any], user_info: str = "") -> bytes:
    """REJD with 8 parts + 8 annexes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2.2 * cm, bottomMargin=2 * cm,
        title=f"REJD Complet — {project.get('name','')}",
        author="Ahmed ELY Mustapha — RESOURCES-ANALYZER PRO",
    )
    styles = _styles()
    story = []
    summary = report_data.get("summary", {})
    counters = summary.get("compteurs", {})
    fin = summary.get("indicateurs_financiers", {})
    jur = report_data.get("juridique") or {}
    diagnostics = (report_data.get("diagnostics") or {}).get("fiches", [])
    bln = report_data.get("bln") or {}
    confrontations = bln.get("confrontations", []) if isinstance(bln, dict) else []
    derogations = bln.get("derogations_illegales", []) if isinstance(bln, dict) else []
    finr = report_data.get("financier") or {}
    env = report_data.get("environnemental") or {}
    soc = report_data.get("social") or {}
    sov = report_data.get("souverainete") or {}

    # ====================== TITLE PAGE ======================
    story.append(Spacer(1, 3 * cm))
    story.append(Paragraph("RAPPORT D'EXPERTISE", styles["Title"]))
    story.append(Paragraph("JURIDIQUE DÉFENDABLE", styles["Title"]))
    story.append(Paragraph("(REJD COMPLET)", styles["Title"]))
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph(
        f"Convention d'exploitation — {project.get('sector', '').capitalize()}",
        styles["Subtitle"]))
    story.append(Paragraph(
        f"{project.get('country', 'Pays non précisé')} — {project.get('resource_type', '')}",
        styles["Subtitle"]))
    story.append(Spacer(1, 1.5 * cm))
    story.append(Paragraph(
        "<b>RESOURCES-ANALYZER PRO</b><br/>La transparence contractuelle au service du peuple",
        styles["Subtitle"]))
    story.append(Spacer(1, 1.5 * cm))
    story.append(Paragraph(f"<i>Date d'analyse : {datetime.now().strftime('%d %B %Y')}</i>", styles["Body"]))
    story.append(Paragraph("<i>Méthodologie : Ahmed ELY Mustapha — Juriste, Expert en Finances Publiques, PMP I-PMP IBM Full Stack Developer</i>", styles["Body"]))
    if user_info:
        story.append(Spacer(1, 0.3 * cm))
        story.append(Paragraph(f"<font size=\"8\" color=\"#888\">{user_info}</font>", styles["Body"]))
    story.append(Spacer(1, 2 * cm))
    story.append(_disclaimer(styles))
    story.append(PageBreak())

    # ====================== PART 1 — PRÉAMBULE ======================
    _section(story, "PARTIE 1 — Préambule et cadre de la mission", styles)
    story.append(Paragraph("1.1 — Objet et périmètre de l'expertise", styles["H2"]))
    story.append(Paragraph(
        f"Le présent rapport présente l'analyse juridique de la convention d'exploitation "
        f"<b>{project.get('name','')}</b>, conclue dans le secteur <b>{project.get('sector','')}</b> "
        f"en {project.get('country','')}, portant sur la ressource <b>{project.get('resource_type','')}</b>.",
        styles["Body"]))
    story.append(Paragraph("1.2 — Méthodologie", styles["H2"]))
    story.append(Paragraph(
        "L'analyse a été conduite selon la méthodologie RESOURCES-ANALYZER PRO en 7 sous-modules : "
        "(1) extraction structurée GPT-4o, (2) analyse juridique groupée, (3) score financier, "
        "(4) score environnemental SEC, (5) score social SSC, (6) indice de déséquilibre IDC, "
        "(7) score de souveraineté SOS.", styles["Body"]))
    story.append(Paragraph("1.3 — Documents analysés", styles["H2"]))
    story.append(Paragraph("Les conventions, avenants et pièces afférentes ont été classifiés selon "
                          "les types A1-A10 (actes contractuels), B1-B5 (permis), C1-C6 (rapports).", styles["Body"]))
    story.append(Paragraph("1.4 — Réserves et limites", styles["H2"]))
    story.append(_disclaimer(styles))
    story.append(PageBreak())

    # ====================== PART 2 — PRÉSENTATION CONVENTION ======================
    _section(story, "PARTIE 2 — Présentation de la convention", styles)
    story.append(Paragraph("2.1 — Parties contractantes", styles["H2"]))
    story.append(Paragraph(f"<b>État :</b> {project.get('country', '')}", styles["Body"]))
    story.append(Paragraph("<b>Entreprise :</b> identifiée dans les données extraites (cf. Annexe 4).", styles["Body"]))
    story.append(Paragraph("2.2 — Architecture financière", styles["H2"]))
    if finr:
        rows = [
            ["Valeur totale du gisement", f"{(finr.get('valeur_totale_gisement', 0) / 1e9):.2f} Mrd USD"],
            ["Recettes État totales", f"{(finr.get('recettes_etat_totales', 0) / 1e9):.2f} Mrd USD"],
            ["Part de l'État", f"{finr.get('part_etat_pct', 0)} %"],
            ["Royalties", f"{finr.get('royalties_taux', 0)} % (benchmark {finr.get('royalties_benchmark_min',0)}-{finr.get('royalties_benchmark_max',0)} %)"],
            ["Manque à gagner / an", f"{(finr.get('manque_a_gagner_annuel', 0) / 1e6):.1f} M USD"],
            ["Manque à gagner total", f"{(finr.get('manque_a_gagner_total', 0) / 1e6):.1f} M USD"],
            ["Élément don fiscal", f"{(finr.get('element_don_fiscal', 0) * 100):.1f} %"],
        ]
        t = Table(rows, colWidths=[8 * cm, 7 * cm])
        t.setStyle(TableStyle([
            ("FONTNAME", (1, 0), (1, -1), "Courier"),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT_BG, colors.white]),
        ]))
        story.append(t)
    story.append(PageBreak())

    # ====================== PART 3 — RÉGIME JURIDIQUE ======================
    _section(story, "PARTIE 3 — Régime juridique applicable", styles)
    story.append(Paragraph("3.1 — Droit constitutionnel et législatif national", styles["H2"]))
    story.append(Paragraph(
        f"L'expertise s'appuie sur le corpus législatif national de {project.get('country', '')} "
        "intégrant Code minier, Code des hydrocarbures, Code de l'environnement, Code de l'investissement, "
        "Code pénal, Code foncier, Loi ITIE et Loi anti-corruption.", styles["Body"]))
    story.append(Paragraph("3.2 — Droit international applicable", styles["H2"]))
    international_norms = [n for n in NORMATIVE_REFERENCES if n.get("family") == 1]
    for n in international_norms[:8]:
        story.append(Paragraph(f"<b>{n['code']}</b> — {n['title']}", styles["Body"]))
        story.append(Paragraph(f"<i>{n['summary']}</i>", styles["Small"]))
    story.append(Paragraph("3.3 — Droit régional africain", styles["H2"]))
    african_norms = [n for n in NORMATIVE_REFERENCES if n.get("family") == 2]
    for n in african_norms[:5]:
        story.append(Paragraph(f"<b>{n['code']}</b> — {n['title']}", styles["Body"]))
        story.append(Paragraph(f"<i>{n['summary']}</i>", styles["Small"]))
    story.append(PageBreak())

    # ====================== PART 4 — CONSTATS CLAUSE PAR CLAUSE ======================
    _section(story, "PARTIE 4 — Constats d'analyse clause par clause", styles)
    if confrontations:
        story.append(Paragraph("4.1 — Confrontation au droit national", styles["H2"]))
        for i, c in enumerate(confrontations[:15], 1):
            story.append(Paragraph(f"<b>Clause {i} — {c.get('clause_convention', '')}</b>", styles["Body"]))
            story.append(Paragraph(f"Conformité : <b>{c.get('conformite_droit_national','?')}</b> · Gravité : {c.get('gravite','')}", styles["Body"]))
            story.append(Paragraph(f"<i>Qualification :</i> {c.get('qualification_juridique_precise','')}", styles["Body"]))
            arts = c.get("articles_nationaux_applicables", [])
            for a in arts[:3]:
                story.append(Paragraph(f"  • {a.get('code','')} {a.get('article','')} ({a.get('type_relation','')}) : {(a.get('texte_article') or '')[:200]}", styles["Small"]))
            story.append(Spacer(1, 0.2 * cm))
    if jur.get("violations_droit_international"):
        story.append(Paragraph("4.2 — Violations du droit international", styles["H2"]))
        for v in jur["violations_droit_international"][:10]:
            story.append(Paragraph(f"<b>[{v.get('norme_violee','')}] {v.get('norme_libelle','')}</b> — {v.get('gravite','').upper()}", styles["Body"]))
            story.append(Paragraph(v.get("nature_violation",""), styles["Body"]))
    story.append(PageBreak())

    # ====================== PART 5 — DIAGNOSTIC GLOBAL ======================
    _section(story, "PARTIE 5 — Diagnostic global", styles)
    story.append(_kpi_table(report_data))
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(
        f"<b>{counters.get('violations_critiques',0)}</b> violations critiques · "
        f"<b>{counters.get('violations_graves',0)}</b> violations graves · "
        f"<b>{counters.get('clauses_abusives',0)}</b> clauses abusives · "
        f"<b>{counters.get('violations_droit_national',0)}</b> violations droit national.",
        styles["Body"]))
    if fin.get("manque_a_gagner_total", 0) > 0:
        story.append(Paragraph(
            f"<b>Impact économique total estimé :</b> {(fin['manque_a_gagner_total'] / 1e6):.1f} M USD sur la durée.",
            styles["Alert"]))
    story.append(PageBreak())

    # ====================== PART 6 — SOLUTIONS ======================
    _section(story, "PARTIE 6 — Solutions et recommandations", styles)
    if diagnostics:
        for i, f in enumerate(diagnostics[:10], 1):
            story.append(Paragraph(f"<b>Solution {i} — {f.get('anomalie','')[:120]}</b>", styles["Body"]))
            for s in (f.get("solutions") or [])[:5]:
                story.append(Paragraph(f"• <b>{s.get('type','').replace('_',' ').capitalize()}</b> — {s.get('description','')}", styles["Small"]))
            story.append(Spacer(1, 0.2 * cm))
    story.append(PageBreak())

    # ====================== PART 7 — MOYENS DE DÉNONCIATION ======================
    _section(story, "PARTIE 7 — Moyens de dénonciation (6 voies)", styles)
    voie_labels = {
        "parlementaire": "① Recours parlementaire",
        "judiciaire_national": "② Recours judiciaire national",
        "constitutionnel": "③ Recours constitutionnel",
        "arbitral_international": "④ Recours arbitral international",
        "international": "⑤ Recours international",
        "penal": "⑥ Procédure pénale",
    }
    by_voie = {k: [] for k in voie_labels}
    for f in diagnostics:
        for m in (f.get("moyens_denonciation") or []):
            t = m.get("type")
            if t in by_voie:
                by_voie[t].append((f.get("anomalie", "")[:80], m))
    for t, label in voie_labels.items():
        story.append(Paragraph(label, styles["H2"]))
        items = by_voie[t]
        if not items:
            story.append(Paragraph("<i>Aucun moyen identifié dans cette voie.</i>", styles["Small"]))
        for anomalie, m in items[:5]:
            story.append(Paragraph(f"• <b>{anomalie}</b> — {m.get('description','')}", styles["Small"]))
            if m.get("autorite_competente"):
                story.append(Paragraph(f"  <i>Autorité : {m['autorite_competente']} · Délai : {m.get('delai_prescription','—')}</i>", styles["Small"]))
        story.append(Spacer(1, 0.2 * cm))
    story.append(PageBreak())

    # ====================== PART 8 — CONCLUSIONS ======================
    _section(story, "PARTIE 8 — Conclusions de l'expertise", styles)
    niv = (summary.get("niveau_global") or "attention").upper()
    story.append(Paragraph(
        f"<b>Attendu</b> que l'analyse complète de la convention au regard du droit international, "
        f"du droit régional africain, du droit national et des standards contractuels révèle un niveau global de "
        f"conformité qualifié de <b>{niv}</b> ;",
        styles["Body"]))
    story.append(Paragraph(
        f"<b>Attendu</b> que l'expertise relève {counters.get('violations_critiques',0)} violation(s) critique(s), "
        f"{counters.get('violations_graves',0)} violation(s) grave(s), {counters.get('clauses_abusives',0)} clause(s) "
        f"abusive(s), entraînant un manque à gagner total estimé de "
        f"{(fin.get('manque_a_gagner_total', 0) / 1e6):.1f} M USD ;",
        styles["Body"]))
    story.append(Paragraph(
        "<b>Il est conclu</b>, sous réserve de l'analyse complémentaire d'un avocat qualifié, à la "
        "nécessité de renégocier ou contester les clauses identifiées, en privilégiant les voies "
        "amiable et législative avant le contentieux.",
        styles["Body"]))
    signature = Paragraph(
        f"<br/><br/>Fait à distance, le {datetime.now().strftime('%d/%m/%Y')}.<br/><br/>"
        f"<i>Méthodologie : Ahmed ELY Mustapha</i><br/>"
        f"<i>RESOURCES-ANALYZER PRO</i>",
        styles["Body"])
    story.append(signature)
    story.append(PageBreak())

    # ====================== ANNEXES ======================
    _section(story, "ANNEXES", styles)

    # Annexe 1 — Normes mobilisées
    story.append(Paragraph("Annexe 1 — Tableau des normes mobilisées", styles["H2"]))
    norms_table = [["Code", "Famille", "Titre"]]
    for n in NORMATIVE_REFERENCES[:30]:
        norms_table.append([n.get("code", ""), f"F{n.get('family', '')}", (n.get("title", "") or "")[:80]])
    t = Table(norms_table, colWidths=[2 * cm, 1.5 * cm, 13 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
    ]))
    story.append(t)
    story.append(PageBreak())

    # Annexe 2 — Jurisprudence
    story.append(Paragraph("Annexe 2 — Jurisprudence internationale citée", styles["H2"]))
    jur_table = [["Tribunal", "Affaire", "Année", "Ratio decidendi"]]
    for j in INTERNATIONAL_JURISPRUDENCE:
        jur_table.append([
            j.get("tribunal", "")[:18],
            (j.get("case_name") or "")[:35],
            str(j.get("year", "")),
            (j.get("ratio") or "")[:60],
        ])
    t = Table(jur_table, colWidths=[3 * cm, 5 * cm, 1.5 * cm, 7 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
    ]))
    story.append(t)
    story.append(PageBreak())

    # Annexe 3 — Fiches diagnostic
    story.append(Paragraph("Annexe 3 — Fiches diagnostic individuelles", styles["H2"]))
    for i, f in enumerate(diagnostics, 1):
        story.append(Paragraph(f"<b>Fiche {i}</b> — {f.get('anomalie','')}", styles["Body"]))
        story.append(Paragraph(f"Gravité : {f.get('gravite','').upper()} · Priorité : {f.get('priorite','').upper()}", styles["Small"]))
        if f.get("argument_jurisprudentiel_principal"):
            story.append(Paragraph(f"<i>Jurisprudence :</i> {f['argument_jurisprudentiel_principal']}", styles["Small"]))
        story.append(Spacer(1, 0.15 * cm))
    story.append(PageBreak())

    # Annexe 4 — Données brutes (résumé)
    story.append(Paragraph("Annexe 4 — Données brutes (résumé)", styles["H2"]))
    story.append(Paragraph("Les données structurées extraites sont disponibles au format JSON dans le pack ZIP du REJD.", styles["Body"]))

    # Annexe 5 — Documents collectés
    story.append(Paragraph("Annexe 5 — Documents collectés (Module 9)", styles["H2"]))
    story.append(Paragraph(
        "La veille documentaire a été menée sur 10 sources publiques : ResourceContracts.org, ITIE, FMI, "
        "Banque Mondiale, CIRDI, PWYP, Global Witness, Légifrance, OHADA, OpenAlex.", styles["Body"]))

    # Annexe 6 — Profil réputation
    story.append(Paragraph("Annexe 6 — Profil de réputation de la société contractante", styles["H2"]))
    story.append(Paragraph(
        "Le profil heuristique a été établi à partir des sources publiques (sanctions OFAC/UE/ONU, base CIRDI, OCCRP, ICIJ).",
        styles["Body"]))
    story.append(PageBreak())

    # Annexe 7 — Modèles de recours
    story.append(Paragraph("Annexe 7 — Modèles de recours juridictionnels", styles["H2"]))
    for label in [
        "① Plainte avec constitution de partie civile",
        "② Saisine de la Cour des Comptes",
        "③ Exception d'inconstitutionnalité",
        "④ Notice d'arbitrage CIRDI / CCI / CCJA",
        "⑤ Question écrite parlementaire",
        "⑥ Lettre de mise en demeure",
        "⑦ Communication au Rapporteur spécial ONU",
    ]:
        story.append(Paragraph(label, styles["Body"]))
        story.append(Paragraph("<i>Modèle disponible sur demande auprès de votre conseil juridique.</i>", styles["Small"]))
        story.append(Spacer(1, 0.15 * cm))
    story.append(PageBreak())

    # Annexe 8 — Glossaire
    story.append(Paragraph("Annexe 8 — Glossaire juridique et technique", styles["H2"]))
    from normative_data import GLOSSARY
    for g in GLOSSARY[:40]:
        story.append(Paragraph(f"<b>{g['term']}</b> — {g['definition']}", styles["Small"]))
        story.append(Spacer(1, 0.1 * cm))

    # Final disclaimer
    story.append(Spacer(1, 1 * cm))
    story.append(_disclaimer(styles))

    def _on_page(canvas, doc):
        _watermark_first_page(canvas, doc, user_info=user_info)

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
    return buf.getvalue()
