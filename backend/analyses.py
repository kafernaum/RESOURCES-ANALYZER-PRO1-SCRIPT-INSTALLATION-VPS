"""Pure deterministic analyses (ZERO LLM) :
- Financial : Part État, manque à gagner, scénarios de prix
- Environmental SEC, Social SSC, IDC, SOS scoring
"""
from typing import Dict, Any, List


# Royalty benchmarks (Module 2 — Famille 5)
ROYALTY_BENCHMARKS = {
    "petrole": (5, 25),
    "gaz": (3, 15),
    "or": (3, 10),
    "cuivre": (3, 6),
    "phosphate": (3, 8),
    "diamant": (5, 15),
    "fer": (3, 8),
    "bauxite": (3, 8),
    "uranium": (5, 12),
    "peche": (6, 15),
    "foret": (3, 10),
}

IS_BENCHMARK_AFRIQUE = (25, 35)  # Corporate income tax average
LOCAL_CONTENT_BENCHMARK = 50  # Vision minière africaine


def _safe_get(d, *keys, default=0):
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k, default)
    return cur if cur is not None else default


# ===== 3.2 — FINANCIAL ANALYSIS =====
def analyse_financiere(extracted: Dict[str, Any]) -> Dict[str, Any]:
    if not extracted:
        return {"error": "Aucune donnée extraite."}

    rf = extracted.get("regime_fiscal") or {}
    df = extracted.get("donnees_financieres") or {}
    sector = (extracted.get("sector") or "mines").lower()
    resource = (extracted.get("resource_type") or "").lower()
    duree = float(extracted.get("duree_contrat_ans") or 25)

    production = float(df.get("production_annuelle_estimee") or 0)
    prix = float(df.get("prix_reference") or 0)
    royalties = float(rf.get("taux_royalties") or 0)
    is_taux = float(rf.get("taux_impot_societes") or 0)
    bonus = float(rf.get("bonus_signature") or 0) + float(rf.get("bonus_production") or 0)
    psa_etat = float(rf.get("partage_production_etat_pct") or 0)

    # Valeur totale gisement
    revenus_annuels = production * prix
    valeur_totale = revenus_annuels * duree

    # Recettes État estimées
    recettes_royalty_an = revenus_annuels * (royalties / 100.0)
    # Approximation IS sur 60% des revenus en bénéfices
    benef_estime = revenus_annuels * 0.6
    recettes_is_an = benef_estime * (is_taux / 100.0)
    recettes_psa_an = revenus_annuels * (psa_etat / 100.0) if psa_etat > 0 else 0
    recettes_etat_an = recettes_royalty_an + recettes_is_an + recettes_psa_an + (bonus / max(duree, 1))
    recettes_etat_total = recettes_etat_an * duree + bonus

    part_etat_pct = (recettes_etat_total / valeur_totale * 100) if valeur_totale > 0 else 0

    # Benchmark
    bench_min, bench_max = ROYALTY_BENCHMARKS.get(resource, ROYALTY_BENCHMARKS.get(sector, (3, 15)))
    if royalties == 0:
        statut_royalty = "non_specifie"
    elif royalties < bench_min:
        statut_royalty = "sous_evaluation_critique"
    elif royalties > bench_max:
        statut_royalty = "favorable"
    else:
        statut_royalty = "conforme"

    manque_a_gagner_an = 0
    if royalties > 0 and royalties < bench_min:
        manque_a_gagner_an = (bench_min - royalties) / 100.0 * revenus_annuels
    manque_a_gagner_total = manque_a_gagner_an * duree

    # Taux effectif imposition
    taux_effectif = ((royalties + is_taux + psa_etat) if benef_estime > 0 else 0)
    is_min, is_max = IS_BENCHMARK_AFRIQUE
    statut_is = "conforme" if is_min <= is_taux <= is_max else ("sous_evalue" if is_taux < is_min else "eleve")

    # Élément don fiscal
    element_don = 1 - (recettes_etat_total / max(valeur_totale, 1)) if valeur_totale > 0 else 0
    cadeau_fiscal = element_don > 0.7  # If state captures less than 30% of gross value

    # 3 scenarios prix
    scenarios = {
        "bas": {
            "prix_unitaire": prix * 0.7,
            "revenus_annuels": revenus_annuels * 0.7,
            "recettes_etat_an": recettes_etat_an * 0.7,
            "recettes_etat_total": recettes_etat_total * 0.7,
        },
        "central": {
            "prix_unitaire": prix,
            "revenus_annuels": revenus_annuels,
            "recettes_etat_an": recettes_etat_an,
            "recettes_etat_total": recettes_etat_total,
        },
        "haut": {
            "prix_unitaire": prix * 1.3,
            "revenus_annuels": revenus_annuels * 1.3,
            "recettes_etat_an": recettes_etat_an * 1.3,
            "recettes_etat_total": recettes_etat_total * 1.3,
        },
    }

    return {
        "valeur_totale_gisement": round(valeur_totale, 2),
        "revenus_annuels": round(revenus_annuels, 2),
        "recettes_etat_annuelles": round(recettes_etat_an, 2),
        "recettes_etat_totales": round(recettes_etat_total, 2),
        "part_etat_pct": round(part_etat_pct, 2),
        "royalties_taux": royalties,
        "royalties_benchmark_min": bench_min,
        "royalties_benchmark_max": bench_max,
        "statut_royalty": statut_royalty,
        "manque_a_gagner_annuel": round(manque_a_gagner_an, 2),
        "manque_a_gagner_total": round(manque_a_gagner_total, 2),
        "taux_effectif_imposition": round(taux_effectif, 2),
        "is_taux": is_taux,
        "statut_is": statut_is,
        "element_don_fiscal": round(element_don, 4),
        "cadeau_fiscal": cadeau_fiscal,
        "duree_contrat_ans": duree,
        "scenarios_prix": scenarios,
        "decomposition_recettes": {
            "royalties_an": round(recettes_royalty_an, 2),
            "is_an": round(recettes_is_an, 2),
            "psa_an": round(recettes_psa_an, 2),
            "bonus_total": round(bonus, 2),
        },
    }


# ===== 3.3 — SEC =====
def _score_e1(eies, norme):
    if not eies:
        return 0
    if norme and "ifc" in norme.lower() or norme and "équateur" in norme.lower():
        return 5
    return 3


def analyse_environnementale(extracted: Dict[str, Any]) -> Dict[str, Any]:
    pe = extracted.get("parametres_environnementaux") or {}
    e1 = _score_e1(pe.get("eies_realisee"), pe.get("norme_applicable"))
    e2 = 5 if pe.get("plan_gestion_environnementale") else 0
    e3 = 5 if pe.get("fonds_restauration_prevu") and float(pe.get("montant_garantie_env") or 0) > 0 else (3 if pe.get("fonds_restauration_prevu") else 0)
    e4 = 3  # Default — needs clause analysis
    e5 = 0 if pe.get("zone_protegee_concernee") else 5
    e6 = 3 if pe.get("norme_applicable") else 1
    e7 = 5 if float(pe.get("emission_co2_estimee") or 0) > 0 else 0
    e8 = 0
    sociaux = extracted.get("parametres_sociaux") or {}
    if sociaux.get("clpe_formalise"):
        e8 = 5
    elif sociaux.get("consultation_communautaire"):
        e8 = 3

    weights = {"E1": 0.20, "E2": 0.15, "E3": 0.15, "E4": 0.15, "E5": 0.10, "E6": 0.10, "E7": 0.10, "E8": 0.05}
    components = {"E1": e1, "E2": e2, "E3": e3, "E4": e4, "E5": e5, "E6": e6, "E7": e7, "E8": e8}
    sec = sum((components[k] / 5) * weights[k] for k in components) * 100

    if sec >= 80:
        niveau = "conforme"
    elif sec >= 60:
        niveau = "insuffisant"
    elif sec >= 40:
        niveau = "grave"
    else:
        niveau = "critique"

    labels = {
        "E1": "EIES réalisée et conforme",
        "E2": "Plan de gestion environnementale",
        "E3": "Garantie financière de restauration",
        "E4": "Clause de responsabilité environnementale",
        "E5": "Zones protégées et biodiversité",
        "E6": "Gestion des déchets et rejets",
        "E7": "Changement climatique / GES",
        "E8": "Consultation et droits communautés",
    }
    return {
        "score_sec": round(sec, 2),
        "niveau_alerte": niveau,
        "components": [
            {"code": k, "label": labels[k], "score": components[k], "max": 5, "weight": weights[k]}
            for k in components
        ],
    }


# ===== 3.4 — SSC =====
def analyse_sociale(extracted: Dict[str, Any]) -> Dict[str, Any]:
    ps = extracted.get("parametres_sociaux") or {}

    quota_emploi = float(ps.get("quota_emploi_local_pct") or 0)
    if quota_emploi >= 70:
        s1 = 5
    elif quota_emploi >= 40:
        s1 = 3
    elif quota_emploi >= 20:
        s1 = 2
    else:
        s1 = 1 if quota_emploi > 0 else 0

    quota_cl = float(ps.get("quota_contenu_local_pct") or 0)
    if quota_cl >= 40:
        s2 = 5
    elif quota_cl >= 20:
        s2 = 3
    elif quota_cl > 0:
        s2 = 1
    else:
        s2 = 0

    pop = float(ps.get("populations_affectees_estimees") or 0)
    if pop > 0:
        s3 = 5 if ps.get("plan_reinstallation_prevu") else 0
    else:
        s3 = 5

    fonds = float(ps.get("montant_fonds_dev_local") or 0)
    if ps.get("fonds_developpement_local_prevu"):
        s4 = 5 if fonds > 0 else 3
    else:
        s4 = 1

    s5 = 3  # Default — formation; would need more parsing
    s6 = 5 if ps.get("clpe_formalise") else (3 if ps.get("consultation_communautaire") else 0)
    s7 = 3  # Default — health & safety standard

    weights = {"S1": 0.25, "S2": 0.20, "S3": 0.15, "S4": 0.15, "S5": 0.10, "S6": 0.10, "S7": 0.05}
    components = {"S1": s1, "S2": s2, "S3": s3, "S4": s4, "S5": s5, "S6": s6, "S7": s7}
    ssc = sum((components[k] / 5) * weights[k] for k in components) * 100

    if ssc >= 80:
        niveau = "conforme"
    elif ssc >= 60:
        niveau = "insuffisant"
    elif ssc >= 40:
        niveau = "grave"
    else:
        niveau = "critique"

    labels = {
        "S1": "Emploi local",
        "S2": "Contenu local fournisseurs",
        "S3": "Plan de réinstallation",
        "S4": "Fonds de développement local",
        "S5": "Transfert de technologie / formation",
        "S6": "Droits communautés / CLPE",
        "S7": "Santé et sécurité travailleurs",
    }
    return {
        "score_ssc": round(ssc, 2),
        "niveau_alerte": niveau,
        "components": [
            {"code": k, "label": labels[k], "score": components[k], "max": 5, "weight": weights[k]}
            for k in components
        ],
    }


# ===== 3.5 — IDC =====
def analyse_desequilibre(extracted: Dict[str, Any]) -> Dict[str, Any]:
    rf = extracted.get("regime_fiscal") or {}
    pe = extracted.get("parametres_environnementaux") or {}
    ps = extracted.get("parametres_sociaux") or {}
    rl = extracted.get("mecanismes_reglement_litiges") or {}
    duree = float(extracted.get("duree_contrat_ans") or 25)

    # Each dim /10 — droits Etat, droits entreprise
    fiscale_etat = min(10, (float(rf.get("taux_royalties") or 0) / 2) + (float(rf.get("taux_impot_societes") or 0) / 5))
    fiscale_entr = 10 - fiscale_etat + (3 if rf.get("stabilisation_fiscale") else 0)
    fiscale_entr = min(10, fiscale_entr)

    env_etat = 5 if pe.get("eies_realisee") else 2
    env_etat += 3 if pe.get("fonds_restauration_prevu") else 0
    env_etat = min(10, env_etat)
    env_entr = 10 - env_etat

    soc_etat = (float(ps.get("quota_emploi_local_pct") or 0) / 10) + (3 if ps.get("clpe_formalise") else 0)
    soc_etat = min(10, soc_etat)
    soc_entr = 10 - soc_etat

    arb_etat = 8 if (rl.get("juridiction") or "").lower() == "nationale" else (5 if (rl.get("juridiction") or "").lower() == "mixte" else 2)
    arb_entr = 10 - arb_etat + (2 if rl.get("renonciation_immunite_execution") else 0)
    arb_entr = min(10, arb_entr)

    duree_etat = 8 if duree <= 25 else (5 if duree <= 40 else 2)
    duree_entr = 10 - duree_etat

    conf_etat = 3
    conf_entr = 7

    sortie_etat = 4
    sortie_entr = 6

    dimensions = [
        {"name": "Fiscale", "etat": round(fiscale_etat, 1), "entreprise": round(fiscale_entr, 1)},
        {"name": "Environnementale", "etat": round(env_etat, 1), "entreprise": round(env_entr, 1)},
        {"name": "Sociale", "etat": round(soc_etat, 1), "entreprise": round(soc_entr, 1)},
        {"name": "Règlement litiges", "etat": round(arb_etat, 1), "entreprise": round(arb_entr, 1)},
        {"name": "Durée / renouvellement", "etat": round(duree_etat, 1), "entreprise": round(duree_entr, 1)},
        {"name": "Confidentialité", "etat": conf_etat, "entreprise": conf_entr},
        {"name": "Sortie du contrat", "etat": sortie_etat, "entreprise": sortie_entr},
    ]
    droits_etat = sum(d["etat"] for d in dimensions)
    droits_entr = sum(d["entreprise"] for d in dimensions)
    obl_entr = droits_etat  # symmetric proxy
    idc = ((droits_entr - obl_entr) / max(droits_etat + obl_entr, 1)) * 100
    return {
        "idc": round(idc, 2),
        "interpretation": ("favorable_entreprise" if idc > 5 else ("equilibre" if -5 <= idc <= 5 else "favorable_etat")),
        "droits_etat_total": round(droits_etat, 2),
        "droits_entreprise_total": round(droits_entr, 2),
        "dimensions": dimensions,
    }


# ===== 3.6 — SOS =====
def analyse_souverainete(extracted: Dict[str, Any]) -> Dict[str, Any]:
    rf = extracted.get("regime_fiscal") or {}
    rl = extracted.get("mecanismes_reglement_litiges") or {}
    clauses = extracted.get("clauses_sensibles") or []

    sv1 = 3  # Default — needs clause text analysis
    j = (rl.get("juridiction") or "").lower()
    if "national" in j or "ohada" in (rl.get("tribunal_arbitral") or "").lower():
        sv2 = 5
    elif "mixte" in j:
        sv2 = 3
    else:
        sv2 = 1
    if rl.get("renonciation_immunite_execution"):
        sv2 = max(0, sv2 - 2)

    has_stab = any((c.get("type") == "stabilisation") for c in clauses) or rf.get("stabilisation_fiscale")
    duree_stab = float(rf.get("duree_stabilisation_ans") or 0)
    if not has_stab:
        sv3 = 5
    elif duree_stab <= 5:
        sv3 = 3
    elif duree_stab <= 15:
        sv3 = 1
    else:
        sv3 = 0

    has_conf_abs = any((c.get("type") == "confidentialite" and c.get("risque") in ("eleve", "critique")) for c in clauses)
    sv4 = 0 if has_conf_abs else 3

    sv5 = 1  # Default unless back-in detected
    for c in clauses:
        if "back_in" in str(c.get("type", "")).lower() or "rachat" in str(c.get("texte_exact", "")).lower():
            sv5 = 3

    sos = ((sv1 + sv2 + sv3 + sv4 + sv5) / 25) * 100
    if sos >= 80:
        niveau = "preservee"
    elif sos >= 60:
        niveau = "partielle"
    else:
        niveau = "atteinte"

    return {
        "score_sos": round(sos, 2),
        "niveau_alerte": niveau,
        "components": [
            {"code": "SV1", "label": "Propriété de la ressource", "score": sv1, "max": 5},
            {"code": "SV2", "label": "Arbitrage et juridiction", "score": sv2, "max": 5},
            {"code": "SV3", "label": "Clause de gel de législation", "score": sv3, "max": 5},
            {"code": "SV4", "label": "Confidentialité", "score": sv4, "max": 5},
            {"code": "SV5", "label": "Droit de rachat État (back-in)", "score": sv5, "max": 5},
        ],
    }


def run_all_pure_analyses(extracted: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "financier": analyse_financiere(extracted),
        "environnemental": analyse_environnementale(extracted),
        "social": analyse_sociale(extracted),
        "desequilibre": analyse_desequilibre(extracted),
        "souverainete": analyse_souverainete(extracted),
    }


# ===== Simulator =====
def simulate(req: Dict[str, Any]) -> Dict[str, Any]:
    royalty = float(req.get("royalty_rate") or 0)
    is_rate = float(req.get("is_rate") or 0)
    duration = float(req.get("duration_years") or 25)
    state_psa = float(req.get("state_share_psa") or 0)
    production = float(req.get("production_annual") or 0)
    price = float(req.get("price") or 0)

    revenus_an = production * price
    royalty_an = revenus_an * royalty / 100
    benef = revenus_an * 0.6
    is_an = benef * is_rate / 100
    psa_an = revenus_an * state_psa / 100 if state_psa > 0 else 0
    recettes_an = royalty_an + is_an + psa_an
    recettes_total = recettes_an * duration
    valeur_totale = revenus_an * duration
    part_etat = (recettes_total / valeur_totale * 100) if valeur_totale > 0 else 0
    return {
        "revenus_annuels": round(revenus_an, 2),
        "valeur_totale_gisement": round(valeur_totale, 2),
        "recettes_etat_annuelles": round(recettes_an, 2),
        "recettes_etat_totales": round(recettes_total, 2),
        "part_etat_pct": round(part_etat, 2),
        "decomposition": {
            "royalty_an": round(royalty_an, 2),
            "is_an": round(is_an, 2),
            "psa_an": round(psa_an, 2),
        },
    }
