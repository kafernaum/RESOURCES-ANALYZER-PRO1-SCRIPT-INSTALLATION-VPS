"""Helpers to derive diagnostics from analyses (deterministic part)."""
from typing import Dict, Any, List


def derive_diagnostics_summary(analyses: Dict[str, Any]) -> Dict[str, Any]:
    """Aggregate scores into a global compliance dashboard view."""
    fin = analyses.get("financier") or {}
    env = analyses.get("environnemental") or {}
    soc = analyses.get("social") or {}
    sov = analyses.get("souverainete") or {}
    desq = analyses.get("desequilibre") or {}
    jur = analyses.get("juridique") or {}

    score_juridique = float(jur.get("score_conformite_global") or 0)
    score_sec = float(env.get("score_sec") or 0)
    score_ssc = float(soc.get("score_ssc") or 0)
    score_sos = float(sov.get("score_sos") or 0)

    violations_critiques = 0
    violations_graves = 0
    clauses_abusives = 0
    violations_droit_national = 0

    for v in (jur.get("violations_droit_international") or []):
        g = (v.get("gravite") or "").lower()
        if g == "critique": violations_critiques += 1
        elif g == "grave": violations_graves += 1
    for v in (jur.get("violations_droit_national") or []):
        violations_droit_national += 1
        g = (v.get("gravite") or "").lower()
        if g == "critique": violations_critiques += 1
        elif g == "grave": violations_graves += 1
    clauses_abusives = len(jur.get("clauses_abusives") or [])

    score_global = (score_juridique + score_sec + score_ssc + score_sos) / 4

    if score_global >= 80 and violations_critiques == 0:
        niveau_global = "conforme"
    elif violations_critiques > 0 or score_global < 40:
        niveau_global = "critique"
    elif violations_graves > 0 or score_global < 60:
        niveau_global = "grave"
    else:
        niveau_global = "attention"

    return {
        "score_juridique": round(score_juridique, 2),
        "score_sec": round(score_sec, 2),
        "score_ssc": round(score_ssc, 2),
        "score_sos": round(score_sos, 2),
        "score_global": round(score_global, 2),
        "niveau_global": niveau_global,
        "compteurs": {
            "violations_critiques": violations_critiques,
            "violations_graves": violations_graves,
            "clauses_abusives": clauses_abusives,
            "violations_droit_national": violations_droit_national,
        },
        "indicateurs_financiers": {
            "part_etat_pct": fin.get("part_etat_pct", 0),
            "manque_a_gagner_an": fin.get("manque_a_gagner_annuel", 0),
            "manque_a_gagner_total": fin.get("manque_a_gagner_total", 0),
            "idc": desq.get("idc", 0),
            "cadeau_fiscal": fin.get("cadeau_fiscal", False),
        },
    }
