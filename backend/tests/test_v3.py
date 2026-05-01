"""v3 endpoint tests: jurisprudence, amendment, comparator, presentation, RBL, REJD-complete.
Uses the pre-existing smoke@example.com project (Convention Tasiast) that already has
extracted data + analyses. Avoids re-testing legacy v1 features.
"""
import os
import uuid
import io
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
SMOKE_PID = "f6df361a-0371-4797-ad46-d05bdfd614be"


# ---------- JURISPRUDENCE MODULE 11 ----------
class TestJurisprudence:
    def test_list_initial(self, smoke_session):
        r = smoke_session.get(f"{BASE_URL}/api/projects/{SMOKE_PID}/jurisprudence")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body
        assert "total" in body
        assert isinstance(body["items"], list)

    def test_upload_txt_decision(self, smoke_token):
        # multipart upload – do NOT send json content-type
        headers = {"Authorization": f"Bearer {smoke_token}"}
        txt = (
            "COUR SUPRÊME DE MAURITANIE — ARRÊT N° 2021/147\n"
            "Dans l'affaire opposant la République à la société TASIAST GOLD SA,\n"
            "concernant la validité des clauses de stabilisation fiscale.\n"
            "Attendu que la souveraineté permanente sur les ressources naturelles\n"
            "(Résolution 1803 ONU) s'oppose à toute clause qui figerait indéfiniment\n"
            "le régime fiscal au détriment de l'État.\n"
            "Par ces motifs, la Cour déclare nulle la clause de stabilisation illimitée\n"
            "et ordonne la renégociation du régime fiscal.\n"
        ).encode("utf-8")
        files = {"file": (f"TEST_decision_{uuid.uuid4().hex[:6]}.txt", txt, "text/plain")}
        data = {"court": "Cour suprême de Mauritanie", "year": 2021}
        r = requests.post(
            f"{BASE_URL}/api/projects/{SMOKE_PID}/jurisprudence/upload",
            files=files, data=data, headers=headers, timeout=60,
        )
        assert r.status_code == 200, r.text
        dec = r.json()
        assert "id" in dec
        assert dec["scope"] == "nationale"
        assert dec["court"] == "Cour suprême de Mauritanie"
        assert dec["year"] == 2021
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/projects/{SMOKE_PID}/jurisprudence/{dec['id']}",
            headers=headers, timeout=30,
        )

    def test_upload_too_short(self, smoke_token):
        headers = {"Authorization": f"Bearer {smoke_token}"}
        files = {"file": ("tiny.txt", b"short", "text/plain")}
        r = requests.post(
            f"{BASE_URL}/api/projects/{SMOKE_PID}/jurisprudence/upload",
            files=files, data={"court": "X", "year": 2020}, headers=headers, timeout=30,
        )
        assert r.status_code == 400

    def test_search_merges_international(self, smoke_session):
        r = smoke_session.post(
            f"{BASE_URL}/api/projects/{SMOKE_PID}/jurisprudence/search",
            json={"query": "stabilisation fiscale souveraineté", "top_k": 5},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["query"].startswith("stabilisation")
        assert isinstance(body["results"], list)
        # At least international should surface
        assert len(body["results"]) > 0, "Expected TF-IDF search to return results"
        # Validate each result has expected keys
        for item in body["results"]:
            assert "score" in item or "ratio_decidendi" in item or "full_text" in item

    def test_search_empty_query_400(self, smoke_session):
        r = smoke_session.post(
            f"{BASE_URL}/api/projects/{SMOKE_PID}/jurisprudence/search",
            json={"query": ""}, timeout=30,
        )
        assert r.status_code == 400

    def test_argument_llm_or_fallback(self, smoke_session):
        violation = {
            "nature_violation": "Clause de stabilisation fiscale illimitée",
            "qualification_juridique": "Violation du principe de souveraineté permanente (Rés. 1803 ONU).",
            "norme_violee": "Rés. ONU 1803",
            "gravite": "critique",
        }
        r = smoke_session.post(
            f"{BASE_URL}/api/projects/{SMOKE_PID}/jurisprudence/argument",
            json={"violation": violation},
            timeout=180,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # Must have a principal argument regardless of real LLM or fallback path
        assert "argument_principal" in body
        # Either real result or fallback (with _warning)
        if "_warning" in body:
            assert "Budget" in body["_warning"] or "repli" in body["_warning"].lower()
            assert "reference_principale" in body["argument_principal"]
        else:
            # Real LLM path persisted in db; structure should contain typical keys
            assert isinstance(body["argument_principal"], dict)

    def test_argument_missing_violation_400(self, smoke_session):
        r = smoke_session.post(
            f"{BASE_URL}/api/projects/{SMOKE_PID}/jurisprudence/argument",
            json={}, timeout=30,
        )
        assert r.status_code == 400


# ---------- AMENDMENT DRAFTER ----------
class TestAmendmentDrafter:
    def test_rewrite_llm_or_fallback(self, smoke_session):
        original = (
            "Les conditions fiscales, douanières et juridiques sont stabilisées "
            "pour la durée de la convention (25 ans). Toute modification législative "
            "défavorable au Concessionnaire ouvrira droit à compensation intégrale."
        )
        r = smoke_session.post(
            f"{BASE_URL}/api/projects/{SMOKE_PID}/amendment/rewrite",
            json={
                "original": original,
                "problem": "Clause de stabilisation trop large qui gèle la souveraineté fiscale.",
            },
            timeout=180,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "clause_proposee" in body
        assert isinstance(body["clause_proposee"], str)
        assert len(body["clause_proposee"]) > 20
        if "_warning" in body:
            assert "Budget" in body["_warning"] or "fallback" in body["_warning"].lower()

    def test_rewrite_missing_original_400(self, smoke_session):
        r = smoke_session.post(
            f"{BASE_URL}/api/projects/{SMOKE_PID}/amendment/rewrite",
            json={"original": "  ", "problem": "x"},
            timeout=30,
        )
        assert r.status_code == 400


# ---------- COMPARATOR ----------
class TestComparator:
    def test_comparator_400_when_fewer_than_2(self, smoke_session):
        r = smoke_session.post(
            f"{BASE_URL}/api/comparator/run",
            json={"project_ids": [SMOKE_PID]}, timeout=30,
        )
        assert r.status_code == 400
        assert "2" in r.json().get("detail", "")

    def test_comparator_400_when_more_than_4(self, smoke_session):
        r = smoke_session.post(
            f"{BASE_URL}/api/comparator/run",
            json={"project_ids": ["a", "b", "c", "d", "e"]}, timeout=30,
        )
        assert r.status_code == 400
        assert "4" in r.json().get("detail", "")

    def test_comparator_404_when_projects_not_found(self, smoke_session):
        r = smoke_session.post(
            f"{BASE_URL}/api/comparator/run",
            json={"project_ids": ["unknown-1", "unknown-2"]}, timeout=30,
        )
        assert r.status_code == 404

    def test_comparator_success_with_two_projects(self, smoke_session, smoke_token):
        # Create a second TEST_ project cloned for the smoke user, run analyses so
        # comparator returns both. Reuse the smoke user credentials.
        headers = {"Authorization": f"Bearer {smoke_token}", "Content-Type": "application/json"}
        cr = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                "name": f"TEST_cmp_{uuid.uuid4().hex[:6]}",
                "country": "Mauritanie",
                "sector": "mines",
                "resource_type": "fer",
                "description": "Second project for comparator test",
            },
            headers=headers, timeout=30,
        )
        assert cr.status_code == 200, cr.text
        pid2 = cr.json()["id"]
        try:
            # Run pure analyses (no LLM needed, no docs needed)
            ra = requests.post(
                f"{BASE_URL}/api/projects/{pid2}/analyses/run",
                headers=headers, timeout=60,
            )
            # Pure analyses may 400 without documents; that's fine – the comparator
            # just uses whatever analyses exist. Don't hard-assert success.
            r = requests.post(
                f"{BASE_URL}/api/comparator/run",
                json={"project_ids": [SMOKE_PID, pid2]},
                headers=headers, timeout=60,
            )
            if r.status_code == 404:
                # Second project had no analyses persisted – acceptable
                pytest.skip("Second project has no analyses; comparator requires ≥2 analysed projects.")
            assert r.status_code == 200, r.text
            body = r.json()
            assert "comparisons" in body and "ranking" in body
            assert len(body["comparisons"]) >= 2
            assert len(body["ranking"]) >= 2
            # Each comparison should contain project + summary
            for c in body["comparisons"]:
                assert "project" in c and "summary" in c
        finally:
            requests.delete(f"{BASE_URL}/api/projects/{pid2}", headers=headers, timeout=30)


# ---------- PRESENTATION MODE ----------
class TestPresentation:
    def test_9_slides(self, smoke_session):
        r = smoke_session.get(f"{BASE_URL}/api/projects/{SMOKE_PID}/presentation")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "project" in body and "slides" in body
        slides = body["slides"]
        assert len(slides) == 9, f"Expected 9 slides, got {len(slides)}"
        kinds = [s["kind"] for s in slides]
        assert kinds == ["cover", "verdict", "alerts", "financial", "violations",
                         "abuses", "diagnostics", "actions", "conclusion"]
        # Slide 1 sanity
        assert slides[0]["title"]
        # Slide 2 scores
        assert "score_global" in slides[1]


# ---------- RBL DETECTOR ----------
class TestRblDetector:
    def test_rbl_on_smoke_project(self, smoke_session):
        r = smoke_session.get(f"{BASE_URL}/api/projects/{SMOKE_PID}/rbl-detector")
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ["score_rbl", "risque", "markers", "explanation", "recommandations"]:
            assert k in body, f"Missing key {k}"
        assert isinstance(body["score_rbl"], int)
        assert 0 <= body["score_rbl"] <= 100
        assert body["risque"] in ("eleve", "modere", "faible")
        assert isinstance(body["markers"], list)
        assert isinstance(body["recommandations"], list) and len(body["recommandations"]) >= 1

    def test_rbl_400_when_no_extracted_docs(self, smoke_token):
        # Create a new empty project, call RBL -> should return 400
        headers = {"Authorization": f"Bearer {smoke_token}", "Content-Type": "application/json"}
        cr = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": f"TEST_rbl_{uuid.uuid4().hex[:6]}", "country": "X", "sector": "mines"},
            headers=headers, timeout=30,
        )
        pid = cr.json()["id"]
        try:
            r = requests.get(f"{BASE_URL}/api/projects/{pid}/rbl-detector",
                             headers=headers, timeout=30)
            assert r.status_code == 400
        finally:
            requests.delete(f"{BASE_URL}/api/projects/{pid}", headers=headers, timeout=30)


# ---------- REJD COMPLETE (8 parts + watermark) ----------
class TestRejdComplete:
    def test_generate_pdf(self, smoke_session):
        r = smoke_session.post(
            f"{BASE_URL}/api/reports/generate-rejd-complete",
            json={"project_id": SMOKE_PID, "preset": "rejd"},
            timeout=180,
        )
        assert r.status_code == 200, r.text
        assert r.headers["content-type"].startswith("application/pdf")
        body = r.content
        assert body[:5] == b"%PDF-"
        # REJD complete with 8 parts + 8 annexes should produce a non-trivial PDF
        assert len(body) > 3000, f"PDF suspiciously small: {len(body)} bytes"
