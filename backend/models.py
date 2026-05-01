"""Pydantic models for RESOURCES-ANALYZER PRO."""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timezone
import uuid


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------- AUTH / USERS ----------------
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    organization: Optional[str] = ""
    country: Optional[str] = ""
    role: Literal["juriste", "parlementaire", "gouvernement", "citoyen", "chercheur", "ong"] = "juriste"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    organization: str = ""
    country: str = ""
    role: str
    created_at: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


# ---------------- PROJECTS ----------------
class ProjectCreate(BaseModel):
    name: str
    country: str
    sector: Literal["mines", "petrole", "gaz", "maritime", "foret", "mixte"]
    resource_type: str = ""
    description: Optional[str] = ""


class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    user_id: str
    name: str
    country: str
    sector: str
    resource_type: str = ""
    description: str = ""
    status: str = "active"
    created_at: str = Field(default_factory=_now)


# ---------------- DOCUMENTS ----------------
class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    project_id: str
    user_id: str
    filename: str
    doc_type: str = "A1"  # A1-E6
    file_size: int = 0
    raw_text_excerpt: str = ""  # first 2000 chars
    extracted_data: Optional[Dict[str, Any]] = None
    quality_score: int = 0  # 0-100
    validated: bool = False
    created_at: str = Field(default_factory=_now)


# ---------------- ANALYSES ----------------
class Analysis(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    project_id: str
    document_id: Optional[str] = None
    analysis_type: Literal[
        "juridique", "financier", "environnemental", "social",
        "desequilibre", "souverainete", "requete"
    ]
    results: Dict[str, Any] = {}
    created_at: str = Field(default_factory=_now)


class FreeQueryRequest(BaseModel):
    project_id: str
    question: str


# ---------------- DIAGNOSTICS ----------------
class Diagnostic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    project_id: str
    anomalie: str
    gravite: Literal["mineure", "moderee", "grave", "critique"]
    qualification: str
    impact_financier: float = 0
    impact_social: str = ""
    solutions: List[Dict[str, Any]] = []
    moyens_denonciation: List[Dict[str, Any]] = []
    priorite: Literal["urgent", "court_terme", "moyen_terme", "long_terme"] = "court_terme"
    created_at: str = Field(default_factory=_now)


# ---------------- REPORTS ----------------
class ReportRequest(BaseModel):
    project_id: str
    preset: Literal[
        "parlementaire", "juridique", "citoyen", "environnemental",
        "renegociation", "comparatif", "rejd"
    ]


class Report(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    project_id: str
    preset: str
    filename: str
    created_at: str = Field(default_factory=_now)


# ---------------- SIMULATOR ----------------
class SimulatorRequest(BaseModel):
    project_id: str
    royalty_rate: float = 5.0
    is_rate: float = 25.0
    local_content: float = 30.0
    duration_years: int = 25
    state_share_psa: float = 60.0
    production_annual: float = 1000000  # tons or barrels/year
    price: float = 100  # USD/unit
