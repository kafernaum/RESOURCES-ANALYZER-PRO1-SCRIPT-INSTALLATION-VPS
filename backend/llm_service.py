"""LLM service — GPT-4o calls via emergentintegrations.
Strict JSON output, 1 call per document/analysis (cached upstream).
"""
import os
import json
import re
from typing import Dict, Any, Optional
from emergentintegrations.llm.chat import LlmChat, UserMessage

API_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


def _api_key():
    """Read key lazily to avoid load_dotenv timing issues."""
    return os.environ.get("EMERGENT_LLM_KEY", "") or API_KEY


def _clean_json_response(raw: str) -> Dict[str, Any]:
    """Robust JSON extraction from LLM text."""
    if not raw:
        return {}
    # strip code fences
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    # try direct parse
    try:
        return json.loads(raw)
    except Exception:
        pass
    # find first { ... last }
    m = re.search(r"\{[\s\S]*\}", raw)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    return {"_parse_error": True, "_raw": raw[:2000]}


EXTRACTION_SYSTEM = """Tu es un juriste-expert en droit minier, pétrolier, gazier, maritime et forestier.
Tu analyses des conventions d'exploitation de ressources naturelles entre États et entreprises privées.
Tu réponds UNIQUEMENT par un objet JSON valide, sans texte autour, sans markdown.
Tu remplis tous les champs au mieux de ta capacité ; si une donnée est absente du texte fourni, mets null ou 0 ou "non précisé".
Pour les champs booléens, utilise true/false.
Tu cites le texte exact des clauses uniquement quand demandé."""


EXTRACTION_PROMPT_TEMPLATE = """Analyse la convention suivante et retourne un JSON strict avec cette structure exacte :

{{
  "document_type": "A1|A2|A3|A4|A5|A6|A7|A8|A9|A10|B1|B2|B3|B4|B5",
  "country": "string",
  "company": "string",
  "sector": "mines|petrole|gaz|maritime|foret|mixte",
  "resource_type": "string",
  "date_signature": "string",
  "date_entree_vigueur": "string",
  "duree_contrat_ans": 0,
  "zone_concession": "string",
  "regime_fiscal": {{
    "taux_impot_societes": 0,
    "taux_royalties": 0,
    "taux_dividendes": 0,
    "taxe_superficiaire": 0,
    "droits_douane_equipements": 0,
    "tva_exoneree": false,
    "stabilisation_fiscale": false,
    "duree_stabilisation_ans": 0,
    "bonus_signature": 0,
    "bonus_production": 0,
    "partage_production_etat_pct": 0,
    "partage_production_entreprise_pct": 0,
    "profit_oil_pct_etat": 0,
    "cost_oil_plafond_pct": 0
  }},
  "obligations_entreprise": [
    {{"type":"emploi_local|contenu_local|transfert_tech|formation|infrastructures|environnement|reporting|audit|autre","description":"string","delai":"string","sanction_non_respect":"string","quantifiable":false,"valeur":0}}
  ],
  "clauses_sensibles": [
    {{"clause_id":"string","type":"stabilisation|confidentialite|arbitrage|immunite_souveraine|gel_legislation|clause_penale|renonciation_souverainete|restriction_exportation|droit_premier_refus|take_or_pay|gross_up|most_favoured_nation|autre","texte_exact":"string","risque":"faible|modere|eleve|critique","analyse_preliminaire":"string"}}
  ],
  "parametres_environnementaux": {{
    "eies_realisee": false,
    "norme_applicable": "string",
    "plan_gestion_environnementale": false,
    "fonds_restauration_prevu": false,
    "montant_garantie_env": 0,
    "emission_co2_estimee": 0,
    "zone_protegee_concernee": false,
    "engagement_biodiversite": "string"
  }},
  "parametres_sociaux": {{
    "populations_affectees_estimees": 0,
    "plan_reinstallation_prevu": false,
    "consultation_communautaire": false,
    "clpe_formalise": false,
    "fonds_developpement_local_prevu": false,
    "montant_fonds_dev_local": 0,
    "quota_emploi_local_pct": 0,
    "quota_contenu_local_pct": 0
  }},
  "donnees_financieres": {{
    "investissement_total_prevu": 0,
    "production_annuelle_estimee": 0,
    "unite_production": "string",
    "prix_reference": 0,
    "devise": "USD",
    "recettes_etat_estimees_annuelles": 0,
    "duree_amortissement_ans": 0
  }},
  "mecanismes_reglement_litiges": {{
    "juridiction": "nationale|internationale|mixte",
    "tribunal_arbitral": "string",
    "droit_applicable": "string",
    "renonciation_immunite_execution": false,
    "clause_gel_actifs": false
  }},
  "extraction_confidence": 0
}}

DOCUMENT À ANALYSER :
\"\"\"
{document_text}
\"\"\"

Réponds UNIQUEMENT avec le JSON. Aucune explication."""


JURIDICAL_SYSTEM = """Tu es un juriste expert en droit international des ressources naturelles, droit constitutionnel,
droit minier/pétrolier/gazier, et droit international des investissements. Tu produis des analyses
juridiques rigoureuses et défendables devant les juridictions nationales et internationales.
Tu réponds UNIQUEMENT par un objet JSON valide, sans markdown."""


JURIDICAL_PROMPT_TEMPLATE = """Sur la base des données extraites de la convention ci-dessous, produis une analyse juridique complète au regard :
- Du droit international (Rés. ONU 1803, Pacte ONU droits économiques, Principes Ruggie, CNUDM, Principes Équateur, Normes IFC, ITIE, CNUCC).
- Du droit régional africain (Charte africaine Art. 21, Vision minière UA, OHADA, CEDEAO).
- Des standards contractuels (PSA AIPN, ResourceContracts.org, CNUCED, PWYP).
- De la doctrine (Pacta sunt servanda vs Rebus sic stantibus, souveraineté permanente, contrats léonins, pollueur-payeur, précaution, enrichissement sans cause).

DONNÉES DE LA CONVENTION (JSON) :
{convention_data}

Retourne ce JSON strict :
{{
  "violations_droit_international": [
    {{"norme_violee":"N1.1|N1.2|...","norme_libelle":"string","clause_convention":"string","texte_clause":"string","nature_violation":"string","gravite":"mineure|moderee|grave|critique","qualification_juridique":"string","impact_souverainete":"string","jurisprudence_applicable":["string"],"solution":"string","moyen_denonciation":"string"}}
  ],
  "violations_droit_national": [
    {{"code_national_viole":"string","article_exact":"string","texte_article":"string","clause_convention":"string","texte_clause":"string","nature_violation":"string","type_derogation":"fiscale|environnementale|fonciere|procedurale|penale|autre","derogation_autorisee_par_code_investissement":false,"gravite":"mineure|moderee|grave|critique","qualification_penale_potentielle":"string","fondement_legal_action":["string"],"juridiction_nationale_competente":"string","delai_prescription":"string","solution":"string","moyen_denonciation":"string"}}
  ],
  "desequilibres_contractuels": [
    {{"type":"fiscal|environnemental|social|operationnel|arbitrage|duree|autre","description":"string","prejudice_etat":"string","montant_prejudice_estime":0,"solution_renegociation":"string","clause_alternative_proposee":"string"}}
  ],
  "clauses_abusives": [
    {{"clause_id":"string","type_abus":"stabilisation_excessive|confidentialite_absolue|arbitrage_defavorable|renonciation_immunite|gel_legislation_env|restriction_souverainete|duree_excessive|contenu_local_insuffisant|royalties_sous_evaluees|autre","texte_exact":"string","analyse":"string","gravite":"moderee|grave|critique","base_juridique_contestation":"string","solution":"string"}}
  ],
  "score_conformite_global": 0,
  "niveau_alerte": "conforme|attention|grave|critique",
  "synthese_juridique": "string"
}}"""


DIAGNOSTIC_SYSTEM = """Tu es un expert juridique chargé de produire des fiches diagnostic défendables devant les juridictions.
Tu réponds UNIQUEMENT par un objet JSON valide."""


DIAGNOSTIC_PROMPT_TEMPLATE = """À partir des violations et déséquilibres détectés ci-dessous, produis une liste de fiches diagnostic
détaillées avec solutions et moyens de dénonciation.

VIOLATIONS DÉTECTÉES :
{violations_data}

Retourne ce JSON strict :
{{
  "fiches": [
    {{
      "anomalie": "description précise",
      "qualification_juridique": "string",
      "normes_internationales_violees": ["string"],
      "articles_nationaux_violes": ["string"],
      "qualification_penale_potentielle": "string",
      "argument_jurisprudentiel_principal": "string",
      "ratio_decidendi": "string",
      "impact_financier_usd": 0,
      "impact_social": "string",
      "impact_environnemental": "string",
      "solutions": [
        {{"type":"renegociation|legislative|judiciaire_nationale","description":"string","clause_alternative":"string","probabilite_succes":"faible|moyenne|elevee"}}
      ],
      "moyens_denonciation": [
        {{"type":"parlementaire|judiciaire_national|constitutionnel|arbitral_international|international|penal","description":"string","autorite_competente":"string","delai_prescription":"string"}}
      ],
      "gravite": "mineure|moderee|grave|critique",
      "priorite": "urgent|court_terme|moyen_terme|long_terme"
    }}
  ]
}}

Génère entre 3 et 8 fiches selon les violations. Sois précis, juridiquement rigoureux."""


FREEQUERY_SYSTEM = """Tu es un assistant juridique expert. Tu réponds en français, en citant les articles de loi et la jurisprudence pertinente quand applicable.
Tu portes toujours un avertissement : 'Cette réponse est pédagogique et ne constitue pas un avis juridique.'"""


async def call_llm_json(system: str, user_prompt: str, session_id: str) -> Dict[str, Any]:
    """Single GPT-4o call returning parsed JSON."""
    key = _api_key()
    if not key:
        return {"_error": "EMERGENT_LLM_KEY non configurée"}
    try:
        chat = LlmChat(
            api_key=key,
            session_id=session_id,
            system_message=system,
        ).with_model("openai", "gpt-4o")
        msg = UserMessage(text=user_prompt)
        response = await chat.send_message(msg)
        return _clean_json_response(response)
    except Exception as e:
        return {"_error": str(e)}


async def call_llm_text(system: str, user_prompt: str, session_id: str) -> str:
    key = _api_key()
    if not key:
        return "EMERGENT_LLM_KEY non configurée."
    try:
        chat = LlmChat(
            api_key=key,
            session_id=session_id,
            system_message=system,
        ).with_model("openai", "gpt-4o")
        msg = UserMessage(text=user_prompt)
        return await chat.send_message(msg)
    except Exception as e:
        return f"Erreur LLM: {e}"


# ---------- High-level wrappers ----------
async def extract_convention_data(document_text: str, document_id: str) -> Dict[str, Any]:
    # truncate to ~30k chars to stay within context
    text_to_send = document_text[:30000]
    prompt = EXTRACTION_PROMPT_TEMPLATE.format(document_text=text_to_send)
    return await call_llm_json(EXTRACTION_SYSTEM, prompt, f"extract_{document_id}")


async def juridical_analysis(convention_data: Dict[str, Any], project_id: str) -> Dict[str, Any]:
    prompt = JURIDICAL_PROMPT_TEMPLATE.format(
        convention_data=json.dumps(convention_data, ensure_ascii=False)[:20000]
    )
    return await call_llm_json(JURIDICAL_SYSTEM, prompt, f"jurid_{project_id}")


async def diagnostic_generation(violations: Dict[str, Any], project_id: str) -> Dict[str, Any]:
    prompt = DIAGNOSTIC_PROMPT_TEMPLATE.format(
        violations_data=json.dumps(violations, ensure_ascii=False)[:18000]
    )
    return await call_llm_json(DIAGNOSTIC_SYSTEM, prompt, f"diag_{project_id}")


async def free_query(question: str, context: Dict[str, Any], project_id: str) -> str:
    prompt = f"""Contexte du projet (données extraites de la convention) :
{json.dumps(context, ensure_ascii=False)[:8000]}

QUESTION DE L'UTILISATEUR : {question}

Réponds en français, de manière structurée, en citant les références juridiques pertinentes."""
    return await call_llm_text(FREEQUERY_SYSTEM, prompt, f"freeq_{project_id}")
