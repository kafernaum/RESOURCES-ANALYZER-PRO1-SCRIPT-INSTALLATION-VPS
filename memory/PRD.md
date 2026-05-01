# RESOURCES-ANALYZER PRO — PRD

## Problem statement (verbatim)

Application web full-stack d'analyse des conventions d'exploitation des ressources naturelles
(Mines, Pétrole, Gaz, Maritime, Forêt) entre États et entreprises privées. Détecte violations
juridiques, déséquilibres contractuels, atteintes à la souveraineté. Auteur méthodologique :
Ahmed ELY Mustapha — Juriste, Expert en Finances Publiques.

Stack adaptée : FastAPI + MongoDB + React (au lieu du Node + Supabase pgvector initial).

## Personas cibles

| Persona | Besoin clé |
|---|---|
| Juriste / Avocat | REJD défendable + Word éditable + jurisprudence |
| Parlementaire | Synthèse pédagogique + recours parlementaire |
| Gouvernement | Renégociation avec formulations alternatives |
| ONG / Société civile | Infographies + chiffres clés + Global Witness alerts |
| Citoyen | Vulgarisation, slogan, transparence |
| Chercheur | Données brutes JSON, comparatifs multi-conventions |

## Architecture

- **Frontend** : React 19 + Tailwind + shadcn/ui + Recharts + react-leaflet
- **Backend** : FastAPI + motor (MongoDB async)
- **Auth** : JWT + bcrypt
- **LLM** : GPT-4o via emergentintegrations (Universal Key)
- **Recherche BLN** : TF-IDF (scikit-learn) — local, sans API, parfait pour articles juridiques en français
- **Extraction docs** : pypdf, python-docx, openpyxl
- **Reports** : reportlab (PDF) + python-docx (Word) + openpyxl (Excel) + zipfile (ZIP pack)

## Implémenté en v1 (2026-02)

Cycles 1-7 : Auth/Sidebar/Landing, Upload+Extraction GPT-4o, 5 analyses ZERO LLM (Financier/SEC/SSC/IDC/SOS),
Analyse juridique GPT-4o, Diagnostics GPT-4o, Dashboard 12 KPIs + 8 visualisations Recharts,
Référentiel pré-chargé (40 normes, 16 jurisprudence, 51 glossaire), Simulateur, Reports PDF (6 presets).

## Implémenté en v2 (2026-02)

### Cycle 6 — Visualisations avancées
- ✅ **Treemap** des clauses (gravité × type)
- ✅ **Scatter** clauses (gravité × type avec quadrants)
- ✅ **Waterfall** décomposition recettes État
- ✅ **Spider** obligations sociales (Convention vs cible)
- ✅ **Timeline AreaChart** calendrier obligations
- ✅ **Sankey-like** flux des ressources État/Entreprise
- ✅ **Map Leaflet** localisation de la zone de concession (centroïdes pays africains)

### Cycle 7 — Exports avancés
- ✅ **Word docx éditable** (python-docx) — sections complètes, tables stylisées
- ✅ **Excel multi-onglets** (openpyxl) — Synthèse / Violations / Diagnostics / Financier
- ✅ **ZIP pack REJD** complet (PDF + Word + Excel + JSON brut + README)

### Cycle 8 — Conventions modèles
- ✅ **6 conventions modèles** : PSA AIPN, NRGI Mining, CNUDM Maritime, REDD+ Forêt, Vision Africaine, JV CNUCED
- ✅ **6 conventions de démonstration** : Tasiast, Simandou, Jubilee, Rovuma, NLNG, GTA
- ✅ Page dédiée `/models` avec scores de conformité 85-92/100

### Cycle 10 — Module 7 BLN (Bibliothèque Législative Nationale)
- ✅ Upload textes nationaux (12 codes : Constitution, mines, hydrocarbures, env, eau, pénal, invest, travail, foncier, MP, ITIE, anti-corruption)
- ✅ Fragmentation automatique par articles (regex multi-pattern)
- ✅ Recherche **TF-IDF cosinus** locale (scikit-learn, stopwords français, ngram 1-2) — pas d'API needed
- ✅ Confrontation convention/loi via 1 appel GPT-4o groupé (cached)
- ✅ Détection des dérogations illégales (fiscale/environnementale/foncière/procédurale/pénale)

### Cycle 12 — Module 9 Collecte automatique
- ✅ **10 connecteurs** : ResourceContracts.org (API réelle), ITIE, FMI, Banque Mondiale, CIRDI, PWYP, Global Witness, Légifrance, OHADA, OpenAlex (API réelle)
- ✅ **Profil de réputation** des sociétés contractantes (heuristique + liens vers OFAC/OCCRP/PWYP/ICIJ)
- ✅ Interface de validation par item (ajouter/ignorer)

## Backlog

### P0 (différé v3)
- [ ] **REJD complet 8 parties + 8 annexes** (version actuelle = synthétique)
- [ ] **Mode présentation 9 slides plein écran**
- [ ] **Comparateur multi-conventions** (côte à côte 2-4 conventions du même secteur)
- [ ] **Simulateur de renégociation lié à un projet** (impact temps réel sur scores existants)

### P1
- [ ] **Cycle 11** : Upload jurisprudence nationale + recherche TF-IDF + génération automatique d'arguments par violation
- [ ] **Aide à la rédaction d'amendements** (clause originale → clause proposée GPT-4o)
- [ ] **Connexion VITAE-PUBLICA + DEBT-ANALYZER PRO** (suite Ahmed ELY Mustapha)
- [ ] **Resource-Backed Loan Detector** (croisement DEBT/RESOURCES)

### P2
- [ ] **Veille continue** avec alertes email + in-app (cron jobs)
- [ ] **Filigrane PDF** ID utilisateur + horodatage (traçabilité judiciaire)
- [ ] **Audit log** des analyses (qui a généré quoi, quand)
- [ ] **Export ZIP signé numériquement**

## Décisions techniques notables

1. **MongoDB Atlas Vector Search non requis** : remplacé par TF-IDF scikit-learn local (mémoire faible, calcul à la demande, parfait pour textes juridiques courts).
2. **Universal Key budget exhausted** : la clé d'origine a un budget $3, dépassé pendant les tests étendus. Les utilisateurs doivent recharger via Profile → Universal Key → Add Balance pour les flux GPT-4o (extraction, juridique, diagnostics, requête libre, BLN confrontation). Tous les autres modules fonctionnent sans LLM.
3. **OCR différé** : tesseract.js était dans le prompt initial, mais nécessite Pillow + tesseract binary. Reporté car non critique pour conventions PDF/DOCX numérisées.

## Suivi

- 2026-02 : v1 (Cycles 1-7 + bonus) — landing, auth, upload+extraction, 5 analyses, juridique, diagnostics, 12 KPIs + 8 viz, 6 reports PDF, simulateur, glossaire, référentiel.
- 2026-02 : v2 — 6 viz avancées (Treemap/Scatter/Waterfall/Spider/Timeline/Sankey/Map Leaflet), Word/Excel/ZIP exports, 6 conventions modèles + 6 démos, Module 7 BLN complet (TF-IDF + confrontation), Module 9 Collecte (10 connecteurs + réputation).
