# RESOURCES-ANALYZER PRO — MASTERPLAN

**Auteur méthodologique** : Ahmed ELY Mustapha — Juriste, Expert en Finances Publiques, PMP I-PMP IBM Full Stack Developer
**Slogan** : « Chaque ressource naturelle appartient au peuple — chaque convention doit le prouver. »

---

## 1. Architecture technique adoptée

| Couche | Technologie retenue | Justification |
|---|---|---|
| Frontend | React 19 + TailwindCSS 3 + shadcn/ui + Recharts | Native Emergent ; densité visuelle Bloomberg/LexisNexis |
| Backend | FastAPI (Python 3) | Adaptation de la stack initiale Node/Express vers la stack Emergent |
| Base de données | MongoDB (motor async) | Native Emergent ; collections JSONB-like adaptées à l'extraction Pydantic |
| Authentification | JWT (PyJWT) + bcrypt | Auth custom email/password avec rôles juriste/parlementaire/gouvernement/citoyen/chercheur/ong |
| Extraction documents | pypdf, python-docx, openpyxl | Texte structuré PDF/DOCX/XLSX/CSV/TXT |
| LLM | OpenAI GPT-4o via `emergentintegrations` (Universal Key) | 1 appel par document/analyse, mise en cache MongoDB |
| Embeddings (v2) | text-embedding-ada-002 via Universal Key | Cycle 10 — vectorisation articles nationaux |
| Recherche vectorielle (v2) | MongoDB Atlas Vector Search OU passage à pgvector | Cycle 10 |
| Reports | reportlab (PDF) | Génération côté serveur, fonts Helvetica + Courier ; export téléchargeable |
| Visualisations | Recharts (Radar, Donut, Bar, Line, Scatter) | Sankey/Treemap/Map/Heatmap avancés en cycle 6+ |
| Déploiement | Emergent.sh natif | supervisor + hot reload |

> **Note d'adaptation** : Le prompt initial spécifiait Supabase + pgvector + Node Express. La stack Emergent est FastAPI + MongoDB + React. L'adaptation préserve la totalité des règles métier et de la méthodologie.

---

## 2. Schéma de base de données (collections MongoDB)

| Collection | Champs principaux |
|---|---|
| `users` | id, email, password_hash, name, organization, country, role, created_at |
| `projects` | id, user_id, name, country, sector, resource_type, status, created_at |
| `documents` | id, project_id, user_id, filename, doc_type (A1-E6), file_size, raw_text_excerpt, _raw_text_full, extracted_data (JSON), quality_score, validated, created_at |
| `analyses` | id, project_id, analysis_type (juridique\|financier\|environnemental\|social\|desequilibre\|souverainete\|diagnostic\|requete), results (JSON), created_at |

(Cycle 10+ : `national_law_articles`, `national_jurisprudence`, `international_jurisprudence` avec champ `embedding` pour la recherche vectorielle — référentiel pré-chargé en mémoire pour le moment.)

---

## 3. Plan des appels LLM (RÈGLE D'OR : minimisation et cache)

| Action utilisateur | Appel | Modèle | Cache |
|---|---|---|---|
| Extraire les données d'une convention | **1 appel JSON strict** par document | `gpt-4o` | ✅ Stocké dans `documents.extracted_data` ; renvoyé immédiatement si déjà présent |
| Analyses déterministes (financier, SEC, SSC, IDC, SOS) | **0 appel** — calcul pur Python | — | Persisté dans `analyses` |
| Analyse juridique groupée | **1 appel JSON strict** par projet | `gpt-4o` | ✅ Stocké dans `analyses` |
| Génération des fiches diagnostic | **1 appel JSON strict** par projet | `gpt-4o` | ✅ Stocké dans `analyses` |
| Requête libre | 1 appel texte libre | `gpt-4o` | Conservée dans `analyses.results` (historique) |
| Embeddings articles nationaux (Cycle 10) | 1 appel par article (jamais recalculé) | `text-embedding-ada-002` | ✅ Persisté à l'indexation |

---

## 4. Plan des 13 cycles de développement

### ✅ Livrés dans la v1 (ce livrable)

| Cycle | Module | Statut |
|---|---|---|
| **1** | Fondations — Auth JWT, Sidebar collapsible, Landing brandée, schéma BDD MongoDB | ✅ |
| **2** | Upload + extraction PDF/DOCX/XLSX/CSV/TXT, GPT-4o JSON mode strict, validation manuelle | ✅ |
| **3** | Analyse financière & fiscale — juste valeur, manque à gagner, scénarios prix bas/central/haut, élément don fiscal (ZERO LLM) | ✅ |
| **4** | Scoring SEC (8 composantes pondérées) + SSC (7 composantes pondérées) — ZERO LLM | ✅ |
| **5** | Analyse juridique GPT-4o (1 appel groupé) + IDC (7 dimensions) + SOS (5 composantes) + Génération de fiches diagnostic GPT-4o avec moyens de dénonciation | ✅ |
| **6** | Dashboard avec 4 lignes de KPI cards + 8 visualisations Recharts (Radar, Donut, Bar Benchmark, Line scénarios, Bar violations, IDC dimensions, SEC components, SSC components) | ✅ partiel (8 sur 14) |
| **7** | Rapports PDF reportlab — Parlementaire, Juridique, Citoyen, Environnemental, Renégociation, REJD (synthétique) | ✅ |
| **Bonus** | Référentiel normatif pré-chargé (40+ entrées N1-N6 + D1-D8) ; Jurisprudence internationale pré-chargée (16 affaires) ; Glossaire 50+ termes ; Simulateur de renégociation temps réel ; Mode sombre/clair ; Avertissement légal non masquable | ✅ |

### 🔜 À livrer (v2)

| Cycle | Module | Notes |
|---|---|---|
| **6 (suite)** | 6 visualisations restantes : Treemap (D3), Waterfall, Scatter clauses abusives, Heatmap calendrier, Sankey flux ressources, Map Leaflet zone concession, Spider obligations sociales, Infographie A3 300 DPI | Recharts/D3 supplémentaires |
| **7 (suite)** | Word docx éditable, Excel xlsx multi-onglets, ZIP pack complet REJD | docx + openpyxl |
| **8** | Comparateur multi-conventions, Bibliothèque conventions modèles, Mode présentation 9 slides, Rédaction d'amendements assistée | UX comparative |
| **9** | Gestion de projets avancée (duplication, partage, historique avenants) | |
| **10** | **Module 7 — BLN** : Indexation articles législatifs nationaux uploadés + vectorisation + confrontation convention/loi + détection des dérogations illégales | Migration vers MongoDB Atlas Vector Search ou pgvector |
| **11** | **Module 8 — Jurisprudence** : Upload jurisprudence nationale, recherche sémantique 4 niveaux, génération automatique d'arguments jurisprudentiels par violation | |
| **12** | **Module 9 — Collecte automatique** : 10 connecteurs (ResourceContracts, ITIE, FMI, BM, CIRDI, PWYP, Global Witness, Légifrance, OHADA, OpenAlex), veille continue, alertes, profils de réputation des sociétés | |
| **13** | REJD complet (8 parties + 8 annexes), connexion suite VITAE-PUBLICA + DEBT-ANALYZER PRO, Resource-Backed Loan Detector, audit qualité, déploiement production | |

---

## 5. Endpoints API publiés (Cycle 1-7)

```
GET  /api/                                      → root
POST /api/auth/register                         → création compte
POST /api/auth/login                            → token JWT
GET  /api/auth/me                               → user courant
POST /api/projects                              → créer projet
GET  /api/projects                              → lister projets utilisateur
GET  /api/projects/{id}                         → détail
DELETE /api/projects/{id}                       → suppression cascadée
POST /api/projects/{id}/documents               → upload (multipart)
GET  /api/projects/{id}/documents               → lister docs
GET  /api/documents/{id}                        → détail doc
DELETE /api/documents/{id}                      → suppression doc
POST /api/documents/{id}/extract                → 1 appel GPT-4o (cached)
PUT  /api/documents/{id}/extracted              → validation manuelle des données extraites
POST /api/projects/{id}/analyses/run            → analyses pures (financier+env+social+IDC+SOS)
POST /api/projects/{id}/analyses/juridique      → 1 appel GPT-4o (cached)
POST /api/projects/{id}/diagnostics/generate    → 1 appel GPT-4o (cached)
GET  /api/projects/{id}/analyses                → toutes les analyses
GET  /api/projects/{id}/dashboard               → vue d'ensemble + scores agrégés
POST /api/projects/{id}/freequery               → requête libre GPT-4o (texte)
POST /api/simulator/run                         → calcul ZERO LLM
GET  /api/normative/references                  → 40+ normes pré-chargées
GET  /api/normative/jurisprudence               → 16 affaires CIRDI/CIJ/Cour africaine
GET  /api/normative/glossary                    → 50+ termes
POST /api/reports/generate                      → PDF (parlementaire/juridique/citoyen/env/renégociation/REJD)
```

---

## 6. Charte visuelle appliquée

- Palette imposée : `#1B4332` (vert forêt), `#D4A017` (or), `#1A3C5E` (bleu marine), `#C0392B` (alerte), `#E67E22` (avertissement), `#27AE60` (équilibre), `#0D1B12` (fond sombre), `#F5F9F5` (fond clair).
- Typographie : Merriweather (titres / solennité), Inter (UI / corps), JetBrains Mono (chiffres, scores, articles).
- Dark mode + Light mode togglables ; persistance localStorage.
- Sidebar gauche collapsible, icônes Lucide React.
- Bandeau « DOCUMENT PÉDAGOGIQUE » non masquable sur toutes les pages d'analyse juridique et de diagnostic.
- Logo personnalisé : globe + mine + ancre (icônes Lucide superposées sur dégradé vert/bleu).

---

## 7. Mention obligatoire

Sur chaque rapport généré (page de titre + footer) :
> **RESOURCES-ANALYZER PRO** — La transparence contractuelle au service du peuple.
> Méthodologie : Ahmed ELY Mustapha — Juriste, Expert en Finances Publiques, PMP I-PMP IBM Full Stack Developer.
> DOCUMENT PÉDAGOGIQUE — Cette analyse n'a aucune valeur juridictionnelle. Consultez un avocat qualifié avant toute action.
