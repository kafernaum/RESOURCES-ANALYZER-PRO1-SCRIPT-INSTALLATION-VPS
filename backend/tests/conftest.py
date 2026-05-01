"""Shared fixtures for RAP backend tests."""
import os
import time
import uuid

import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register(session, email, password="testpass123", name="Auto Test", role="juriste"):
    r = session.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": email,
            "password": password,
            "name": name,
            "role": role,
            "country": "Mauritanie",
            "organization": "RAP Test",
        },
        timeout=30,
    )
    return r


@pytest.fixture(scope="session")
def auth_token(api_client):
    """Create a fresh user for the test session and return its bearer token."""
    email = f"TEST_rap_{uuid.uuid4().hex[:8]}@example.com"
    r = _register(api_client, email)
    if r.status_code == 409:
        # Already exists -> login
        r2 = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": "testpass123"},
            timeout=30,
        )
        assert r2.status_code == 200
        token = r2.json()["access_token"]
    else:
        assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
        token = r.json()["access_token"]
    return token


@pytest.fixture(scope="session")
def authed(api_client, auth_token):
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


@pytest.fixture(scope="session")
def smoke_token(api_client):
    """Obtain token for the pre-existing smoke@example.com user (has full project)."""
    r = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "smoke@example.com", "password": "smoke123"},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"smoke user login failed: {r.status_code} {r.text}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def smoke_session(smoke_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {smoke_token}"})
    return s


SAMPLE_CONVENTION = """
CONVENTION DE CONCESSION MINIERE — République Islamique de Mauritanie

Entre l'Etat de Mauritanie (le Concédant) et la société TASIAST GOLD SA (le Concessionnaire),
il est conclu une convention pour l'exploitation de l'or sur le périmètre de Tasiast.

Article 1 — Objet
La présente convention porte sur l'exploitation de gisements aurifères dans la région du Tiris Zemmour.

Article 5 — Régime fiscal
Royalty (redevance minière) : 3% sur le chiffre d'affaires brut.
Impôt sur les sociétés : 25%. Stabilisation fiscale: 25 ans.
Exonération de TVA pendant la phase d'investissement.

Article 7 — Environnement
Etude d'impact environnemental requise. Plan de réhabilitation à charge du Concessionnaire.
Provision de garantie environnementale: 1 USD/tonne traitée.

Article 9 — Social et contenu local
Embauche locale prioritaire. Quota minimum de 60% de personnel mauritanien après 3 ans.
Formation professionnelle obligatoire. Préférence aux fournisseurs locaux à conditions équivalentes.

Article 14 — Règlement des litiges
Tout différend sera soumis à l'arbitrage CIRDI (ICSID) à Washington, droit anglais applicable.
Renonciation par l'Etat à toute immunité de juridiction et d'exécution.

Article 18 — Stabilisation
Les conditions fiscales, douanières et juridiques sont stabilisées pour la durée de la convention (25 ans).
Toute modification législative défavorable au Concessionnaire ouvrira droit à compensation intégrale.
"""


@pytest.fixture(scope="session")
def sample_text() -> bytes:
    return SAMPLE_CONVENTION.encode("utf-8")
