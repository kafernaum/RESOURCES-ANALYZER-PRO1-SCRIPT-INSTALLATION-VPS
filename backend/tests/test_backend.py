"""End-to-end tests for RESOURCES-ANALYZER PRO backend.
Covers: auth, projects, documents+extraction (LLM), pure analyses, juridical (LLM),
diagnostics (LLM), dashboard, freequery (LLM), simulator, normative, reports (PDF).
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


# ---------- ROOT ----------
def test_root(api_client):
    r = api_client.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    data = r.json()
    assert data["app"] == "RESOURCES-ANALYZER PRO"
    assert "Ahmed ELY Mustapha" in data["author"]


# ---------- AUTH ----------
class TestAuth:
    def test_register_rejects_invalid_role(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"TEST_badrole_{uuid.uuid4().hex[:6]}@example.com",
                "password": "pass1234",
                "name": "X",
                "role": "admin",  # not allowed
            },
        )
        assert r.status_code == 422

    def test_register_rejects_short_password(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"TEST_short_{uuid.uuid4().hex[:6]}@example.com",
                "password": "12",
                "name": "X",
                "role": "juriste",
            },
        )
        assert r.status_code == 422

    def test_register_rejects_local_tld(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": "noway@host.local",
                "password": "pass1234",
                "name": "X",
                "role": "juriste",
            },
        )
        # email_validator should reject .local TLDs
        assert r.status_code == 422

    def test_register_and_login_and_me(self, api_client):
        email = f"TEST_user_{uuid.uuid4().hex[:8]}@example.com"
        r = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": "pass1234",
                "name": "Test User",
                "role": "parlementaire",
                "country": "Mauritanie",
            },
        )
        assert r.status_code == 200
        body = r.json()
        assert body["token_type"] == "bearer"
        assert body["user"]["email"] == email
        assert body["user"]["role"] == "parlementaire"
        assert "id" in body["user"]
        token = body["access_token"]

        # Login again
        r2 = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": "pass1234"},
        )
        assert r2.status_code == 200
        assert r2.json()["user"]["email"] == email

        # Bad password
        r3 = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": "wrong"},
        )
        assert r3.status_code == 401

        # /me with token
        r4 = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r4.status_code == 200
        assert r4.json()["email"] == email

        # /me without token
        r5 = requests.get(f"{BASE_URL}/api/auth/me")
        assert r5.status_code in (401, 403)


# ---------- PROJECTS ----------
class TestProjects:
    def test_create_list_get_delete(self, authed):
        payload = {
            "name": f"TEST_Project_{uuid.uuid4().hex[:6]}",
            "country": "Mauritanie",
            "sector": "mines",
            "resource_type": "or",
            "description": "Test convention",
        }
        r = authed.post(f"{BASE_URL}/api/projects", json=payload)
        assert r.status_code == 200
        proj = r.json()
        assert proj["name"] == payload["name"]
        assert proj["sector"] == "mines"
        assert "id" in proj
        pid = proj["id"]

        # list
        r2 = authed.get(f"{BASE_URL}/api/projects")
        assert r2.status_code == 200
        ids = [p["id"] for p in r2.json()]
        assert pid in ids

        # get one
        r3 = authed.get(f"{BASE_URL}/api/projects/{pid}")
        assert r3.status_code == 200
        assert r3.json()["id"] == pid

        # delete
        r4 = authed.delete(f"{BASE_URL}/api/projects/{pid}")
        assert r4.status_code == 200
        assert r4.json().get("deleted") is True

        # ensure gone
        r5 = authed.get(f"{BASE_URL}/api/projects/{pid}")
        assert r5.status_code == 404

    def test_invalid_sector_rejected(self, authed):
        r = authed.post(
            f"{BASE_URL}/api/projects",
            json={"name": "X", "country": "Y", "sector": "invalid"},
        )
        assert r.status_code == 422


# ---------- SIMULATOR ----------
class TestSimulator:
    def test_simulator_run(self, authed):
        r = authed.post(
            f"{BASE_URL}/api/simulator/run",
            json={
                "project_id": "any",
                "royalty_rate": 5.0,
                "is_rate": 25.0,
                "local_content": 30.0,
                "duration_years": 25,
                "state_share_psa": 60.0,
                "production_annual": 1_000_000,
                "price": 100,
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        assert len(data) > 0


# ---------- NORMATIVE ----------
class TestNormative:
    def test_references_40_items_6_families(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/normative/references")
        assert r.status_code == 200
        data = r.json()
        assert len(data["families"]) == 6
        assert len(data["items"]) >= 40, f"Expected >=40 normative items, got {len(data['items'])}"

    def test_jurisprudence_16(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/normative/jurisprudence")
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 16

    def test_glossary_50_plus(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/normative/glossary")
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 50


# ---------- DOCUMENTS + EXTRACTION + ANALYSES + DIAGNOSTICS + REPORTS ----------
class TestFullPipeline:
    """Full pipeline against the seed smoke project (has data already)
    plus an upload flow on a fresh project."""

    def test_smoke_dashboard_and_pdf(self, smoke_session):
        # List smoke user's projects
        r = smoke_session.get(f"{BASE_URL}/api/projects")
        assert r.status_code == 200
        projects = r.json()
        if not projects:
            pytest.skip("Smoke user has no projects")
        pid = projects[0]["id"]

        # Dashboard
        rd = smoke_session.get(f"{BASE_URL}/api/projects/{pid}/dashboard")
        assert rd.status_code == 200
        dash = rd.json()
        assert "summary" in dash
        assert "analyses" in dash
        assert dash["documents_count"] >= 0

        # PDF rejd preset
        rp = smoke_session.post(
            f"{BASE_URL}/api/reports/generate",
            json={"project_id": pid, "preset": "rejd"},
        )
        assert rp.status_code == 200
        assert rp.headers["content-type"].startswith("application/pdf")
        body = rp.content
        assert body[:5] == b"%PDF-", "Response is not a valid PDF"
        assert len(body) > 1000

        # Parlementaire preset
        rp2 = smoke_session.post(
            f"{BASE_URL}/api/reports/generate",
            json={"project_id": pid, "preset": "parlementaire"},
        )
        assert rp2.status_code == 200
        assert rp2.content[:5] == b"%PDF-"

        # Juridique preset
        rp3 = smoke_session.post(
            f"{BASE_URL}/api/reports/generate",
            json={"project_id": pid, "preset": "juridique"},
        )
        assert rp3.status_code == 200
        assert rp3.content[:5] == b"%PDF-"

    def test_freequery_on_smoke(self, smoke_session):
        r = smoke_session.get(f"{BASE_URL}/api/projects")
        if r.status_code != 200 or not r.json():
            pytest.skip("smoke project missing")
        pid = r.json()[0]["id"]
        rq = smoke_session.post(
            f"{BASE_URL}/api/projects/{pid}/freequery",
            json={"project_id": pid, "question": "Quelle est la durée de stabilisation fiscale prévue?"},
            timeout=120,
        )
        assert rq.status_code == 200, rq.text
        body = rq.json()
        assert "answer" in body
        assert isinstance(body["answer"], str)
        assert len(body["answer"]) > 5

    def test_full_upload_extract_analyses_diagnostics(self, authed, sample_text):
        # Create fresh project
        r = authed.post(
            f"{BASE_URL}/api/projects",
            json={
                "name": f"TEST_Conv_{uuid.uuid4().hex[:6]}",
                "country": "Mauritanie",
                "sector": "mines",
                "resource_type": "or",
                "description": "Pipeline test",
            },
        )
        assert r.status_code == 200
        pid = r.json()["id"]

        # Upload
        files = {"file": ("convention.txt", sample_text, "text/plain")}
        # Multipart -> remove content-type from session header
        headers = {k: v for k, v in authed.headers.items() if k.lower() != "content-type"}
        ru = requests.post(
            f"{BASE_URL}/api/projects/{pid}/documents",
            files=files,
            data={"doc_type": "A1"},
            headers=headers,
            timeout=60,
        )
        assert ru.status_code == 200, ru.text
        doc = ru.json()
        assert doc["filename"] == "convention.txt"
        doc_id = doc["id"]

        # List documents
        rl = authed.get(f"{BASE_URL}/api/projects/{pid}/documents")
        assert rl.status_code == 200
        assert any(d["id"] == doc_id for d in rl.json())

        # Extract via GPT-4o (real LLM call)
        re = requests.post(
            f"{BASE_URL}/api/documents/{doc_id}/extract",
            headers=headers,
            timeout=180,
        )
        assert re.status_code == 200, f"extract failed: {re.status_code} {re.text}"
        ext = re.json()["extracted_data"]
        assert isinstance(ext, dict)
        # Required fields per spec
        for key in ["document_type", "country", "company", "sector",
                    "regime_fiscal", "parametres_environnementaux", "parametres_sociaux"]:
            assert key in ext, f"Missing extracted key: {key}. Got: {list(ext.keys())}"

        # Caching: second call must be cached
        re2 = requests.post(
            f"{BASE_URL}/api/documents/{doc_id}/extract",
            headers=headers,
            timeout=60,
        )
        assert re2.status_code == 200
        assert re2.json().get("cached") is True

        # Pure analyses
        ra = authed.post(f"{BASE_URL}/api/projects/{pid}/analyses/run")
        assert ra.status_code == 200
        analyses = ra.json()
        for k in ["financier", "environnemental", "social", "desequilibre", "souverainete"]:
            assert k in analyses, f"Missing pure analysis: {k}"

        # Juridical (LLM)
        rj = authed.post(f"{BASE_URL}/api/projects/{pid}/analyses/juridique", timeout=240)
        assert rj.status_code == 200, rj.text
        jres = rj.json()["results"]
        assert "score_conformite_global" in jres or "niveau_alerte" in jres or len(jres) > 0

        # Diagnostics (LLM)
        rdi = authed.post(f"{BASE_URL}/api/projects/{pid}/diagnostics/generate", timeout=240)
        assert rdi.status_code == 200, rdi.text

        # Dashboard
        rd = authed.get(f"{BASE_URL}/api/projects/{pid}/dashboard")
        assert rd.status_code == 200
        dash = rd.json()
        assert dash["documents_count"] >= 1
        assert dash["extracted_count"] >= 1

        # PDF rejd
        rpdf = authed.post(
            f"{BASE_URL}/api/reports/generate",
            json={"project_id": pid, "preset": "rejd"},
        )
        assert rpdf.status_code == 200
        assert rpdf.content[:5] == b"%PDF-"

        # Cleanup
        authed.delete(f"{BASE_URL}/api/projects/{pid}")
