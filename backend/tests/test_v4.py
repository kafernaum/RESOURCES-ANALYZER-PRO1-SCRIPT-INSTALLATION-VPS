"""v4 endpoint tests — simulator linked to project, audit log, share-verdict PDF,
Suite Ahmed ELY Mustapha stubs, and comparator skipped_ids.

Relies on the fixtures in conftest.py (smoke_token, smoke_session, authed, auth_token).
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
SMOKE_PID = "f6df361a-0371-4797-ad46-d05bdfd614be"


# ---------- PROJECT-LINKED SIMULATOR ----------
class TestProjectSimulator:
    def test_simulator_empty_body_baseline_only(self, smoke_session):
        r = smoke_session.post(
            f"{BASE_URL}/api/projects/{SMOKE_PID}/simulator/run",
            json={}, timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("baseline_input", "proposed_input", "baseline_result", "proposed_result", "diff"):
            assert k in body, f"missing key {k}"
        # proposed equals baseline -> deltas == 0
        for metric, v in body["diff"].items():
            assert v["delta"] == 0, f"{metric} delta should be 0 when body empty, got {v}"
            assert v["delta_pct"] == 0, f"{metric} delta_pct should be 0"

    def test_simulator_with_overrides(self, smoke_session):
        r = smoke_session.post(
            f"{BASE_URL}/api/projects/{SMOKE_PID}/simulator/run",
            json={"royalty_rate": 8, "is_rate": 30},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # proposed inputs reflect the overrides
        assert body["proposed_input"]["royalty_rate"] == 8
        assert body["proposed_input"]["is_rate"] == 30
        # baseline comes from the convention extracted data
        assert body["baseline_input"]["royalty_rate"] == 4
        # diff should show positive delta on part_etat_pct
        d = body["diff"]
        assert "part_etat_pct" in d
        assert d["part_etat_pct"]["delta"] > 0, (
            f"Expected positive delta on part_etat_pct with higher royalties, got {d['part_etat_pct']}"
        )
        # baseline and proposed results differ
        assert body["baseline_result"]["part_etat_pct"] != body["proposed_result"]["part_etat_pct"]


# ---------- AUDIT LOG ----------
class TestAuditLog:
    def test_audit_list_default(self, smoke_session):
        r = smoke_session.get(f"{BASE_URL}/api/audit?limit=10")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body and "total" in body
        assert isinstance(body["items"], list)
        assert body["total"] <= 10

    def test_audit_filter_by_project(self, smoke_session):
        # Trigger an auditable action first
        smoke_session.post(
            f"{BASE_URL}/api/projects/{SMOKE_PID}/simulator/run",
            json={"royalty_rate": 5}, timeout=30,
        )
        r = smoke_session.get(f"{BASE_URL}/api/audit?project_id={SMOKE_PID}&limit=50")
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body["items"]) >= 1
        for it in body["items"]:
            assert it["project_id"] == SMOKE_PID
            # enriched with project_name
            assert "project_name" in it

    def test_audit_auto_on_project_create(self, smoke_token):
        """Create a project then verify a 'project_create' (or similar) entry appears."""
        headers = {"Authorization": f"Bearer {smoke_token}", "Content-Type": "application/json"}
        cr = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                "name": f"TEST_audit_{uuid.uuid4().hex[:6]}",
                "country": "Mauritanie", "sector": "mines",
            },
            headers=headers, timeout=30,
        )
        assert cr.status_code == 200, cr.text
        pid = cr.json()["id"]
        try:
            r = requests.get(
                f"{BASE_URL}/api/audit?project_id={pid}&limit=10",
                headers=headers, timeout=30,
            )
            assert r.status_code == 200, r.text
            items = r.json()["items"]
            actions = [it.get("action") for it in items]
            assert any("project" in (a or "").lower() and "creat" in (a or "").lower() for a in actions), (
                f"Expected a project_create audit entry, got actions: {actions}"
            )
        finally:
            requests.delete(f"{BASE_URL}/api/projects/{pid}", headers=headers, timeout=30)


# ---------- SHARE-VERDICT PDF ----------
class TestShareVerdict:
    def test_generate_share_verdict_pdf(self, smoke_session):
        r = smoke_session.post(
            f"{BASE_URL}/api/reports/generate-share-verdict",
            json={"project_id": SMOKE_PID, "preset": "rejd"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        assert r.headers["content-type"].startswith("application/pdf")
        body = r.content
        assert body[:5] == b"%PDF-", "Response is not a valid PDF"
        assert len(body) > 3000, f"PDF suspiciously small: {len(body)} bytes"


# ---------- SUITE STATUS / CROSS-CHECK (stub path) ----------
class TestSuite:
    def test_suite_status_not_configured(self, smoke_session):
        r = smoke_session.get(f"{BASE_URL}/api/suite/status")
        assert r.status_code == 200, r.text
        body = r.json()
        apps = body.get("apps") or []
        assert len(apps) == 2, f"Expected 2 apps, got {len(apps)}"
        keys = {a["key"] for a in apps}
        assert keys == {"vitae_publica", "debt_analyzer"}
        names = {a["name"] for a in apps}
        assert "VITAE-PUBLICA" in names
        assert "DEBT-ANALYZER PRO" in names
        # Without env vars they should be not_configured / connected=false
        for a in apps:
            assert a["connected"] is False
            assert a["status"] == "not_configured"

    def test_suite_cross_check_stub(self, smoke_session):
        r = smoke_session.post(
            f"{BASE_URL}/api/projects/{SMOKE_PID}/suite/cross-check",
            json={}, timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "vitae_publica" in body and "debt_analyzer" in body
        vp = body["vitae_publica"]
        da = body["debt_analyzer"]
        assert vp["connected"] is False
        assert da["connected"] is False
        assert vp.get("message") and "VITAE-PUBLICA" in vp["message"]
        assert da.get("message") and "DEBT-ANALYZER" in da["message"]


# ---------- COMPARATOR skipped_ids ----------
class TestComparatorSkippedIds:
    def test_skipped_ids_present(self, smoke_session, smoke_token):
        """Run a valid 2-project comparator; verify `skipped_ids` key exists (empty)."""
        headers = {"Authorization": f"Bearer {smoke_token}", "Content-Type": "application/json"}
        cr = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                "name": f"TEST_cmp4_{uuid.uuid4().hex[:6]}",
                "country": "Mauritanie", "sector": "mines",
            },
            headers=headers, timeout=30,
        )
        pid2 = cr.json()["id"]
        try:
            # Attempt analyses; it may fail without docs but OK
            requests.post(f"{BASE_URL}/api/projects/{pid2}/analyses/run",
                          headers=headers, timeout=60)
            r = requests.post(
                f"{BASE_URL}/api/comparator/run",
                json={"project_ids": [SMOKE_PID, pid2]},
                headers=headers, timeout=60,
            )
            if r.status_code == 404:
                pytest.skip("Second project lacks analyses — can't complete comparator.")
            assert r.status_code == 200, r.text
            body = r.json()
            assert "skipped_ids" in body, "skipped_ids field should always be present"
            assert isinstance(body["skipped_ids"], list)
        finally:
            requests.delete(f"{BASE_URL}/api/projects/{pid2}", headers=headers, timeout=30)
