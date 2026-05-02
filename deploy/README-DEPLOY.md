# RESOURCES-ANALYZER PRO — Guide de déploiement VPS

**Sous-domaine cible** : `resources-analyzer.vitae-publica.tech`
**Stack réelle de l'app** : FastAPI (Python 3.11) + MongoDB + React CRA
**Auteur** : Ahmed ELY Mustapha · PMP I-PMP IBM Full Stack Developer

---

## ⚠️ Note importante sur la stack

Le prompt de déploiement initial décrivait **Node.js/Express + Supabase/pgvector**.
L'application réellement construite utilise **FastAPI + MongoDB + React CRA** (choix
imposé par l'environnement de build Emergent, qui enforce MongoDB).

Ces scripts sont donc **adaptés au vrai code** tout en préservant :
- ✅ User Linux dédié `resources` (isolé de `vitae`)
- ✅ Port backend **8003** (8001=VITAE-PUBLICA, 8002=autre service)
- ✅ Sous-domaine `resources-analyzer.vitae-publica.tech`
- ✅ Vhost Nginx additionnel, **sans toucher** à VITAE-PUBLICA
- ✅ Idempotence, logs colorés, rollback automatique

Différences principales vs prompt initial :
| Élément | Prompt initial | Script livré (réel) |
|---|---|---|
| Backend runtime | Node.js 20 + Express | **Python 3.11 + FastAPI + Uvicorn** |
| Process manager | PM2 | **systemd** (meilleure intégration Ubuntu) |
| Base de données | Supabase Postgres + pgvector | **MongoDB 7.0 local** + TF-IDF scikit-learn |
| Build frontend | Vite → `dist/` | **CRA → `build/`** |
| Embeddings | text-embedding-ada-002 | Non utilisé (TF-IDF local) |
| LLM | OpenAI direct | **Emergent LLM Key** + OpenAI direct en fallback |

---

## 📋 Prérequis

### Côté serveur
- VPS Ubuntu 24/25 LTS (≥ 2 Go RAM, ≥ 5 Go disque libre)
- Accès root/sudo
- Nginx déjà installé et actif (pour VITAE-PUBLICA)
- Ports 80 / 443 ouverts
- Port 8003 libre

### Côté DNS
Entrée A ou CNAME à créer chez ton registrar :
```
Type  : A
Nom   : resources-analyzer
Valeur: <IP_VPS>
TTL   : 300
```

Test : `dig resources-analyzer.vitae-publica.tech +short` → doit renvoyer l'IP VPS.

### Côté secrets
- **Emergent LLM Key** (Universal Key) : récupérée depuis le dashboard Emergent
- **OpenAI API Key** (optionnel, pour contourner le budget Emergent)

---

## 🚀 Installation

### Étape 1 — Pré-flight check
```bash
cd /app/deploy
sudo bash check-prerequisites.sh
```
Résultat attendu : toutes les rubriques en ✅ (les ⚠️ sont acceptables).

### Étape 2 — Exporter les secrets
```bash
export EMERGENT_LLM_KEY="sk-emergent-xxxxxxxxxxxx"
export OPENAI_API_KEY="sk-proj-xxxxxxxxxxxx"   # optionnel
```

### Étape 3 — Installation principale
```bash
sudo -E bash install-resources-analyzer.sh
```
Le `-E` préserve les variables d'environnement. Le script demande :
1. Confirmation de l'installation
2. Choix méthode de déploiement (Git clone ou fichiers en place)
3. Si Git : URL du repo
4. Si fichiers : placer manuellement puis `ENTRÉE`
5. Confirmation DNS pour Certbot (sinon SSL différé)

Durée : **8 à 15 min** selon connexion.

### Étape 4 — SSL (si différé)
Après propagation DNS :
```bash
sudo bash /home/resources/scripts/install-ssl.sh
```

### Étape 5 — Vérification finale
```bash
resources-analyzer health
```
Résultat attendu :
```
  Service systemd : ✅ active
  API local 8003  : ✅ OK
  HTTPS frontend  : ✅ HTTP 200
  VITAE-PUBLICA   : ✅ HTTP 200/301/302 intact
  MongoDB         : ✅ répond
```

---

## ⚙️ Variables .env à connaître

Le fichier `/home/resources/app/backend/.env` (chmod 600) contient :

| Variable | Description | Source |
|---|---|---|
| `MONGO_URL` | `mongodb://127.0.0.1:27017` | Auto |
| `DB_NAME` | `resources_analyzer_prod` | Auto |
| `CORS_ORIGINS` | `https://resources-analyzer.vitae-publica.tech` | Auto |
| `JWT_SECRET` | 64 hex chars aléatoires | Auto |
| `EMERGENT_LLM_KEY` | Clé universelle Emergent | **À renseigner** |
| `OPENAI_API_KEY` | Fallback OpenAI | Optionnel |
| `PUBLIC_APP_URL` | URL publique (pour QR codes Share Verdict) | Auto |
| `MAX_FILE_SIZE_MB` | 200 | Auto |

Le frontend a `/home/resources/app/frontend/.env.production` :
```
REACT_APP_BACKEND_URL=https://resources-analyzer.vitae-publica.tech
```
⚠️ Toute modification de ce fichier nécessite un **rebuild** :
```bash
cd /home/resources/app/frontend && sudo -u resources yarn build
sudo systemctl reload nginx
```

---

## 🛠 Maintenance quotidienne

Toutes les commandes passent par le raccourci global `resources-analyzer` :

| Commande | Action |
|---|---|
| `resources-analyzer status` | Service + Nginx + ports + UFW |
| `resources-analyzer restart` | Redémarrer service + reload Nginx |
| `resources-analyzer logs` | 80 dernières lignes journalctl |
| `resources-analyzer logs-follow` | Logs en temps réel |
| `resources-analyzer logs-error` | Erreurs Nginx + API |
| `resources-analyzer health` | Test de santé complet (+ VITAE) |
| `resources-analyzer backup` | Tar.gz app + dump MongoDB |
| `resources-analyzer update` | Git pull + rebuild + restart |
| `resources-analyzer ssl-renew` | Renouveler le certificat |
| `resources-analyzer clean-uploads` | Supprimer uploads temp > 7j |

---

## 🔄 Cron jobs installés

```
0 2 * * *     Backup quotidien (app + MongoDB dump)
*/5 * * * *   Health check → restart si KO
0 4 * * 0     Cleanup uploads temporaires hebdo
30 4 * * 0    Suppression logs archivés > 30j
0 3 * * *     Renouvellement SSL (certbot)
```

---

## 🔥 Dépannage courant

### Service `resources-analyzer` ne démarre pas
```bash
journalctl -u resources-analyzer -n 50
# Souvent : venv corrompu, import error, port occupé
cd /home/resources/app/backend
sudo -u resources bash -c "source venv/bin/activate && python -c 'import server'"
```

### Nginx 502 Bad Gateway
```bash
# Vérifier que l'API écoute
ss -tlnp | grep 8003
curl -s http://127.0.0.1:8003/api/
# Si rien :
sudo systemctl restart resources-analyzer
```

### Erreur `Budget has been exceeded` (LLM)
La clé Emergent est épuisée. Deux options :
1. Recharger dans Emergent Dashboard → Profile → Universal Key → Add Balance
2. Définir `OPENAI_API_KEY` dans `.env` backend (fallback direct OpenAI)
3. Les endpoints v3/v4 retournent automatiquement un **fallback structuré** avec
   champ `_warning` (jamais de 500 brut)

### Certbot échoué (`unauthorized` ou `DNS problem`)
- Vérifier la propagation : `dig resources-analyzer.vitae-publica.tech +short`
- Attendre 5-30 min après changement DNS
- Relancer : `sudo bash /home/resources/scripts/install-ssl.sh`

### VITAE-PUBLICA cassé après installation
**Ne devrait jamais arriver** — le script teste `nginx -t` avant chaque reload
et rollback automatiquement. Si ça arrive :
```bash
sudo bash /app/deploy/rollback.sh
# Vérifier VITAE :
curl -I https://vitae-publica.tech
```

### Port 8003 déjà utilisé
```bash
ss -tlnp | grep 8003   # Identifier le process
# Option 1 : arrêter le process concurrent
# Option 2 : éditer BACKEND_PORT=8004 dans install-resources-analyzer.sh
#            et relancer (le script est idempotent)
```

### Problème MongoDB (connection refused)
```bash
sudo systemctl status mongod
sudo systemctl restart mongod
# Vérifier bind :
grep bindIp /etc/mongod.conf   # doit être 127.0.0.1
```

### Mise à jour du code sans downtime
```bash
resources-analyzer update
# Git pull + pip install + yarn build + systemd reload
# systemd redémarre le service (< 2s d'interruption)
```

---

## 🔐 Sécurité

- ✅ `.env` en chmod 600 (seul `resources` peut lire)
- ✅ MongoDB bindé sur 127.0.0.1 (aucun accès externe)
- ✅ Port 8003 en **loopback only** via UFW
- ✅ Nginx ajoute les headers HSTS, CSP, X-Frame-Options
- ✅ Uploads en `/uploads/` bloqués en accès direct
- ✅ systemd `ProtectSystem=strict` + `ProtectHome=read-only`
- ✅ `fail2ban` installé pour SSH
- ✅ Backups chiffrés recommandés (ajouter `gpg` dans maintenance.sh si besoin)

**Secrets à archiver après install** (visibles une seule fois à la fin du script) :
- `JWT_SECRET` (64 hex) — rotation possible via édition .env + restart

---

## 🎯 Rollback

Deux modes :

### Mode conservatif (données préservées)
```bash
sudo bash /app/deploy/rollback.sh
```
- Arrête et supprime le service systemd
- Supprime le vhost Nginx et le SSL
- Retire les règles UFW et cron
- **Conserve** `/home/resources/app/` et la base MongoDB

### Mode purge complète
```bash
sudo bash /app/deploy/rollback.sh --purge
```
- Tout ce qui précède
- **Supprime** `/home/resources/` et le user Linux
- **Drop** la base `resources_analyzer_prod`

Dans les deux cas, **VITAE-PUBLICA reste intact** (testé automatiquement).

---

## 📊 Architecture finale

```
Internet
   │
   ▼
 [Nginx :443] ──┬── server_name vitae-publica.tech       → 127.0.0.1:8001 (Uvicorn VITAE)
                ├── server_name <service existant>       → 127.0.0.1:8002
                └── server_name resources-analyzer.*     → 127.0.0.1:8003 (Uvicorn RESOURCES)

 [systemd]
   ├── mongod.service            (MongoDB 7.0, bind 127.0.0.1)
   ├── nginx.service
   ├── vitae-publica.service     (existant — non modifié)
   └── resources-analyzer.service (nouveau, 2 workers Uvicorn)

 [UFW]  22, 80, 443 = public   |   8001, 8002, 8003 = loopback only
```

---

## 📞 Contact

Ahmed ELY Mustapha
PMP · I-PMP · IBM Full Stack Developer
Suite "La transparence contractuelle au service du peuple"
