# RESOURCES-ANALYZER PRO — PRD

## Problem statement (verbatim)

Application web full-stack d'analyse des conventions d'exploitation des ressources naturelles
(Mines, Pétrole, Gaz, Maritime, Forêt) entre États et entreprises privées. Détecte violations
juridiques, déséquilibres contractuels, atteintes à la souveraineté. Auteur méthodologique :
Ahmed ELY Mustapha — Juriste, Expert en Finances Publiques.

Stack imposée par l'utilisateur : React + Tailwind + shadcn/ui + Recharts/Chart.js (frontend),
Node.js Express + Supabase pgvector (backend). **Adaptation Emergent** : FastAPI + MongoDB
(stack native), avec passage en MongoDB Atlas Vector Search ou pgvector au cycle 10.

## Personas cibles

| Persona | Besoin clé |
|---|---|
| Juriste / Avocat | Rapport REJD défendable, citations exactes des clauses, jurisprudence applicable |
| Parlementaire | Synthèse pédagogique, alertes, recours parlementaire |
| Gouvernement (négociateur) | Rapport de renégociation avec formulations alternatives |
| ONG / Société civile | Infographies, chiffres clés, points de communication |
| Citoyen | Vulgarisation, slogan, transparence |
| Chercheur | Données brutes JSON, comparatifs multi-conventions |

## Architecture choisie

- **Frontend** : React 19, Tailwind, shadcn/ui, Recharts, lucide-react.
- **Backend** : FastAPI + motor (MongoDB async).
- **Auth** : JWT (PyJWT) + bcrypt.
- **LLM** : GPT-4o via `emergentintegrations` (Universal Key déjà configurée).
- **Extraction** : pypdf, python-docx, openpyxl.
- **Reports** : reportlab (PDF).

## Implémentation v1 (cycles 1-7 + bonus) — livrée le 2026-02

- Auth JWT (register, login, me) avec 6 rôles.
- Sidebar collapsible, header dark/light toggle, branding RESOURCES-ANALYZER PRO complet.
- Landing brandée (hero, 6 features, CTA, footer).
- CRUD Projets avec secteur (mines/pétrole/gaz/maritime/forêt/mixte).
- Upload multi-fichiers PDF/DOCX/XLSX/CSV/TXT, classification A1-E6.
- Extraction GPT-4o stricte JSON mode (1 appel/document, cache MongoDB).
- 5 analyses déterministes (ZERO LLM) : Financier (juste valeur, manque à gagner, scénarios prix), SEC (8 composantes), SSC (7 composantes), IDC (7 dimensions), SOS (5 composantes).
- Analyse juridique GPT-4o (1 appel groupé, cache) — violations droit international + national + clauses abusives.
- Génération fiches diagnostic GPT-4o (1 appel groupé) avec qualification, jurisprudence, solutions, 6 voies de dénonciation.
- Dashboard avec 12 KPI cards (3 rangées) + 8 visualisations Recharts (Radar 6 axes, Donut, Bar benchmark, Line scénarios, Bar violations, IDC bars, SEC bars, SSC bars).
- Référentiel normatif pré-chargé (37 entrées N1-N6 + D1-D8) + Jurisprudence internationale (16 affaires) + Glossaire 50+ termes — interface de consultation avec recherche.
- Requêtes libres GPT-4o avec historique.
- Simulateur de renégociation temps réel (sliders).
- Rapports PDF (reportlab) : Parlementaire, Juridique, Citoyen, Environnemental, Renégociation, REJD synthétique.
- Avertissement légal non masquable sur toutes les pages juridiques et tous les rapports.

## Backlog priorisé

### P0 (à faire en priorité v2)

- [ ] **Cycle 6 — 6 visualisations restantes** : Treemap clauses (D3), Waterfall flux revenus, Scatter clauses abusives (gravité × impact), Heatmap calendrier obligations, Sankey flux ressources (D3), Map Leaflet zone concession, Spider obligations sociales, Infographie A3 PNG 300 DPI.
- [ ] **Cycle 7 — Exports avancés** : Word docx (`python-docx`), Excel xlsx multi-onglets (openpyxl), ZIP pack REJD complet.
- [ ] **REJD complet** : 8 parties + 8 annexes (vs version synthétique actuelle).

### P1

- [ ] **Cycle 8** : Comparateur multi-conventions, bibliothèque conventions modèles (10 modèles), mode présentation plein écran 9 slides, aide à la rédaction d'amendements.
- [ ] **Cycle 10 — Module 7 BLN** : Indexation articles législatifs nationaux uploadés + embeddings ada-002 + recherche vectorielle + confrontation convention/loi + détection dérogations illégales.
- [ ] **Cycle 11 — Module 8 Jurisprudence** : Upload jurisprudence nationale + recherche sémantique 4 niveaux + génération automatique d'arguments jurisprudentiels par violation.

### P2

- [ ] **Cycle 12 — Module 9 Collecte automatique** : 10 connecteurs (ResourceContracts.org, ITIE, FMI, BM, CIRDI, PWYP, Global Witness, Légifrance, OHADA, OpenAlex) + veille continue + alertes + profils de réputation des sociétés.
- [ ] **Cycle 13 — Suite** : Connexion VITAE-PUBLICA + DEBT-ANALYZER PRO + Resource-Backed Loan Detector.

## Suivi

- 2026-02 : Livraison initiale v1 (Cycles 1-7 + bonus).
