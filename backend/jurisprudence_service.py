"""Module 11 — Jurisprudence nationale uploadée + génération d'arguments."""
import os
import re
import json
from typing import List, Dict, Any
from emergentintegrations.llm.chat import LlmChat, UserMessage
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sk_cos


def _api_key():
    return os.environ.get("EMERGENT_LLM_KEY", "")


# ---------- Decision fragmentation ----------
DECISION_PATTERNS = [
    re.compile(r"(?im)^(arr[êe]t|jugement|d[ée]cision|ordonnance)\s+(?:n[°o]?\s*)?([\w\-/]+)", re.IGNORECASE),
    re.compile(r"(?im)^(?:Affaire|Dossier)\s+n[°o]?\s*([\w\-/]+)"),
]

FRENCH_STOPWORDS = [
    "le", "la", "les", "de", "des", "du", "un", "une", "et", "à", "au", "aux",
    "que", "qui", "ce", "cette", "ces", "se", "son", "sa", "ses", "il", "elle",
    "ils", "elles", "lui", "leur", "leurs", "dans", "sur", "pour", "par", "avec",
    "sans", "sous", "entre", "vers", "chez", "ou", "où", "donc", "or", "ni", "car",
    "mais", "est", "sont", "été", "être", "avoir", "ont", "comme", "tout", "tous",
    "toute", "toutes", "même", "aussi", "alors", "ainsi", "selon", "pendant", "avant",
    "après", "lors", "lorsque", "s", "n", "l", "attendu", "considérant",
]


def fragment_decision(full_text: str, default_court: str, default_year: int) -> Dict[str, Any]:
    """Extract metadata + ratio decidendi from a decision text."""
    if not full_text:
        return {}
    head = full_text[:3000]
    # Try to find case number
    case_number = ""
    for pat in DECISION_PATTERNS:
        m = pat.search(head)
        if m:
            case_number = m.group(2 if m.lastindex == 2 else 1)
            break
    # Try to find parties (X c. Y, X v. Y, X contre Y)
    parties = ""
    parties_pat = re.compile(r"([A-ZÉÈ][\w\.&\-\s']{2,40})\s+(?:c\.|v\.|contre)\s+([A-ZÉÈ][\w\.&\-\s']{2,40})")
    pm = parties_pat.search(head)
    if pm:
        parties = f"{pm.group(1).strip()} c. {pm.group(2).strip()}"
    # Year detection (from context)
    year = default_year
    ym = re.search(r"\b(19|20)\d{2}\b", head)
    if ym:
        try: year = int(ym.group(0))
        except Exception: pass
    return {
        "court": default_court,
        "case_number": case_number or "Non identifié",
        "parties": parties or "Non identifiées",
        "year": year,
        "full_text": full_text[:50000],
        "ratio_decidendi": full_text[:1500],  # first 1500 chars as preview
    }


# ---------- TF-IDF search ----------
def search_decisions(query: str, decisions: List[Dict[str, Any]], top_k: int = 8) -> List[Dict[str, Any]]:
    if not decisions or not query:
        return []
    texts = [(d.get("parties", "") or "") + " " + (d.get("ratio_decidendi", "") or "") + " " + (d.get("full_text", "") or "")[:3000] for d in decisions]
    vec = TfidfVectorizer(stop_words=FRENCH_STOPWORDS, max_features=8000, ngram_range=(1, 2), sublinear_tf=True)
    matrix = vec.fit_transform(texts)
    qvec = vec.transform([query])
    sims = sk_cos(qvec, matrix).flatten()
    ranked = sorted(enumerate(sims), key=lambda x: x[1], reverse=True)[:top_k]
    out = []
    for idx, score in ranked:
        if score <= 0:
            continue
        d = decisions[idx]
        out.append({
            "id": d.get("id"),
            "court": d.get("court"),
            "case_number": d.get("case_number"),
            "parties": d.get("parties"),
            "year": d.get("year"),
            "ratio_decidendi": d.get("ratio_decidendi"),
            "similarity": round(float(score), 4),
        })
    return out


# ---------- Argument generation (LLM) ----------
ARGUMENT_SYSTEM = """Tu es un juriste-avocat plaidant en droit international des investissements et droit minier.
Pour chaque violation détectée, tu produis un argumentaire jurisprudentiel défendable, opposable devant
les juridictions nationales, le CIRDI et les cours africaines.
Tu réponds UNIQUEMENT par un objet JSON valide."""


ARGUMENT_PROMPT = """À partir de la VIOLATION ci-dessous et des DÉCISIONS pertinentes (jurisprudence nationale uploadée + jurisprudence internationale pré-chargée),
construis un argumentaire complet.

VIOLATION :
{violation}

JURISPRUDENCE NATIONALE PERTINENTE :
{national}

JURISPRUDENCE INTERNATIONALE PERTINENTE :
{international}

Retourne ce JSON strict :
{{
  "argument_principal": {{
    "reference_principale": "string (Affaire + Juridiction + Année)",
    "ratio_decidendi_applicable": "string",
    "analogie_avec_cas_analyse": "string (en quoi le cas est transposable)",
    "force_argument": "forte|moyenne|faible"
  }},
  "arguments_secondaires": [
    {{"reference":"string","ratio_decidendi":"string","analogie":"string"}}
  ],
  "contre_arguments_previsibles": [
    {{"argument":"string (que la partie adverse pourrait invoquer)","reponse_recommandee":"string"}}
  ],
  "doctrine_applicable": ["string (Pacta sunt servanda, Rebus sic stantibus, contrats léonins, pollueur-payeur, etc.)"],
  "strategie_contentieuse": "string",
  "probabilite_succes_estimee": "faible|moyenne|elevee",
  "juridiction_optimale": "string (CIRDI / OHADA / juridiction nationale / Cour africaine)",
  "prescription_a_respecter": "string"
}}"""


def _clean_json(raw: str) -> Dict[str, Any]:
    if not raw: return {}
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try: return json.loads(raw)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", raw)
        if m:
            try: return json.loads(m.group(0))
            except Exception: pass
        return {"_parse_error": True}


async def generate_argument(violation: Dict[str, Any], national: List[Dict], international: List[Dict], project_id: str) -> Dict[str, Any]:
    key = _api_key()
    if not key:
        return {"_error": "EMERGENT_LLM_KEY non configurée"}
    try:
        chat = LlmChat(
            api_key=key,
            session_id=f"argument_{project_id}",
            system_message=ARGUMENT_SYSTEM,
        ).with_model("openai", "gpt-4o")
        prompt = ARGUMENT_PROMPT.format(
            violation=json.dumps(violation, ensure_ascii=False)[:3000],
            national=json.dumps(national, ensure_ascii=False)[:5000],
            international=json.dumps(international, ensure_ascii=False)[:5000],
        )
        resp = await chat.send_message(UserMessage(text=prompt))
        return _clean_json(resp)
    except Exception as e:
        return {"_error": str(e)}


# ---------- Amendment rewrite ----------
AMENDMENT_SYSTEM = """Tu es un juriste-rédacteur expert en contrats d'exploitation des ressources naturelles.
Tu réécris une clause défavorable pour la rendre conforme aux meilleures pratiques (PSA AIPN, NRGI,
Vision minière africaine, IFC). Tu préserves l'intention contractuelle légitime de l'investisseur
mais protèges la souveraineté de l'État, les communautés et l'environnement.
Tu réponds UNIQUEMENT par un objet JSON valide."""


AMENDMENT_PROMPT = """Réécris la clause suivante pour la rendre équilibrée et conforme aux standards internationaux.

CONTEXTE DE LA CONVENTION :
- Pays : {country}
- Secteur : {sector}
- Ressource : {resource}

CLAUSE ORIGINALE :
{original}

PROBLÈME IDENTIFIÉ :
{problem}

Retourne ce JSON strict :
{{
  "clause_proposee": "string (réécriture complète, prête à insérer)",
  "modifications_clés": ["string (chaque changement principal)"],
  "justification_juridique": "string (pourquoi cette réécriture est défendable)",
  "references_normatives": ["string (PSA AIPN art. X, IFC PS5, Rés. ONU 1803...)"],
  "leviers_de_negociation": ["string (arguments à utiliser face à l'investisseur)"],
  "compromis_alternatifs": [
    {{"variante":"string","avantage":"string","inconvenient":"string"}}
  ]
}}"""


async def rewrite_amendment(original: str, problem: str, country: str, sector: str, resource: str, project_id: str) -> Dict[str, Any]:
    key = _api_key()
    if not key:
        return {"_error": "EMERGENT_LLM_KEY non configurée"}
    try:
        chat = LlmChat(
            api_key=key,
            session_id=f"amend_{project_id}",
            system_message=AMENDMENT_SYSTEM,
        ).with_model("openai", "gpt-4o")
        prompt = AMENDMENT_PROMPT.format(
            country=country, sector=sector, resource=resource,
            original=original[:3000], problem=problem[:1000],
        )
        resp = await chat.send_message(UserMessage(text=prompt))
        return _clean_json(resp)
    except Exception as e:
        return {"_error": str(e)}
