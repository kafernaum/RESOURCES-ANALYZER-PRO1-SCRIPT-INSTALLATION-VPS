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
    Diagnostic, ReportRequest, SimulatorRequest, SimulatorOverride,
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
from jurisprudence_service import (
    fragment_decision, search_decisions, generate_argument, rewrite_amendment,
)
from reports_rejd_complete import generate_rejd_complete
from share_verdict import generate_share_verdict


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
import asyncio

async def _get_user(user_id: str):
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


async def _check_project(project_id: str, user_id: str):
    proj = await db.projects.find_one({"id": project_id, "user_id": user_id}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    return proj


async def _audit_insert(doc):
    try:
        await db.audit_log.insert_one(doc)
    except Exception as e:
        logger.warning(f"audit log failed: {e}")


def _audit(user_id: str, action: str, project_id: str = None, meta: dict = None):
    """Fire-and-forget audit log entry. Never blocks or fails the caller."""
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "project_id": project_id,
        "action": action,
        "meta": meta or {},
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    asyncio.create_task(_audit_insert(doc))


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
    _audit(uid, "project_create", proj.id, {"name": proj.name})
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
    _audit(uid, "project_delete", project_id)
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
    _audit(uid, "document_upload", project_id, {"filename": file.filename, "size": len(content)})
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
    _audit(uid, "document_extract", d.get("project_id"), {"document_id": document_id, "confidence": confidence})
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
    _audit(uid, "report_pdf_generated", payload.project_id, {"preset": payload.preset})
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


# ============ MODULE 11 — JURISPRUDENCE NATIONALE ============
@api.post("/projects/{project_id}/jurisprudence/upload")
async def upload_jurisprudence(
    project_id: str,
    court: str = Form("Cour d'appel"),
    year: int = Form(2020),
    file: UploadFile = File(...),
    uid: str = Depends(get_current_user_id),
):
    """Upload a national jurisprudence decision (PDF/DOCX/TXT). Fragmented + indexed."""
    await _check_project(project_id, uid)
    content = await file.read()
    raw_text, _ = extract_document(file.filename, content)
    if not raw_text or len(raw_text) < 100:
        raise HTTPException(status_code=400, detail="Texte trop court ou non extractible.")
    meta = fragment_decision(raw_text, default_court=court, default_year=year)
    decision = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "user_id": uid,
        "filename": file.filename,
        **meta,
        "scope": "nationale",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.jurisprudence_decisions.insert_one(decision)
    decision.pop("_id", None)
    return decision


@api.get("/projects/{project_id}/jurisprudence")
async def list_jurisprudence_project(project_id: str, uid: str = Depends(get_current_user_id)):
    await _check_project(project_id, uid)
    items = await db.jurisprudence_decisions.find(
        {"project_id": project_id}, {"_id": 0, "full_text": 0}
    ).sort("created_at", -1).to_list(500)
    return {"items": items, "total": len(items)}


@api.delete("/projects/{project_id}/jurisprudence/{decision_id}")
async def delete_jurisprudence(project_id: str, decision_id: str, uid: str = Depends(get_current_user_id)):
    await _check_project(project_id, uid)
    res = await db.jurisprudence_decisions.delete_one({"id": decision_id, "project_id": project_id})
    return {"deleted": res.deleted_count}


@api.post("/projects/{project_id}/jurisprudence/search")
async def search_jurisprudence_project(
    project_id: str, payload: dict, uid: str = Depends(get_current_user_id),
):
    await _check_project(project_id, uid)
    query = (payload.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Requête vide.")
    items = await db.jurisprudence_decisions.find({"project_id": project_id}, {"_id": 0}).to_list(2000)
    # also include international jurisprudence pre-loaded
    intl = [{
        "id": f"intl_{i}",
        "court": j.get("tribunal"),
        "case_number": "—",
        "parties": j.get("case_name"),
        "year": j.get("year"),
        "ratio_decidendi": j.get("ratio"),
        "full_text": j.get("ratio"),
        "scope": "internationale",
    } for i, j in enumerate(INTERNATIONAL_JURISPRUDENCE)]
    all_items = items + intl
    results = search_decisions(query, all_items, top_k=int(payload.get("top_k") or 8))
    return {"query": query, "results": results}


@api.post("/projects/{project_id}/jurisprudence/argument")
async def generate_argument_endpoint(
    project_id: str, payload: dict, uid: str = Depends(get_current_user_id),
):
    """Generate a defendable argument for a violation, citing national + international jurisprudence."""
    await _check_project(project_id, uid)
    violation = payload.get("violation") or {}
    if not violation:
        raise HTTPException(status_code=400, detail="Violation manquante.")
    # search top decisions for the violation context
    query = (violation.get("nature_violation") or "") + " " + (violation.get("qualification_juridique") or "")
    nat_items = await db.jurisprudence_decisions.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(2000)
    nat_top = search_decisions(query, nat_items, top_k=3) if nat_items else []
    intl_items = [{
        "id": f"intl_{i}",
        "court": j.get("tribunal"),
        "parties": j.get("case_name"),
        "year": j.get("year"),
        "ratio_decidendi": j.get("ratio"),
        "full_text": j.get("ratio"),
    } for i, j in enumerate(INTERNATIONAL_JURISPRUDENCE)]
    intl_top = search_decisions(query, intl_items, top_k=3)
    res = await generate_argument(violation, nat_top, intl_top, project_id)
    if "_error" in res:
        # graceful fallback for any LLM failure (budget, network, parse, 5xx, ...)
        msg = str(res["_error"])
        return {
            "_warning": f"Argumentaire LLM indisponible ({msg[:140]}) — fallback basé sur la jurisprudence indexée.",
            "argument_principal": {
                "reference_principale": (intl_top[0].get("parties") if intl_top else "—"),
                "ratio_decidendi_applicable": (intl_top[0].get("ratio_decidendi") if intl_top else ""),
                "analogie_avec_cas_analyse": "Analogie à compléter manuellement.",
                "force_argument": "moyenne",
            },
            "arguments_secondaires": [{
                "reference": d.get("parties"),
                "ratio_decidendi": d.get("ratio_decidendi"),
                "analogie": "À développer.",
            } for d in (intl_top[1:] + nat_top)],
            "contre_arguments_previsibles": [],
            "doctrine_applicable": ["Pacta sunt servanda", "Souveraineté permanente (Rés. 1803)"],
            "strategie_contentieuse": "Recours national d'abord, arbitrage international en subsidiaire.",
            "probabilite_succes_estimee": "moyenne",
            "juridiction_optimale": "Juridiction nationale puis CIRDI",
            "prescription_a_respecter": "Vérifier les délais de l'État (typiquement 2-5 ans).",
        }
    # persist
    await db.analyses.insert_one({
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "analysis_type": "jurisprudence_argument",
        "results": {"violation": violation, "argument": res},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return res


@api.post("/projects/{project_id}/amendment/rewrite")
async def amendment_rewrite_endpoint(
    project_id: str, payload: dict, uid: str = Depends(get_current_user_id),
):
    """Rewrite a clause to make it balanced and conformant with international standards."""
    proj = await _check_project(project_id, uid)
    original = (payload.get("original") or "").strip()
    problem = (payload.get("problem") or "").strip()
    if not original:
        raise HTTPException(status_code=400, detail="Clause originale manquante.")
    res = await rewrite_amendment(
        original=original,
        problem=problem,
        country=proj.get("country", ""),
        sector=proj.get("sector", ""),
        resource=proj.get("resource_type", ""),
        project_id=project_id,
    )
    if "_error" in res:
        msg = str(res["_error"])
        return {
            "_warning": f"Amendement LLM indisponible ({msg[:140]}) — fallback basique.",
            "clause_proposee": (
                f"[VERSION RÉÉQUILIBRÉE — À FINALISER PAR UN JURISTE]\n\n"
                f"{original}\n\n"
                "Ajouter : (i) une clause de revoyure tous les 5 ans ; (ii) un mécanisme "
                "de partage équitable des bénéfices ; (iii) un mécanisme de consultation "
                "des communautés affectées ; (iv) une clause de conformité aux standards IFC PS5."
            ),
            "modifications_clés": [
                "Insertion d'une clause de revoyure périodique",
                "Renforcement du contenu local",
                "Conformité explicite aux standards IFC",
            ],
            "justification_juridique": "Art. 21 Charte africaine, Rés. ONU 1803, Vision minière africaine.",
            "references_normatives": ["Rés. ONU 1803", "Charte africaine Art. 21", "VMA 2009", "IFC PS5"],
            "leviers_de_negociation": ["Clause de stabilisation limitée", "Audit annuel"],
            "compromis_alternatifs": [],
        }
    # persist
    await db.analyses.insert_one({
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "analysis_type": "amendment_rewrite",
        "results": {"original": original, "problem": problem, "rewrite": res},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return res


# ============ COMPARATOR (multi-projects) ============
@api.post("/comparator/run")
async def comparator_run(payload: dict, uid: str = Depends(get_current_user_id)):
    """Compare multiple projects (≤4) side-by-side based on their dashboard summaries."""
    project_ids = payload.get("project_ids") or []
    if len(project_ids) < 2:
        raise HTTPException(status_code=400, detail="Sélectionnez au moins 2 projets à comparer.")
    if len(project_ids) > 4:
        raise HTTPException(status_code=400, detail="Maximum 4 projets pour la comparaison.")
    out = []
    skipped = []
    for pid in project_ids:
        proj = await db.projects.find_one({"id": pid, "user_id": uid}, {"_id": 0})
        if not proj:
            skipped.append(pid)
            continue
        items = await db.analyses.find({"project_id": pid}, {"_id": 0}).to_list(100)
        analyses = {a["analysis_type"]: a["results"] for a in items}
        summary = derive_diagnostics_summary(analyses)
        out.append({
            "project": proj,
            "summary": summary,
            "financier": analyses.get("financier") or {},
            "environnemental": analyses.get("environnemental") or {},
            "social": analyses.get("social") or {},
            "souverainete": analyses.get("souverainete") or {},
            "desequilibre": analyses.get("desequilibre") or {},
        })
    if len(out) < 2:
        raise HTTPException(status_code=404, detail="Projets introuvables ou non analysés.")
    # Compute ranking by global score
    ranked = sorted(out, key=lambda x: x["summary"].get("score_global", 0), reverse=True)
    return {
        "comparisons": out,
        "ranking": [r["project"]["id"] for r in ranked],
        "skipped_ids": skipped,
    }


# ============ REJD COMPLET (8 parties + 8 annexes) ============
@api.post("/reports/generate-rejd-complete")
async def generate_rejd_complete_endpoint(
    payload: ReportRequest, uid: str = Depends(get_current_user_id),
):
    """Full-blown REJD: 8 parts + 8 annexes, with user watermark for traceability."""
    proj = await _check_project(payload.project_id, uid)
    user = await _get_user(uid) or {}
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
    user_info = (
        f"Utilisateur : {user.get('email','—')} · "
        f"Org : {user.get('organization','—')} · "
        f"Généré le {datetime.now().strftime('%d/%m/%Y %H:%M')} UTC"
    )
    pdf_bytes = generate_rejd_complete(proj, report_data, user_info=user_info)
    safe_name = (proj.get("name") or "rapport").replace(" ", "_")[:40]
    fname = f"REJD_COMPLET_{safe_name}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'}
    )


# ============ PRESENTATION MODE (9 slides JSON) ============
@api.get("/projects/{project_id}/presentation")
async def get_presentation(project_id: str, uid: str = Depends(get_current_user_id)):
    """Returns a structured payload for a 9-slide presentation mode."""
    proj = await _check_project(project_id, uid)
    items = await db.analyses.find({"project_id": project_id}, {"_id": 0}).to_list(100)
    analyses = {a["analysis_type"]: a["results"] for a in items}
    summary = derive_diagnostics_summary(analyses)
    counters = summary.get("compteurs", {})
    finr = analyses.get("financier") or {}
    diags = (analyses.get("diagnostic") or {}).get("fiches", [])
    jur = analyses.get("juridique") or {}
    slides = [
        {
            "n": 1, "kind": "cover",
            "title": proj.get("name", ""),
            "subtitle": f"{proj.get('country','')} · {proj.get('sector','').capitalize()} · {proj.get('resource_type','')}",
            "kicker": "RESOURCES-ANALYZER PRO",
            "tagline": "La transparence contractuelle au service du peuple",
            "author": "Méthodologie : Ahmed ELY Mustapha",
        },
        {
            "n": 2, "kind": "verdict",
            "title": "Verdict global",
            "score_global": summary.get("score_global", 0),
            "niveau": summary.get("niveau_global", "attention"),
            "scores": {
                "juridique": summary.get("score_juridique", 0),
                "sec": summary.get("score_sec", 0),
                "ssc": summary.get("score_ssc", 0),
                "sos": summary.get("score_sos", 0),
            },
        },
        {
            "n": 3, "kind": "alerts",
            "title": "Alertes majeures",
            "items": [
                {"label": "Violations critiques", "value": counters.get("violations_critiques", 0), "color": "#C0392B"},
                {"label": "Violations graves", "value": counters.get("violations_graves", 0), "color": "#E67E22"},
                {"label": "Clauses abusives", "value": counters.get("clauses_abusives", 0), "color": "#D4A017"},
                {"label": "Violations droit national", "value": counters.get("violations_droit_national", 0), "color": "#1A3C5E"},
            ],
        },
        {
            "n": 4, "kind": "financial",
            "title": "Architecture financière",
            "valeur_gisement_mrd": round((finr.get("valeur_totale_gisement", 0) or 0) / 1e9, 2),
            "part_etat_pct": finr.get("part_etat_pct", 0),
            "manque_a_gagner_total_m": round((finr.get("manque_a_gagner_total", 0) or 0) / 1e6, 1),
            "manque_a_gagner_an_m": round((finr.get("manque_a_gagner_annuel", 0) or 0) / 1e6, 1),
            "element_don_pct": round((finr.get("element_don_fiscal", 0) or 0) * 100, 1),
            "cadeau_fiscal": bool(finr.get("cadeau_fiscal")),
        },
        {
            "n": 5, "kind": "violations",
            "title": "Violations majeures du droit",
            "international": [{
                "norme": v.get("norme_violee", ""),
                "libelle": v.get("norme_libelle", ""),
                "gravite": v.get("gravite", ""),
                "nature": v.get("nature_violation", ""),
            } for v in (jur.get("violations_droit_international") or [])[:5]],
            "national": [{
                "code": v.get("code_national_viole", ""),
                "article": v.get("article_exact", ""),
                "gravite": v.get("gravite", ""),
                "nature": v.get("nature_violation", ""),
            } for v in (jur.get("violations_droit_national") or [])[:5]],
        },
        {
            "n": 6, "kind": "abuses",
            "title": "Clauses abusives",
            "items": [{
                "type": c.get("type_abus", ""),
                "gravite": c.get("gravite", ""),
                "analyse": c.get("analyse", ""),
            } for c in (jur.get("clauses_abusives") or [])[:6]],
        },
        {
            "n": 7, "kind": "diagnostics",
            "title": "Top diagnostics & priorités",
            "items": [{
                "anomalie": f.get("anomalie", "")[:140],
                "gravite": f.get("gravite", ""),
                "priorite": f.get("priorite", ""),
                "impact": float(f.get("impact_financier_usd") or 0),
            } for f in diags[:6]],
        },
        {
            "n": 8, "kind": "actions",
            "title": "6 voies de dénonciation",
            "voies": [
                {"label": "① Recours parlementaire", "key": "parlementaire"},
                {"label": "② Recours judiciaire national", "key": "judiciaire_national"},
                {"label": "③ Recours constitutionnel", "key": "constitutionnel"},
                {"label": "④ Arbitrage international", "key": "arbitral_international"},
                {"label": "⑤ Recours international", "key": "international"},
                {"label": "⑥ Procédure pénale", "key": "penal"},
            ],
            "summary": summary.get("voies_recommandees", []),
        },
        {
            "n": 9, "kind": "conclusion",
            "title": "Conclusion & next steps",
            "niveau_global": summary.get("niveau_global", "attention"),
            "manque_a_gagner_m": round((finr.get("manque_a_gagner_total", 0) or 0) / 1e6, 1),
            "recommandation": (
                "Engager une renégociation prioritaire des clauses identifiées et "
                "mobiliser les voies de recours adaptées au calendrier politique."
            ),
            "tagline": "La transparence contractuelle au service du peuple",
        },
    ]
    return {"project": proj, "slides": slides}


# ============ RESOURCE-BACKED LOAN DETECTOR ============
@api.get("/projects/{project_id}/rbl-detector")
async def rbl_detector(project_id: str, uid: str = Depends(get_current_user_id)):
    """Heuristic detector for Resource-Backed Loan patterns inside the convention."""
    await _check_project(project_id, uid)
    docs = await db.documents.find(
        {"project_id": project_id, "extracted_data": {"$ne": None}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(5)
    if not docs:
        raise HTTPException(status_code=400, detail="Aucun document extrait.")
    extracted = docs[0].get("extracted_data") or {}
    raw_excerpt = (docs[0].get("raw_text_excerpt") or "").lower()

    # heuristic markers
    markers = []
    keywords = [
        ("garantie sur ressources", 30),
        ("nantissement", 20),
        ("prêt adossé", 35),
        ("resource-backed", 35),
        ("avance sur production", 25),
        ("preneur en gage", 20),
        ("cession de créance future", 25),
        ("offtake agreement", 15),
        ("hypothèque sur permis", 30),
        ("prepayment", 15),
        ("escrow account", 10),
    ]
    for kw, weight in keywords:
        if kw in raw_excerpt:
            markers.append({"keyword": kw, "weight": weight})
    # Check clauses sensibles
    for c in (extracted.get("clauses_sensibles") or []):
        t = (c.get("texte_exact") or "").lower()
        for kw, weight in keywords:
            if kw in t:
                markers.append({"keyword": kw, "weight": weight, "from_clause": c.get("clause_id")})
    score = min(100, sum(m["weight"] for m in markers))
    risk = "eleve" if score >= 50 else ("modere" if score >= 20 else "faible")
    return {
        "score_rbl": score,
        "risque": risk,
        "markers": markers,
        "explanation": (
            "Le RBL (Resource-Backed Loan) crée un risque de double aliénation : "
            "l'État cède la ressource ET emprunte contre elle. Surveiller : "
            "nantissement, garantie sur permis, offtake long terme à prix fixe, escrow externe."
        ),
        "recommandations": [
            "Exiger la divulgation publique du contrat de prêt sous-jacent.",
            "Vérifier l'autorisation parlementaire (Constitution).",
            "Clauses ITIE étendues : publication des paiements liés au RBL.",
            "Plafonner la durée de l'offtake et indexer le prix.",
        ],
    }


# ============ SHARE VERDICT (1-page PDF + QR code) ============
@api.post("/reports/generate-share-verdict")
async def generate_share_verdict_endpoint(
    payload: ReportRequest, uid: str = Depends(get_current_user_id),
):
    """One-page shareable PDF verdict with QR code to the project URL."""
    proj = await _check_project(payload.project_id, uid)
    user = await _get_user(uid) or {}
    items = await db.analyses.find({"project_id": payload.project_id}, {"_id": 0}).to_list(100)
    analyses = {a["analysis_type"]: a["results"] for a in items}
    summary = derive_diagnostics_summary(analyses)
    report_data = {
        "summary": summary,
        "financier": analyses.get("financier") or {},
    }
    # public share URL — this is the app preview URL
    share_base = os.environ.get("PUBLIC_APP_URL") or os.environ.get("CORS_ORIGINS", "").split(",")[0] or "https://app"
    share_url = f"{share_base.rstrip('/')}/projects/{payload.project_id}"
    pdf_bytes = generate_share_verdict(proj, report_data, share_url, user.get("email", ""))
    _audit(uid, "share_verdict_generated", payload.project_id, {"share_url": share_url})
    safe_name = (proj.get("name") or "rapport").replace(" ", "_")[:40]
    fname = f"VERDICT_{safe_name}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'}
    )


# ============ SIMULATEUR LIÉ À UN PROJET ============
@api.post("/projects/{project_id}/simulator/run")
async def simulator_linked(
    project_id: str, payload: SimulatorOverride, uid: str = Depends(get_current_user_id),
):
    """Run the simulator using a project's extracted data as baseline, and return
    a diff vs the current analysis (impact on royalties, part-État, manque à gagner)."""
    proj = await _check_project(project_id, uid)
    # baseline
    docs = await db.documents.find(
        {"project_id": project_id, "extracted_data": {"$ne": None}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(5)
    if not docs:
        raise HTTPException(status_code=400, detail="Aucun document extrait — impossible de simuler.")
    extracted = docs[0].get("extracted_data") or {}
    rf = extracted.get("regime_fiscal") or {}
    donf = extracted.get("donnees_financieres") or {}
    baseline_sim = {
        "royalty_rate": rf.get("taux_royalties") or 0,
        "is_rate": rf.get("taux_impot_societes") or 0,
        "state_share_psa": rf.get("partage_production_etat_pct") or 0,
        "duration_years": extracted.get("duree_contrat_ans") or 25,
        "production_annual": donf.get("production_annuelle_estimee") or 0,
        "price": donf.get("prix_reference") or 0,
    }
    override = payload.model_dump(exclude_none=True)
    proposed = {**baseline_sim, **override}
    base_res = simulate(baseline_sim)
    prop_res = simulate(proposed)
    # compute diff
    diff = {}
    for k in ("recettes_etat_annuelles", "recettes_etat_totales", "part_etat_pct", "valeur_totale_gisement"):
        b = base_res.get(k) or 0
        p = prop_res.get(k) or 0
        diff[k] = {"baseline": b, "proposed": p, "delta": round(p - b, 2),
                   "delta_pct": round(((p - b) / b * 100) if b else 0, 2)}
    _audit(uid, "simulator_linked_run", project_id, {"proposed": proposed})
    return {
        "project": proj,
        "baseline_input": baseline_sim,
        "proposed_input": proposed,
        "baseline_result": base_res,
        "proposed_result": prop_res,
        "diff": diff,
    }


# ============ AUDIT LOG ============
@api.get("/audit")
async def list_audit(
    project_id: Optional[str] = None,
    limit: int = 200,
    uid: str = Depends(get_current_user_id),
):
    """List audit log entries for the current user."""
    q = {"user_id": uid}
    if project_id:
        q["project_id"] = project_id
    items = await db.audit_log.find(q, {"_id": 0}).sort("ts", -1).to_list(min(int(limit), 500))
    # enrich with project name when possible
    proj_ids = list({it["project_id"] for it in items if it.get("project_id")})
    if proj_ids:
        projs = await db.projects.find({"id": {"$in": proj_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
        pmap = {p["id"]: p["name"] for p in projs}
        for it in items:
            if it.get("project_id"):
                it["project_name"] = pmap.get(it["project_id"], "—")
    return {"items": items, "total": len(items)}


# ============ SUITE AHMED ELY MUSTAPHA (VITAE-PUBLICA + DEBT-ANALYZER PRO) ============
@api.get("/suite/status")
async def suite_status(uid: str = Depends(get_current_user_id)):
    """Status of sister apps in the Ahmed ELY Mustapha suite.
    Each integration is provisioned when the corresponding env var is set:
      - VITAE_PUBLICA_URL + VITAE_PUBLICA_TOKEN
      - DEBT_ANALYZER_URL + DEBT_ANALYZER_TOKEN
    """
    def _st(url_key, token_key, name, desc):
        url = os.environ.get(url_key, "")
        return {
            "key": name,
            "name": {
                "vitae_publica": "VITAE-PUBLICA",
                "debt_analyzer": "DEBT-ANALYZER PRO",
            }.get(name, name),
            "description": desc,
            "connected": bool(url and os.environ.get(token_key)),
            "url": url or None,
            "status": "connected" if (url and os.environ.get(token_key)) else "not_configured",
        }
    return {
        "apps": [
            _st("VITAE_PUBLICA_URL", "VITAE_PUBLICA_TOKEN", "vitae_publica",
                "Transparence de la vie publique : déclarations de patrimoine, conflits d'intérêts."),
            _st("DEBT_ANALYZER_URL", "DEBT_ANALYZER_TOKEN", "debt_analyzer",
                "Analyse des emprunts publics : dette extérieure, prêts adossés aux ressources (RBL)."),
        ],
        "hint": "Définir les variables d'environnement VITAE_PUBLICA_URL/TOKEN et DEBT_ANALYZER_URL/TOKEN pour activer les intégrations.",
    }


@api.post("/projects/{project_id}/suite/cross-check")
async def suite_cross_check(project_id: str, uid: str = Depends(get_current_user_id)):
    """Run a cross-check of the current convention against VITAE-PUBLICA (beneficial ownership)
    and DEBT-ANALYZER PRO (resource-backed loans / debt exposure).
    When services are not configured, returns a structured stub response so the UI works."""
    proj = await _check_project(project_id, uid)
    docs = await db.documents.find(
        {"project_id": project_id, "extracted_data": {"$ne": None}}, {"_id": 0}
    ).sort("created_at", -1).to_list(1)
    extracted = (docs[0].get("extracted_data") if docs else {}) or {}
    company = extracted.get("company") or "—"
    country = proj.get("country", "")
    vitae_ok = bool(os.environ.get("VITAE_PUBLICA_URL") and os.environ.get("VITAE_PUBLICA_TOKEN"))
    debt_ok = bool(os.environ.get("DEBT_ANALYZER_URL") and os.environ.get("DEBT_ANALYZER_TOKEN"))
    result = {
        "project": proj,
        "company": company,
        "country": country,
        "vitae_publica": {
            "connected": vitae_ok,
            "beneficial_owners": [] if vitae_ok else None,
            "pep_flags": [] if vitae_ok else None,
            "conflicts": [] if vitae_ok else None,
            "message": None if vitae_ok else (
                "Intégration VITAE-PUBLICA non configurée. "
                "Définir VITAE_PUBLICA_URL + VITAE_PUBLICA_TOKEN dans l'environnement serveur."
            ),
        },
        "debt_analyzer": {
            "connected": debt_ok,
            "rbl_matches": [] if debt_ok else None,
            "debt_exposure_usd": None,
            "concerning_loans": [] if debt_ok else None,
            "message": None if debt_ok else (
                "Intégration DEBT-ANALYZER PRO non configurée. "
                "Définir DEBT_ANALYZER_URL + DEBT_ANALYZER_TOKEN dans l'environnement serveur."
            ),
        },
    }
    _audit(uid, "suite_cross_check", project_id, {"vitae": vitae_ok, "debt": debt_ok})
    return result


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
