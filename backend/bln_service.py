"""Module 7 — Bibliothèque Législative Nationale (BLN).
- Upload textes législatifs nationaux
- Fragmentation par articles
- Recherche TF-IDF (locale, sans API) pour cosinus rapide
- Confrontation convention / loi via 1 appel GPT-4o groupé
"""
import os
import re
import json
from typing import List, Dict, Any
from emergentintegrations.llm.chat import LlmChat, UserMessage
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sk_cos


def _api_key():
    return os.environ.get("EMERGENT_LLM_KEY", "")


# ---------- Article fragmentation ----------
ARTICLE_PATTERNS = [
    re.compile(r"(?im)^\s*Article\s+(\d+(?:[-\.]?\d*)*)\s*[\.\:\-—]?\s*(.{0,200})$"),
    re.compile(r"(?im)^\s*Art\.\s*(\d+(?:[-\.]?\d*)*)\s*[\.\:\-—]?\s*(.{0,200})$"),
]

FRENCH_STOPWORDS = [
    "le", "la", "les", "de", "des", "du", "un", "une", "et", "à", "au", "aux",
    "que", "qui", "ce", "cette", "ces", "se", "son", "sa", "ses", "il", "elle",
    "ils", "elles", "lui", "leur", "leurs", "dans", "sur", "pour", "par", "avec",
    "sans", "sous", "entre", "vers", "chez", "ou", "où", "donc", "or", "ni", "car",
    "mais", "est", "sont", "été", "être", "avoir", "ont", "avait", "avaient",
    "comme", "tout", "tous", "toute", "toutes", "même", "aussi", "alors", "ainsi",
    "selon", "pendant", "avant", "après", "lors", "lorsque", "s", "n", "l",
]


def fragment_articles(full_text: str) -> List[Dict[str, str]]:
    """Naive but robust fragmentation by 'Article N' markers."""
    if not full_text:
        return []
    matches = []
    for pat in ARTICLE_PATTERNS:
        for m in pat.finditer(full_text):
            matches.append((m.start(), m.group(1).strip(), (m.group(2) or "").strip()))
    if not matches:
        paragraphs = [p.strip() for p in full_text.split("\n\n") if len(p.strip()) > 80]
        return [
            {"article_number": str(i + 1), "article_title": p[:80], "article_text": p}
            for i, p in enumerate(paragraphs[:300])
        ]
    matches.sort(key=lambda x: x[0])
    out = []
    for i, (pos, num, title) in enumerate(matches):
        end = matches[i + 1][0] if i + 1 < len(matches) else len(full_text)
        text = full_text[pos:end].strip()
        if len(text) < 30:
            continue
        out.append({
            "article_number": num,
            "article_title": title[:200] if title else f"Article {num}",
            "article_text": text[:5000],
        })
    return out[:500]


# ---------- TF-IDF embeddings (local, no API) ----------
def build_tfidf(texts: List[str]):
    """Returns (vectorizer, matrix). Empty-safe."""
    if not texts:
        return None, None
    vec = TfidfVectorizer(
        stop_words=FRENCH_STOPWORDS,
        max_features=8000,
        ngram_range=(1, 2),
        sublinear_tf=True,
    )
    matrix = vec.fit_transform(texts)
    return vec, matrix


def vector_for_article(text: str) -> List[float]:
    """Compatibility: keep function signature similar, but we use sparse rep stored as list of indices+values.
    For storage simplicity, we will NOT pre-compute per-article — TF-IDF is fitted at search time."""
    # Returning empty list as marker — the actual fitting happens in search_articles
    return []


# Cache results per project
_TFIDF_CACHE: Dict[str, Any] = {}


def search_articles(query: str, articles: List[Dict[str, Any]], top_k: int = 8) -> List[Dict[str, Any]]:
    """TF-IDF + cosine search. Articles must have 'article_text' field."""
    if not articles or not query:
        return []
    texts = [(a.get("article_title", "") or "") + " " + (a.get("article_text", "") or "") for a in articles]
    vec, matrix = build_tfidf(texts)
    if vec is None:
        return []
    qvec = vec.transform([query])
    sims = sk_cos(qvec, matrix).flatten()
    ranked = sorted(enumerate(sims), key=lambda x: x[1], reverse=True)[:top_k]
    out = []
    for idx, score in ranked:
        if score <= 0:
            continue
        a = articles[idx]
        out.append({
            "law_code": a.get("law_code"),
            "article_number": a.get("article_number"),
            "article_title": a.get("article_title"),
            "article_text": a.get("article_text"),
            "similarity": round(float(score), 4),
        })
    return out


# Backward-compatible aliases
async def embed_text(text: str) -> List[float]:
    return []  # Not used (TF-IDF is on-the-fly)


async def embed_batch(texts: List[str]) -> List[List[float]]:
    return [[] for _ in texts]


# ---------- Confrontation convention/loi ----------
CONFRONTATION_SYSTEM = """Tu es un juriste expert en droit minier, pétrolier, gazier, droit constitutionnel et droit pénal des affaires.
Tu compares des clauses d'une convention d'exploitation à un panel d'articles de lois nationales pour identifier
les conformités, dérogations, contrariétés et qualifications juridiques précises.
Tu réponds UNIQUEMENT par un objet JSON valide, sans markdown ni texte autour."""


CONFRONTATION_PROMPT = """Pour chaque clause de la convention, identifie les articles nationaux applicables fournis ci-dessous,
puis qualifie la relation juridique avec rigueur.

CLAUSES DE LA CONVENTION (extraites) :
{clauses}

ARTICLES NATIONAUX CANDIDATS (top similarité TF-IDF) :
{articles}

Retourne ce JSON strict :
{{
  "confrontations": [
    {{
      "clause_convention": "string",
      "texte_clause": "string",
      "articles_nationaux_applicables": [
        {{"code":"string","article":"string","texte_article":"string","type_relation":"conforme|derogatoire|contraire|silence_loi|plus_favorable_investisseur|plus_favorable_etat"}}
      ],
      "conformite_droit_national": "conforme|partiellement|contraire",
      "nature_violation_nationale": "string",
      "qualification_juridique_precise": "string",
      "fondement_legal_action": ["string"],
      "gravite": "mineure|moderee|grave|critique",
      "solution_legislative": "string",
      "solution_judiciaire": "string",
      "juridiction_nationale_competente": "string",
      "delai_prescription_national": "string"
    }}
  ],
  "derogations_illegales": [
    {{
      "clause": "string",
      "code_viole": "string",
      "article_viole": "string",
      "type_derogation": "fiscale|environnementale|fonciere|procedurale|penale",
      "qualification_juridique": "string",
      "gravite": "mineure|moderee|grave|critique"
    }}
  ]
}}"""


def _clean_json(raw: str) -> Dict[str, Any]:
    if not raw:
        return {}
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", raw)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
        return {"_parse_error": True}


async def confront_clauses_with_law(clauses: List[Dict], top_articles: List[Dict], project_id: str) -> Dict[str, Any]:
    key = _api_key()
    if not key:
        return {"_error": "EMERGENT_LLM_KEY non configurée"}
    try:
        chat = LlmChat(
            api_key=key,
            session_id=f"bln_confront_{project_id}",
            system_message=CONFRONTATION_SYSTEM,
        ).with_model("openai", "gpt-4o")
        prompt = CONFRONTATION_PROMPT.format(
            clauses=json.dumps(clauses, ensure_ascii=False)[:6000],
            articles=json.dumps(top_articles, ensure_ascii=False)[:8000],
        )
        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        return _clean_json(response)
    except Exception as e:
        return {"_error": str(e)}
