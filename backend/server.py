"""RESOURCES-ANALYZER PRO — FastAPI server.
Author: Ahmed ELY Mustapha — Methodology
"""
import os
import logging
from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from typing import List, Optional
import io
import uuid

from models import (
    UserCreate, UserLogin, UserPublic, TokenResponse,
    ProjectCreate, Project,
    Document, Analysis, FreeQueryRequest,
    Diagnostic, ReportRequest, SimulatorRequest,
)
from auth import hash_password, verify_password, create_token, get_current_user_id
from extraction import extract_document
from llm_service import (
    extract_convention_data, juridical_analysis, diagnostic_generation, free_query,
)
from analyses import run_all_pure_analyses, simulate
from diagnostics import derive_diagnostics_summary
from reports import generate_pdf
from reports_advanced import generate_word, generate_excel, generate_rejd_zip
from normative_data import NORMATIVE_REFERENCES, INTERNATIONAL_JURISPRUDENCE, GLOSSARY
from conventions_models import CONVENTION_MODELS, DEMO_CONVENTIONS
from bln_service import (
    fragment_articles, embed_text, embed_batch,
    search_articles, confront_clauses_with_law,
)
from collection_service import collect_all_sources, generate_company_reputation


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="RESOURCES-ANALYZER PRO API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("rap")


# -------- Helpers --------
async def _get_user(user_id: str):
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


async def _check_project(project_id: str, user_id: str):
    proj = await db.projects.find_one({"id": project_id, "user_id": user_id}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    return proj


# ============ ROOT ============
@api.get("/")
async def root():
    return {
        "app": "RESOURCES-ANALYZER PRO",
        "subtitle": "La transparence contractuelle au service du peuple",
        "author": "Ahmed ELY Mustapha",
        "status": "ok",
    }


# ============ AUTH ============
@api.post("/auth/register", response_model=TokenResponse)
async def register(payload: UserCreate):
    existing = await db.users.find_one({"email": payload.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="Cet email est déjà enregistré")
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": payload.email,
        "name": payload.name,
        "organization": payload.organization or "",
        "country": payload.country or "",
        "role": payload.role,
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_doc["id"], user_doc["email"])
    public = {k: v for k, v in user_doc.items() if k != "password_hash"}
    return {"access_token": token, "token_type": "bearer", "user": public}


@api.post("/auth/login", response_model=TokenResponse)
async def login(payload: UserLogin):
    u = await db.users.find_one({"email": payload.email}, {"_id": 0})
    if not u or not verify_password(payload.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    token = create_token(u["id"], u["email"])
    public = {k: v for k, v in u.items() if k != "password_hash"}
    return {"access_token": token, "token_type": "bearer", "user": public}


@api.get("/auth/me", response_model=UserPublic)
async def me(uid: str = Depends(get_current_user_id)):
    u = await _get_user(uid)
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return u


# ============ PROJECTS ============
@api.post("/projects", response_model=Project)
async def create_project(payload: ProjectCreate, uid: str = Depends(get_current_user_id)):
    proj = Project(user_id=uid, **payload.model_dump())
    await db.projects.insert_one(proj.model_dump())
    return proj


@api.get("/projects", response_model=List[Project])
async def list_projects(uid: str = Depends(get_current_user_id)):
    items = await db.projects.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, uid: str = Depends(get_current_user_id)):
    return await _check_project(project_id, uid)


@api.delete("/projects/{project_id}")
async def delete_project(project_id: str, uid: str = Depends(get_current_user_id)):
    await _check_project(project_id, uid)
    await db.projects.delete_one({"id": project_id, "user_id": uid})
    await db.documents.delete_many({"project_id": project_id})
    await db.analyses.delete_many({"project_id": project_id})
    return {"deleted": True}


# ============ DOCUMENTS ============
@api.post("/projects/{project_id}/documents")
async def upload_document(
    project_id: str,
    doc_type: str = Form("A1"),
    file: UploadFile = File(...),
    uid: str = Depends(get_current_user_id),
):
    await _check_project(project_id, uid)
    content = await file.read()
    if len(content) > 200 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 200 Mo)")
    raw_text, _ = extract_document(file.filename, content)
    doc = Document(
        project_id=project_id,
        user_id=uid,
        filename=file.filename,
        doc_type=doc_type,
        file_size=len(content),
        raw_text_excerpt=raw_text[:2000],
    )
    doc_dict = doc.model_dump()
    # Save full raw text separately (large)
    doc_dict["_raw_text_full"] = raw_text[:200000]
    await db.documents.insert_one(doc_dict)
    return doc


@api.get("/projects/{project_id}/documents", response_model=List[Document])
async def list_documents(project_id: str, uid: str = Depends(get_current_user_id)):
    await _check_project(project_id, uid)
    items = await db.documents.find(
        {"project_id": project_id},
        {"_id": 0, "_raw_text_full": 0}
    ).sort("created_at", -1).to_list(500)
    return items


@api.get("/documents/{document_id}", response_model=Document)
async def get_document(document_id: str, uid: str = Depends(get_current_user_id)):
    d = await db.documents.find_one({"id": document_id, "user_id": uid}, {"_id": 0, "_raw_text_full": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Document introuvable")
    return d


@api.delete("/documents/{document_id}")
async def delete_document(document_id: str, uid: str = Depends(get_current_user_id)):
    await db.documents.delete_one({"id": document_id, "user_id": uid})
    return {"deleted": True}


@api.post("/documents/{document_id}/extract")
async def extract_document_data(document_id: str, uid: str = Depends(get_current_user_id)):
    """Run a SINGLE GPT-4o call to extract structured convention data.
    Cached: if extracted_data already exists, return it immediately."""
    d = await db.documents.find_one({"id": document_id, "user_id": uid}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Document introuvable")
    if d.get("extracted_data"):
        return {"cached": True, "extracted_data": d["extracted_data"]}
    raw = d.get("_raw_text_full", "") or d.get("raw_text_excerpt", "")
    if not raw or len(raw) < 100:
        raise HTTPException(status_code=400, detail="Texte du document trop court pour extraction")
    extracted = await extract_convention_data(raw, document_id)
    if "_error" in extracted:
        raise HTTPException(status_code=500, detail=f"Erreur LLM: {extracted.get('_error')}")
    confidence = int(extracted.get("extraction_confidence") or 70)
    await db.documents.update_one(
        {"id": document_id},
        {"$set": {"extracted_data": extracted, "quality_score": confidence}}
    )
    return {"cached": False, "extracted_data": extracted, "quality_score": confidence}


@api.put("/documents/{document_id}/extracted")
async def update_extracted(document_id: str, extracted: dict, uid: str = Depends(get_current_user_id)):
    await db.documents.update_one(
        {"id": document_id, "user_id": uid},
        {"$set": {"extracted_data": extracted, "validated": True}}
    )
    return {"updated": True}


# ============ ANALYSES ============
@api.post("/projects/{project_id}/analyses/run")
async def run_analyses(project_id: str, uid: str = Depends(get_current_user_id)):
    """Run all pure analyses (financier, env, social, IDC, SOS) — ZERO LLM.
    Uses extracted data from the latest validated document of the project."""
    await _check_project(project_id, uid)
    docs = await db.documents.find(
        {"project_id": project_id, "extracted_data": {"$ne": None}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    if not docs:
        raise HTTPException(status_code=400, detail="Aucun document avec données extraites trouvé pour ce projet.")
    extracted = docs[0].get("extracted_data") or {}
    results = run_all_pure_analyses(extracted)
    # Persist
    await db.analyses.delete_many({"project_id": project_id, "analysis_type": {"$in": ["financier", "environnemental", "social", "desequilibre", "souverainete"]}})
    now = datetime.now(timezone.utc).isoformat()
    for k, v in results.items():
        type_map = {
            "financier": "financier", "environnemental": "environnemental",
            "social": "social", "desequilibre": "desequilibre", "souverainete": "souverainete",
        }
        await db.analyses.insert_one({
            "id": str(uuid.uuid4()), "project_id": project_id,
            "analysis_type": type_map[k], "results": v, "created_at": now
        })
    return results


@api.post("/projects/{project_id}/analyses/juridique")
async def run_juridical(project_id: str, uid: str = Depends(get_current_user_id)):
    """Single LLM call for the juridical analysis. Cached."""
    await _check_project(project_id, uid)
    cached = await db.analyses.find_one(
        {"project_id": project_id, "analysis_type": "juridique"},
        {"_id": 0}
    )
    if cached and cached.get("results"):
        return {"cached": True, "results": cached["results"]}
    docs = await db.documents.find(
        {"project_id": project_id, "extracted_data": {"$ne": None}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    if not docs:
        raise HTTPException(status_code=400, detail="Aucun document extrait pour ce projet.")
    extracted = docs[0].get("extracted_data") or {}
    res = await juridical_analysis(extracted, project_id)
    if "_error" in res:
        raise HTTPException(status_code=500, detail=res["_error"])
    await db.analyses.insert_one({
        "id": str(uuid.uuid4()), "project_id": project_id,
        "analysis_type": "juridique", "results": res,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"cached": False, "results": res}


@api.post("/projects/{project_id}/diagnostics/generate")
async def generate_diagnostics(project_id: str, uid: str = Depends(get_current_user_id)):
    """Single LLM call to produce diagnostic fiches from juridical analysis."""
    await _check_project(project_id, uid)
    jur = await db.analyses.find_one(
        {"project_id": project_id, "analysis_type": "juridique"}, {"_id": 0}
    )
    if not jur:
        raise HTTPException(status_code=400, detail="Lancez d'abord l'analyse juridique.")
    cached = await db.analyses.find_one(
        {"project_id": project_id, "analysis_type": "diagnostic"}, {"_id": 0}
    )
    if cached and cached.get("results"):
        return {"cached": True, "results": cached["results"]}
    res = await diagnostic_generation(jur["results"], project_id)
    if "_error" in res:
        raise HTTPException(status_code=500, detail=res["_error"])
    await db.analyses.insert_one({
        "id": str(uuid.uuid4()), "project_id": project_id,
        "analysis_type": "diagnostic", "results": res,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"cached": False, "results": res}


@api.get("/projects/{project_id}/analyses")
async def get_all_analyses(project_id: str, uid: str = Depends(get_current_user_id)):
    await _check_project(project_id, uid)
    items = await db.analyses.find({"project_id": project_id}, {"_id": 0}).to_list(100)
    out = {}
    for a in items:
        out[a["analysis_type"]] = a["results"]
    return out


@api.get("/projects/{project_id}/dashboard")
async def get_dashboard(project_id: str, uid: str = Depends(get_current_user_id)):
    proj = await _check_project(project_id, uid)
    items = await db.analyses.find({"project_id": project_id}, {"_id": 0}).to_list(100)
    analyses = {a["analysis_type"]: a["results"] for a in items}
    # Count documents
    doc_count = await db.documents.count_documents({"project_id": project_id})
    extracted_count = await db.documents.count_documents(
        {"project_id": project_id, "extracted_data": {"$ne": None}}
    )
    summary = derive_diagnostics_summary(analyses)
    return {
        "project": proj,
        "summary": summary,
        "analyses": analyses,
        "documents_count": doc_count,
        "extracted_count": extracted_count,
    }


@api.post("/projects/{project_id}/freequery")
async def free_query_endpoint(project_id: str, payload: FreeQueryRequest, uid: str = Depends(get_current_user_id)):
    await _check_project(project_id, uid)
    docs = await db.documents.find(
        {"project_id": project_id, "extracted_data": {"$ne": None}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(5)
    context = docs[0].get("extracted_data") if docs else {}
    answer = await free_query(payload.question, context or {}, project_id)
    # Persist
    await db.analyses.insert_one({
        "id": str(uuid.uuid4()), "project_id": project_id,
        "analysis_type": "requete",
        "results": {"question": payload.question, "answer": answer},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"question": payload.question, "answer": answer}


# ============ SIMULATOR ============
@api.post("/simulator/run")
async def simulator(payload: SimulatorRequest, uid: str = Depends(get_current_user_id)):
    return simulate(payload.model_dump())


# ============ NORMATIVE REFERENTIAL ============
@api.get("/normative/references")
async def list_normative():
    return {"families": [
        {"id": 1, "name": "Droit international des ressources naturelles"},
        {"id": 2, "name": "Droit régional africain"},
        {"id": 3, "name": "Droit national (utilisateur)"},
        {"id": 4, "name": "Standards contractuels internationaux"},
        {"id": 5, "name": "Indicateurs de référence sectorielle"},
        {"id": 6, "name": "Doctrine juridique de référence"},
    ], "items": NORMATIVE_REFERENCES}


@api.get("/normative/jurisprudence")
async def list_jurisprudence():
    return {"items": INTERNATIONAL_JURISPRUDENCE}


@api.get("/normative/glossary")
async def list_glossary():
    return {"items": GLOSSARY}


# ============ REPORTS ============
@api.post("/reports/generate")
async def generate_report(payload: ReportRequest, uid: str = Depends(get_current_user_id)):
    proj = await _check_project(payload.project_id, uid)
    items = await db.analyses.find({"project_id": payload.project_id}, {"_id": 0}).to_list(100)
    analyses = {a["analysis_type"]: a["results"] for a in items}
    summary = derive_diagnostics_summary(analyses)
    report_data = {
        "summary": summary,
        "juridique": analyses.get("juridique") or {},
        "diagnostics": analyses.get("diagnostic") or {},
        "financier": analyses.get("financier") or {},
        "environnemental": analyses.get("environnemental") or {},
        "social": analyses.get("social") or {},
        "souverainete": analyses.get("souverainete") or {},
        "desequilibre": analyses.get("desequilibre") or {},
        "bln": analyses.get("bln_confrontation") or {},
    }
    pdf_bytes = generate_pdf(proj, report_data, payload.preset)
    safe_name = (proj.get("name") or "rapport").replace(" ", "_")[:40]
    fname = f"RAP_{payload.preset}_{safe_name}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'}
    )


@api.post("/reports/generate-word")
async def generate_word_report(payload: ReportRequest, uid: str = Depends(get_current_user_id)):
    proj = await _check_project(payload.project_id, uid)
    items = await db.analyses.find({"project_id": payload.project_id}, {"_id": 0}).to_list(100)
    analyses = {a["analysis_type"]: a["results"] for a in items}
    summary = derive_diagnostics_summary(analyses)
    report_data = {
        "summary": summary,
        "juridique": analyses.get("juridique") or {},
        "diagnostics": analyses.get("diagnostic") or {},
        "financier": analyses.get("financier") or {},
        "environnemental": analyses.get("environnemental") or {},
        "social": analyses.get("social") or {},
        "souverainete": analyses.get("souverainete") or {},
        "desequilibre": analyses.get("desequilibre") or {},
    }
    docx_bytes = generate_word(proj, report_data, payload.preset)
    safe_name = (proj.get("name") or "rapport").replace(" ", "_")[:40]
    fname = f"RAP_{payload.preset}_{safe_name}_{datetime.now().strftime('%Y%m%d')}.docx"
    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'}
    )


@api.post("/reports/generate-excel")
async def generate_excel_report(payload: ReportRequest, uid: str = Depends(get_current_user_id)):
    proj = await _check_project(payload.project_id, uid)
    items = await db.analyses.find({"project_id": payload.project_id}, {"_id": 0}).to_list(100)
    analyses = {a["analysis_type"]: a["results"] for a in items}
    summary = derive_diagnostics_summary(analyses)
    report_data = {
        "summary": summary,
        "juridique": analyses.get("juridique") or {},
        "diagnostics": analyses.get("diagnostic") or {},
        "financier": analyses.get("financier") or {},
        "environnemental": analyses.get("environnemental") or {},
        "social": analyses.get("social") or {},
        "souverainete": analyses.get("souverainete") or {},
        "desequilibre": analyses.get("desequilibre") or {},
    }
    xlsx_bytes = generate_excel(proj, report_data)
    safe_name = (proj.get("name") or "rapport").replace(" ", "_")[:40]
    fname = f"RAP_{safe_name}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        io.BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'}
    )


@api.post("/reports/generate-zip")
async def generate_zip_report(payload: ReportRequest, uid: str = Depends(get_current_user_id)):
    """REJD complete pack: PDF + Word + Excel + JSON in a single ZIP."""
    proj = await _check_project(payload.project_id, uid)
    items = await db.analyses.find({"project_id": payload.project_id}, {"_id": 0}).to_list(100)
    analyses = {a["analysis_type"]: a["results"] for a in items}
    summary = derive_diagnostics_summary(analyses)
    report_data = {
        "summary": summary,
        "juridique": analyses.get("juridique") or {},
        "diagnostics": analyses.get("diagnostic") or {},
        "financier": analyses.get("financier") or {},
        "environnemental": analyses.get("environnemental") or {},
        "social": analyses.get("social") or {},
        "souverainete": analyses.get("souverainete") or {},
        "desequilibre": analyses.get("desequilibre") or {},
    }
    pdf_bytes = generate_pdf(proj, report_data, "rejd")
    zip_bytes = generate_rejd_zip(proj, report_data, pdf_bytes)
    safe_name = (proj.get("name") or "rapport").replace(" ", "_")[:40]
    fname = f"REJD_PACK_{safe_name}_{datetime.now().strftime('%Y%m%d')}.zip"
    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'}
    )


# ============ MODULE 7 — BLN (BIBLIOTHÈQUE LÉGISLATIVE NATIONALE) ============
@api.post("/projects/{project_id}/bln/upload")
async def upload_national_law(
    project_id: str,
    law_code: str = Form(...),  # mines | hydro | env | penal | invest | etc.
    file: UploadFile = File(...),
    uid: str = Depends(get_current_user_id),
):
    """Upload a national law text. Fragmented into articles. TF-IDF search later."""
    await _check_project(project_id, uid)
    content = await file.read()
    raw_text, _ = extract_document(file.filename, content)
    if not raw_text or len(raw_text) < 200:
        raise HTTPException(status_code=400, detail="Texte trop court ou non extractible.")

    articles = fragment_articles(raw_text)
    if not articles:
        raise HTTPException(status_code=400, detail="Aucun article détecté dans le document.")

    now = datetime.now(timezone.utc).isoformat()
    docs = []
    for art in articles:
        docs.append({
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "user_id": uid,
            "law_code": law_code,
            "law_filename": file.filename,
            "article_number": art.get("article_number"),
            "article_title": art.get("article_title"),
            "article_text": art.get("article_text"),
            "created_at": now,
        })
    if docs:
        await db.national_law_articles.insert_many(docs)
    return {"law_code": law_code, "articles_indexed": len(docs), "filename": file.filename}


@api.get("/projects/{project_id}/bln/articles")
async def list_national_articles(project_id: str, uid: str = Depends(get_current_user_id)):
    await _check_project(project_id, uid)
    items = await db.national_law_articles.find(
        {"project_id": project_id},
        {"_id": 0}
    ).to_list(2000)
    by_code = {}
    for it in items:
        by_code.setdefault(it["law_code"], []).append(it)
    return {"by_code": by_code, "total": len(items)}


@api.delete("/projects/{project_id}/bln/code/{law_code}")
async def delete_law_code(project_id: str, law_code: str, uid: str = Depends(get_current_user_id)):
    await _check_project(project_id, uid)
    res = await db.national_law_articles.delete_many({"project_id": project_id, "law_code": law_code})
    return {"deleted": res.deleted_count}


@api.post("/projects/{project_id}/bln/search")
async def bln_semantic_search(
    project_id: str,
    payload: dict,
    uid: str = Depends(get_current_user_id),
):
    """TF-IDF cosine search across all uploaded national articles."""
    await _check_project(project_id, uid)
    query = (payload.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Requête vide.")
    items = await db.national_law_articles.find({"project_id": project_id}, {"_id": 0}).to_list(2000)
    results = search_articles(query, items, top_k=int(payload.get("top_k") or 8))
    return {"query": query, "results": results}


@api.post("/projects/{project_id}/bln/confront")
async def bln_confront(project_id: str, uid: str = Depends(get_current_user_id)):
    """Match each clause of the convention with most similar national law articles
    and qualify the relation via 1 grouped GPT-4o call. Cached."""
    await _check_project(project_id, uid)
    cached = await db.analyses.find_one(
        {"project_id": project_id, "analysis_type": "bln_confrontation"}, {"_id": 0}
    )
    if cached and cached.get("results"):
        return {"cached": True, "results": cached["results"]}

    docs = await db.documents.find(
        {"project_id": project_id, "extracted_data": {"$ne": None}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(5)
    if not docs:
        raise HTTPException(status_code=400, detail="Aucun document extrait.")
    extracted = docs[0].get("extracted_data") or {}
    clauses_sensibles = (extracted.get("clauses_sensibles") or [])[:10]

    articles = await db.national_law_articles.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(2000)
    if not articles:
        raise HTTPException(status_code=400, detail="Aucun article législatif national indexé. Téléversez d'abord le code minier / pétrolier / etc.")

    # For each sensitive clause, find top 3 articles
    matched = []
    for c in clauses_sensibles:
        clause_text = c.get("texte_exact") or c.get("analyse_preliminaire", "")
        if not clause_text:
            continue
        top = search_articles(clause_text, articles, top_k=3)
        matched.append({
            "clause": c,
            "top_articles": [{
                "code": a.get("law_code"),
                "article": a.get("article_number"),
                "article_title": a.get("article_title"),
                "article_text": (a.get("article_text") or "")[:1500],
                "similarity": a.get("similarity"),
            } for a in top]
        })
    if not matched:
        raise HTTPException(status_code=400, detail="Aucune clause sensible exploitable.")

    res = await confront_clauses_with_law(
        clauses=[m["clause"] for m in matched],
        top_articles=[a for m in matched for a in m["top_articles"]],
        project_id=project_id,
    )
    if "_error" in res:
        raise HTTPException(status_code=500, detail=res["_error"])

    await db.analyses.insert_one({
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "analysis_type": "bln_confrontation",
        "results": res,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"cached": False, "results": res, "matched_clauses": len(matched)}


# ============ MODULE 9 — COLLECTE AUTOMATIQUE ============
@api.post("/projects/{project_id}/collection/run")
async def run_collection(project_id: str, uid: str = Depends(get_current_user_id)):
    """Run all 10 connectors. Stores items in collected_resources collection."""
    proj = await _check_project(project_id, uid)
    sector = proj.get("sector", "mines")
    country = proj.get("country", "")
    data = collect_all_sources(country, sector)
    # Persist
    now = datetime.now(timezone.utc).isoformat()
    inserts = []
    for it in data["items"]:
        inserts.append({
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "user_id": uid,
            **it,
            "created_at": now,
        })
    if inserts:
        # Replace previous
        await db.collected_resources.delete_many({"project_id": project_id})
        await db.collected_resources.insert_many(inserts)
    return {"sources": data["sources"], "items_count": len(inserts)}


@api.get("/projects/{project_id}/collection")
async def list_collection(project_id: str, uid: str = Depends(get_current_user_id)):
    await _check_project(project_id, uid)
    items = await db.collected_resources.find(
        {"project_id": project_id}, {"_id": 0}
    ).sort("relevance", -1).to_list(500)
    by_source = {}
    for it in items:
        by_source.setdefault(it.get("source_name", "?"), []).append(it)
    return {"by_source": by_source, "total": len(items)}


@api.put("/projects/{project_id}/collection/{item_id}/status")
async def update_collection_status(
    project_id: str, item_id: str, status: str,
    uid: str = Depends(get_current_user_id),
):
    await _check_project(project_id, uid)
    await db.collected_resources.update_one(
        {"id": item_id, "project_id": project_id},
        {"$set": {"status": status}}
    )
    return {"updated": True}


@api.post("/projects/{project_id}/reputation")
async def fetch_reputation(project_id: str, uid: str = Depends(get_current_user_id)):
    """Generate reputation profile for the company in the latest extracted document."""
    await _check_project(project_id, uid)
    docs = await db.documents.find(
        {"project_id": project_id, "extracted_data": {"$ne": None}}, {"_id": 0}
    ).sort("created_at", -1).to_list(5)
    if not docs:
        raise HTTPException(status_code=400, detail="Aucun document extrait.")
    company = (docs[0].get("extracted_data") or {}).get("company") or "Inconnu"
    profile = generate_company_reputation(company)
    await db.company_reputation.update_one(
        {"project_id": project_id, "company_name": company},
        {"$set": {**profile, "project_id": project_id, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return profile


@api.get("/projects/{project_id}/reputation")
async def get_reputation(project_id: str, uid: str = Depends(get_current_user_id)):
    await _check_project(project_id, uid)
    items = await db.company_reputation.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(50)
    return {"items": items}


# ============ CONVENTION MODELS ============
@api.get("/conventions/models")
async def list_models():
    return {"items": CONVENTION_MODELS, "demos": DEMO_CONVENTIONS}


# ----- Mount + CORS -----
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
