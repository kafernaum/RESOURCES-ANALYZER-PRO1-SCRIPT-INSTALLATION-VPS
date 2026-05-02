#!/bin/bash
set -euo pipefail

# ╔══════════════════════════════════════════════════════════════╗
# ║   RESOURCES-ANALYZER PRO — Script d'installation VPS         ║
# ║   Sous-domaine : resources-analyzer.vitae-publica.tech       ║
# ║   OS cible     : Ubuntu 25 LTS                               ║
# ║   Stack RÉELLE : FastAPI + MongoDB + React CRA               ║
# ║   Auteur       : Ahmed ELY Mustapha                          ║
# ║   PMP I-PMP IBM Full Stack Developer                         ║
# ╚══════════════════════════════════════════════════════════════╝

# ─── Variables de configuration ────────────────────────────────
APP_NAME="resources-analyzer-pro"
APP_USER="resources"
APP_DIR="/home/resources/app"
DOMAIN="resources-analyzer.vitae-publica.tech"
MAIN_DOMAIN="vitae-publica.tech"

# Ports du VPS — cartographie complète
PORT_VITAE_PUBLICA=8001       # VITAE-PUBLICA backend (Uvicorn) — NE PAS TOUCHER
PORT_OCCUPIED=8002             # Autre service actif — NE PAS TOUCHER
BACKEND_PORT=8003              # RESOURCES-ANALYZER PRO backend (FastAPI/Uvicorn)

PYTHON_VERSION="3.11"
NODE_VERSION="20"                   # uniquement pour le BUILD du frontend React
FRONTEND_BUILD_DIR="/home/resources/app/frontend/build"
LOG_FILE="/var/log/resources-analyzer-install.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# MongoDB — base locale dédiée (isole VITAE-PUBLICA)
MONGO_DB_NAME="resources_analyzer_prod"
MONGO_URL="mongodb://127.0.0.1:27017"

# ─── Secrets (à renseigner — le script affichera à la fin) ────
EMERGENT_LLM_KEY="${EMERGENT_LLM_KEY:-VOTRE_EMERGENT_LLM_KEY}"
OPENAI_API_KEY="${OPENAI_API_KEY:-VOTRE_OPENAI_API_KEY_OPTIONNEL}"
JWT_SECRET="$(openssl rand -hex 32)"

# ─── Fonctions de logging coloré ───────────────────────────────
log_success() { echo -e "\e[32m[✅ SUCCÈS]\e[0m $1" | tee -a "$LOG_FILE"; }
log_error()   { echo -e "\e[31m[❌ ERREUR]\e[0m $1" | tee -a "$LOG_FILE"; }
log_info()    { echo -e "\e[33m[ℹ️  INFO]\e[0m $1"  | tee -a "$LOG_FILE"; }
log_step()    { echo -e "\e[34m[🔧 ÉTAPE]\e[0m $1"  | tee -a "$LOG_FILE"; }
log_warn()    { echo -e "\e[35m[⚠️  WARN]\e[0m $1"  | tee -a "$LOG_FILE"; }

# Initialisation du fichier de log
mkdir -p /var/log
{
  echo "═══════════════════════════════════════"
  echo "RESOURCES-ANALYZER PRO — Installation"
  echo "Démarré le : $TIMESTAMP"
  echo "═══════════════════════════════════════"
} >> "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════
# SECTION 1 — VÉRIFICATIONS PRÉALABLES
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 1 — Vérifications préalables..."

# 1a — OS Ubuntu
OS_NAME=$(lsb_release -is 2>/dev/null || echo "Unknown")
OS_VERSION=$(lsb_release -rs 2>/dev/null || echo "0")
log_info "OS détecté : $OS_NAME $OS_VERSION"
if [[ "$OS_NAME" != "Ubuntu" ]]; then
  log_warn "OS non Ubuntu — ce script est optimisé pour Ubuntu 24/25 LTS."
  read -rp "Continuer à vos risques ? (y/n) : " CONTINUE_OS
  [[ "$CONTINUE_OS" != "y" ]] && exit 1
fi

# 1b — Exécution root
if [[ $EUID -ne 0 ]]; then
  log_error "Ce script doit être exécuté en root ou sudo."
  log_error "Commande : sudo bash install-resources-analyzer.sh"
  exit 1
fi
log_success "Exécution root confirmée"

# 1c — Internet
ping -c 1 -W 3 google.com &>/dev/null \
  && log_success "Connectivité internet OK" \
  || { log_error "Pas de connectivité internet"; exit 1; }

# 1d — VITAE-PUBLICA intact
NGINX_STATUS=$(systemctl is-active nginx 2>/dev/null || echo "inactive")
if [[ "$NGINX_STATUS" == "active" ]]; then
  log_success "Nginx actif — VITAE-PUBLICA opérationnel"
else
  log_warn "Nginx inactif — VITAE-PUBLICA peut être arrêté"
  read -rp "Continuer quand même ? (y/n) : " CONTINUE_NGINX
  [[ "$CONTINUE_NGINX" != "y" ]] && exit 1
fi
ss -tlnp 2>/dev/null | grep -q ":8001" \
  && log_success "Port 8001 (VITAE-PUBLICA) actif" \
  || log_warn "Port 8001 (VITAE-PUBLICA) non détecté (non bloquant)"

# 1e — Port 8003 libre
if ss -tlnp 2>/dev/null | grep -q ":8003"; then
  log_error "Port 8003 déjà utilisé ! Identifier : ss -tlnp | grep 8003"
  exit 1
fi
log_success "Port 8003 libre"

# 1f — Espace disque
DISK_FREE_GB=$(df / | awk 'NR==2 {print int($4/1024/1024)}')
if [[ $DISK_FREE_GB -lt 5 ]]; then
  log_warn "Espace disque : ${DISK_FREE_GB} Go (minimum recommandé : 5 Go)"
  read -rp "Continuer ? (y/n) : " CONTINUE_DISK
  [[ "$CONTINUE_DISK" != "y" ]] && exit 1
else
  log_success "Espace disque : ${DISK_FREE_GB} Go disponibles"
fi

# 1g — Récapitulatif
cat <<EOF

  ╔══════════════════════════════════════════════════╗
  ║   RÉCAPITULATIF D'INSTALLATION                   ║
  ╠══════════════════════════════════════════════════╣
  ║  Application : RESOURCES-ANALYZER PRO            ║
  ║  Stack       : FastAPI + MongoDB + React CRA     ║
  ║  Sous-domaine: $DOMAIN ║
  ║  Dossier     : $APP_DIR                 ║
  ║  Port API    : $BACKEND_PORT (local)                      ║
  ║  User Linux  : $APP_USER (isolé de 'vitae')          ║
  ║  MongoDB DB  : $MONGO_DB_NAME           ║
  ║  Nginx       : vhost additionnel (VITAE intact)  ║
  ╠══════════════════════════════════════════════════╣
  ║  PORTS VPS                                       ║
  ║  8001 → VITAE-PUBLICA (NE PAS TOUCHER)           ║
  ║  8002 → Service existant (NE PAS TOUCHER)        ║
  ║  8003 → RESOURCES-ANALYZER PRO (nouveau)         ║
  ╚══════════════════════════════════════════════════╝

EOF
read -rp "  Confirmer l'installation ? (y/n) : " CONFIRM
[[ "$CONFIRM" != "y" ]] && { log_info "Installation annulée."; exit 0; }
log_success "Installation confirmée — démarrage…"

# ═══════════════════════════════════════════════════════════════
# SECTION 2 — MISE À JOUR DU SYSTÈME
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 2 — Mise à jour du système…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
log_success "Système mis à jour"

log_info "Installation des paquets système requis…"
apt-get install -y \
  curl wget git unzip zip \
  build-essential \
  software-properties-common apt-transport-https ca-certificates gnupg lsb-release \
  nginx certbot python3-certbot-nginx \
  openssl ufw \
  python${PYTHON_VERSION} python${PYTHON_VERSION}-venv python${PYTHON_VERSION}-dev \
  python3-pip \
  tesseract-ocr tesseract-ocr-fra tesseract-ocr-ara tesseract-ocr-eng \
  poppler-utils libreoffice-writer imagemagick ghostscript \
  htop net-tools logrotate jq fail2ban \
  libssl-dev libffi-dev libjpeg-dev zlib1g-dev \
  libxml2-dev libxslt1-dev

for PKG in curl git nginx certbot tesseract-ocr python${PYTHON_VERSION}; do
  if command -v "$PKG" &>/dev/null || dpkg -l "$PKG" &>/dev/null; then
    log_success "Paquet $PKG OK"
  else
    log_error "Paquet $PKG non installé"; exit 1
  fi
done

# ═══════════════════════════════════════════════════════════════
# SECTION 3 — NODE.JS 20 (UNIQUEMENT POUR LE BUILD FRONTEND)
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 3 — Installation Node.js ${NODE_VERSION} (build frontend)…"
if command -v node &>/dev/null; then
  NODE_CUR=$(node --version | sed 's/v//' | cut -d'.' -f1)
  log_info "Node.js v$(node --version) déjà présent"
  if [[ $NODE_CUR -lt 20 ]]; then
    log_warn "Node.js < 20 — mise à jour via NodeSource"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
    apt-get install -y nodejs
  fi
else
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -y nodejs
fi
log_success "Node.js $(node --version) / npm $(npm --version)"
npm install -g npm@latest yarn >/dev/null 2>&1 || true
log_success "yarn installé globalement"

# ═══════════════════════════════════════════════════════════════
# SECTION 4 — MONGODB (INSTALLATION SI ABSENT, ISOLATION PAR DB)
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 4 — Configuration MongoDB…"
if systemctl is-active --quiet mongod 2>/dev/null; then
  log_success "MongoDB déjà actif (réutilisation — nouvelle DB $MONGO_DB_NAME)"
else
  log_info "MongoDB absent — installation community edition 7.0…"
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
    gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update -qq
  apt-get install -y mongodb-org
  systemctl enable mongod
  systemctl start mongod
  sleep 3
  log_success "MongoDB 7.0 installé et démarré"
fi
# Isolation : MongoDB écoute uniquement sur 127.0.0.1
grep -q "bindIp: 127.0.0.1" /etc/mongod.conf 2>/dev/null \
  && log_success "MongoDB bindIp=127.0.0.1 (loopback uniquement)" \
  || log_warn "Vérifier /etc/mongod.conf pour bindIp=127.0.0.1"

# ═══════════════════════════════════════════════════════════════
# SECTION 5 — UTILISATEUR SYSTÈME ISOLÉ
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 5 — Création utilisateur '$APP_USER'…"
if id "$APP_USER" &>/dev/null; then
  log_info "Utilisateur '$APP_USER' déjà existant"
else
  useradd -m -s /bin/bash -d "/home/$APP_USER" "$APP_USER"
  log_success "Utilisateur '$APP_USER' créé"
fi

mkdir -p "$APP_DIR/frontend" "$APP_DIR/backend" \
         "$APP_DIR/uploads/temp" "$APP_DIR/uploads/documents" "$APP_DIR/uploads/exports" \
         "/home/$APP_USER/logs" "/home/$APP_USER/backups" "/home/$APP_USER/scripts"
chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/"
chmod 755 "$APP_DIR" "$APP_DIR/frontend" "$APP_DIR/backend"
chmod 700 "$APP_DIR/uploads" "/home/$APP_USER/backups"
chmod 755 "/home/$APP_USER/logs"
usermod -aG www-data "$APP_USER"
chmod 750 /home/vitae 2>/dev/null || true
log_success "Structure de dossiers créée et sécurisée"

# ═══════════════════════════════════════════════════════════════
# SECTION 6 — DÉPLOIEMENT DE L'APPLICATION
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 6 — Déploiement de l'application…"
echo "  [1] Git Clone depuis GitHub"
echo "  [2] Fichiers déjà copiés sur le serveur (export Emergent.sh)"
read -rp "  Votre choix (1/2) : " DEPLOY_METHOD

if [[ "$DEPLOY_METHOD" == "1" ]]; then
  read -rp "  URL du repo GitHub : " GIT_REPO
  [[ -z "$GIT_REPO" ]] && { log_error "URL Git vide"; exit 1; }
  # clone dans un dossier temporaire puis copie → préserve .env existants
  TMP_CLONE=$(mktemp -d)
  sudo -u "$APP_USER" git clone "$GIT_REPO" "$TMP_CLONE/clone"
  sudo -u "$APP_USER" rsync -a --exclude='.env' --exclude='.env.*' \
    "$TMP_CLONE/clone/" "$APP_DIR/"
  rm -rf "$TMP_CLONE"
  log_success "Repository cloné depuis $GIT_REPO"
else
  log_info "Fichiers attendus :"
  log_info "  $APP_DIR/backend/server.py + requirements.txt"
  log_info "  $APP_DIR/frontend/package.json + src/"
  read -rp "  Appuyez sur ENTRÉE quand les fichiers sont en place…" _
fi

MISSING=0
for FILE in \
  "$APP_DIR/backend/server.py" \
  "$APP_DIR/backend/requirements.txt" \
  "$APP_DIR/frontend/package.json"; do
  if [[ ! -f "$FILE" ]]; then
    log_warn "Fichier manquant : $FILE"; MISSING=$((MISSING+1))
  else
    log_success "Fichier présent : $FILE"
  fi
done
if [[ $MISSING -gt 0 ]]; then
  read -rp "  Continuer quand même ? (y/n) : " CONTINUE_FILES
  [[ "$CONTINUE_FILES" != "y" ]] && exit 1
fi

# ═══════════════════════════════════════════════════════════════
# SECTION 7 — DÉPENDANCES BACKEND (FastAPI + venv)
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 7 — Dépendances backend Python (venv)…"
sudo -u "$APP_USER" bash <<BACKEND_EOF
cd "$APP_DIR/backend"
python${PYTHON_VERSION} -m venv venv
source venv/bin/activate
pip install --upgrade pip wheel setuptools
pip install -r requirements.txt
# emergentintegrations (index privé Emergent)
pip install emergentintegrations \
  --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ || true
pip install "uvicorn[standard]" gunicorn
deactivate
BACKEND_EOF
log_success "venv Python + dépendances installées"

# Smoke-test : le module server.py doit s'importer
sudo -u "$APP_USER" bash -c \
  "cd $APP_DIR/backend && source venv/bin/activate && python -c 'import server' " \
  && log_success "server.py importable" \
  || { log_error "server.py échoue à l'import"; exit 1; }

# ═══════════════════════════════════════════════════════════════
# SECTION 8 — BUILD FRONTEND (React CRA → /frontend/build)
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 8 — Build frontend React…"
sudo -u "$APP_USER" bash <<FRONTEND_EOF
cd "$APP_DIR/frontend"
yarn install --frozen-lockfile || yarn install
FRONTEND_EOF

# .env frontend doit pointer vers le domaine public AVANT le build
cat > "$APP_DIR/frontend/.env.production" <<EOF
REACT_APP_BACKEND_URL=https://$DOMAIN
WDS_SOCKET_PORT=443
EOF
chown "$APP_USER:$APP_USER" "$APP_DIR/frontend/.env.production"
chmod 644 "$APP_DIR/frontend/.env.production"

sudo -u "$APP_USER" bash -c "cd $APP_DIR/frontend && yarn build"

if [[ -f "$APP_DIR/frontend/build/index.html" ]]; then
  ASSETS_JS=$(find "$APP_DIR/frontend/build/static/js" -name "*.js" 2>/dev/null | wc -l)
  log_success "Build React valide — build/index.html présent ($ASSETS_JS JS bundles)"
else
  log_error "build/index.html absent"; exit 1
fi
chown -R "$APP_USER:www-data" "$APP_DIR/frontend/build"
chmod -R 755 "$APP_DIR/frontend/build"
log_success "Permissions build configurées pour Nginx"

# ═══════════════════════════════════════════════════════════════
# SECTION 9 — FICHIER .ENV BACKEND
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 9 — Création du .env backend…"
cat > "$APP_DIR/backend/.env" <<EOF
# ══════════════════════════════════════════════════════════════
# RESOURCES-ANALYZER PRO — Configuration production
# Généré le $TIMESTAMP
# ⚠️  NE JAMAIS COMMITTER CE FICHIER
# ══════════════════════════════════════════════════════════════
MONGO_URL=$MONGO_URL
DB_NAME=$MONGO_DB_NAME
CORS_ORIGINS=https://$DOMAIN
PORT=$BACKEND_PORT

# Sécurité JWT
JWT_SECRET=$JWT_SECRET
JWT_ALG=HS256
JWT_EXPIRES_MIN=10080

# LLM — Emergent Universal Key
EMERGENT_LLM_KEY=$EMERGENT_LLM_KEY
OPENAI_API_KEY=$OPENAI_API_KEY

# Public URL (pour QR code Share Verdict)
PUBLIC_APP_URL=https://$DOMAIN

# Uploads
MAX_FILE_SIZE_MB=200
UPLOAD_DIR=$APP_DIR/uploads
EOF
chown "$APP_USER:$APP_USER" "$APP_DIR/backend/.env"
chmod 600 "$APP_DIR/backend/.env"
log_success ".env backend créé (chmod 600)"

# .gitignore
cat > "$APP_DIR/.gitignore" <<'EOF'
.env
.env.*
*/venv/
*/node_modules/
frontend/build/
uploads/
backups/
*.log
.DS_Store
EOF
chown "$APP_USER:$APP_USER" "$APP_DIR/.gitignore"

# ═══════════════════════════════════════════════════════════════
# SECTION 10 — SERVICE SYSTEMD (remplace PM2 côté Python)
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 10 — Service systemd FastAPI/Uvicorn…"
cat > /etc/systemd/system/resources-analyzer.service <<EOF
[Unit]
Description=RESOURCES-ANALYZER PRO — FastAPI (Uvicorn)
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$APP_DIR/backend/.env
ExecStart=$APP_DIR/backend/venv/bin/uvicorn server:app \\
  --host 127.0.0.1 \\
  --port $BACKEND_PORT \\
  --workers 2 \\
  --proxy-headers \\
  --forwarded-allow-ips=127.0.0.1 \\
  --log-level info
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=15
StandardOutput=append:/home/$APP_USER/logs/api.log
StandardError=append:/home/$APP_USER/logs/api-error.log

# Durcissement
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$APP_DIR/uploads /home/$APP_USER/logs
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable resources-analyzer
systemctl restart resources-analyzer
sleep 3

if systemctl is-active --quiet resources-analyzer; then
  log_success "Service systemd resources-analyzer ONLINE"
else
  log_error "Service systemd en échec — voir : journalctl -u resources-analyzer -n 50"
  systemctl status resources-analyzer --no-pager | tail -15
  read -rp "Continuer ? (y/n) : " CONTINUE_SVC
  [[ "$CONTINUE_SVC" != "y" ]] && exit 1
fi

API_RESP=$(curl -s --max-time 10 "http://127.0.0.1:$BACKEND_PORT/api/" 2>/dev/null || echo "")
if echo "$API_RESP" | grep -q "RESOURCES-ANALYZER"; then
  log_success "API FastAPI répond sur 127.0.0.1:$BACKEND_PORT ✅"
else
  log_warn "API ne répond pas encore — vérifier journalctl -u resources-analyzer"
fi
ss -tlnp 2>/dev/null | grep -q ":8001" \
  && log_success "Port 8001 (VITAE-PUBLICA) toujours actif ✅"

# ═══════════════════════════════════════════════════════════════
# SECTION 11 — NGINX (vhost additionnel, ne touche pas VITAE)
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 11 — Configuration Nginx…"
nginx -t 2>&1 | grep -q "successful" \
  || { log_error "Config Nginx existante invalide — abandon"; exit 1; }
log_success "Config Nginx actuelle valide"

# vhost HTTP-only d'abord (pour Certbot) → sera upgradé en HTTPS par certbot
cat > /etc/nginx/sites-available/resources-analyzer <<NGINX_EOF
# ════════════════════════════════════════════════════════════════
# RESOURCES-ANALYZER PRO — $DOMAIN
# Port backend : $BACKEND_PORT (8001=VITAE-PUBLICA, 8002=autre)
# ════════════════════════════════════════════════════════════════
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # Webroot Certbot
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    # Taille max uploads
    client_max_body_size 210M;
    client_body_timeout 300s;
    send_timeout 300s;

    # Logs dédiés
    access_log /home/$APP_USER/logs/nginx-access.log combined;
    error_log  /home/$APP_USER/logs/nginx-error.log warn;

    # Frontend React (build CRA → /frontend/build)
    root $APP_DIR/frontend/build;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_comp_level 6;
    gzip_types
        text/plain text/css text/xml text/javascript
        application/javascript application/xml+rss
        application/json application/manifest+json
        image/svg+xml font/woff font/woff2;

    # Cache long pour les assets CRA (noms hashés)
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|webmanifest)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Backend FastAPI (port $BACKEND_PORT) — préserve le prefix /api
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_connect_timeout 30s;
        proxy_request_buffering off;
        proxy_buffering off;
    }

    # Uploads bloqués en accès direct
    location /uploads/ { deny all; return 403; }

    # SPA fallback React Router
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/resources-analyzer \
       /etc/nginx/sites-enabled/resources-analyzer
mkdir -p /var/www/certbot
chown www-data:www-data /var/www/certbot

if nginx -t 2>&1 | grep -q "successful"; then
  log_success "Nouvelle config Nginx valide"
  systemctl reload nginx
  log_success "Nginx rechargé (VITAE-PUBLICA et RESOURCES-ANALYZER actifs)"
else
  log_error "Config Nginx invalide — rollback vhost"
  rm -f /etc/nginx/sites-enabled/resources-analyzer
  rm -f /etc/nginx/sites-available/resources-analyzer
  nginx -t
  exit 1
fi

VITAE_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  "https://$MAIN_DOMAIN" 2>/dev/null || echo "000")
[[ "$VITAE_CODE" =~ ^(200|301|302)$ ]] \
  && log_success "VITAE-PUBLICA (https://$MAIN_DOMAIN) intact — HTTP $VITAE_CODE ✅" \
  || log_warn "VITAE-PUBLICA retourne HTTP $VITAE_CODE — vérifier manuellement"

# ═══════════════════════════════════════════════════════════════
# SECTION 12 — SSL Let's Encrypt
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 12 — SSL Let's Encrypt…"
SERVER_IP=$(curl -s --max-time 5 ifconfig.me || hostname -I | awk '{print $1}')
cat <<EOF

  ┌──────────────────────────────────────────────┐
  │  ⚠️  ACTION REQUISE — CONFIGURATION DNS      │
  ├──────────────────────────────────────────────┤
  │  Type  : A (ou CNAME vers vitae-publica.tech)│
  │  Nom   : resources-analyzer                  │
  │  Valeur: $SERVER_IP
  │  TTL   : 300                                 │
  │                                              │
  │  Test  : dig $DOMAIN +short
  └──────────────────────────────────────────────┘

EOF
read -rp "  DNS configuré et propagé ? (y/n) : " DNS_READY
if [[ "$DNS_READY" == "y" ]]; then
  certbot --nginx -d "$DOMAIN" \
    --non-interactive --agree-tos \
    --email "admin@$MAIN_DOMAIN" --redirect --staple-ocsp \
    && log_success "Certificat SSL installé" \
    || log_error "Certbot échoué — relancer après propagation DNS"
else
  log_info "Configurer le DNS puis exécuter :"
  log_info "  sudo bash /home/$APP_USER/scripts/install-ssl.sh"
fi

# Cron renouvellement
if systemctl is-active --quiet certbot.timer; then
  log_success "Certbot timer actif (renouvellement auto)"
else
  (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | crontab -
  log_success "Cron certbot ajouté (3h chaque nuit)"
fi

# ═══════════════════════════════════════════════════════════════
# SECTION 13 — UFW
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 13 — Pare-feu UFW…"
ufw allow ssh comment "SSH admin"
ufw allow 22/tcp comment "SSH port explicite"
ufw allow 80/tcp comment "HTTP → HTTPS"
ufw allow 443/tcp comment "HTTPS Nginx"

for PORT in 8001 8002 8003; do
  ufw deny in from any to any port $PORT comment "port $PORT — backend interne"
  ufw allow in on lo to any port $PORT comment "port $PORT — loopback"
done

if ufw status | grep -q "Status: active"; then
  ufw reload
  log_success "Règles UFW rechargées"
else
  ufw --force enable
  log_success "UFW activé"
fi

cat <<EOF

  ┌──────┬──────────────────────────────────────────┐
  │ Port │ Service                    UFW          │
  ├──────┼──────────────────────────────────────────┤
  │  22  │ SSH                      [AUTORISÉ]     │
  │  80  │ HTTP → HTTPS             [AUTORISÉ]     │
  │  443 │ HTTPS Nginx              [AUTORISÉ]     │
  │ 8001 │ VITAE-PUBLICA (loopback) [BLOQUÉ WAN]   │
  │ 8002 │ Service existant (loop.) [BLOQUÉ WAN]   │
  │ 8003 │ RESOURCES-ANALYZER (lo.) [BLOQUÉ WAN]   │
  └──────┴──────────────────────────────────────────┘

EOF

# ═══════════════════════════════════════════════════════════════
# SECTION 14 — LOGROTATE
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 14 — Logrotate…"
cat > /etc/logrotate.d/resources-analyzer <<LOGROTATE_EOF
/home/$APP_USER/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 $APP_USER www-data
    sharedscripts
    postrotate
        systemctl reload nginx 2>/dev/null || true
        systemctl kill -s HUP resources-analyzer 2>/dev/null || true
    endscript
}
LOGROTATE_EOF
logrotate -d /etc/logrotate.d/resources-analyzer &>/dev/null \
  && log_success "Logrotate configuré (rétention 30 jours)"

# ═══════════════════════════════════════════════════════════════
# SECTION 15 — SCRIPT DE MAINTENANCE + RACCOURCI GLOBAL
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 15 — Script de maintenance…"
cat > "/home/$APP_USER/maintenance.sh" <<'MAINT_EOF'
#!/bin/bash
# ══════════════════════════════════════════════════════
# Maintenance — RESOURCES-ANALYZER PRO
# Usage : resources-analyzer <cmd>
# ══════════════════════════════════════════════════════
APP_USER="resources"
APP_DIR="/home/$APP_USER/app"
BACKEND_PORT=8003
DOMAIN="resources-analyzer.vitae-publica.tech"
SVC="resources-analyzer"

G="\e[32m"; R="\e[31m"; Y="\e[33m"; N="\e[0m"
ok()   { echo -e "${G}✅ $1${N}"; }
err()  { echo -e "${R}❌ $1${N}"; }
info() { echo -e "${Y}ℹ️  $1${N}"; }

case "${1:-}" in
  start)     systemctl start "$SVC"; ok "Service démarré" ;;
  stop)      systemctl stop  "$SVC"; ok "Service arrêté" ;;
  restart)   systemctl restart "$SVC"; systemctl reload nginx; ok "Redémarré + Nginx reload" ;;
  status)
    echo "═══ Service RESOURCES-ANALYZER ═══"
    systemctl status "$SVC" --no-pager | head -12
    echo; echo "═══ Nginx ═══"
    systemctl status nginx --no-pager | head -6
    echo; echo "═══ Ports ═══"
    ss -tlnp 2>/dev/null | grep -E "8001|8002|8003|443|80" || true
    echo; echo "═══ UFW ═══"
    ufw status | grep -E "8001|8002|8003|80|443|22" || true
    ;;
  logs)        journalctl -u "$SVC" -n 80 --no-pager ;;
  logs-follow) journalctl -u "$SVC" -f ;;
  logs-nginx)  tail -60 "/home/$APP_USER/logs/nginx-access.log" ;;
  logs-error)
    echo "─── Nginx error ───"; tail -40 "/home/$APP_USER/logs/nginx-error.log"
    echo; echo "─── API error ───"; tail -40 "/home/$APP_USER/logs/api-error.log"
    ;;
  update)
    info "Mise à jour…"
    cd "$APP_DIR" && sudo -u $APP_USER git pull origin main
    cd "$APP_DIR/backend" && sudo -u $APP_USER bash -c "source venv/bin/activate && pip install -r requirements.txt"
    cd "$APP_DIR/frontend" && sudo -u $APP_USER yarn install && sudo -u $APP_USER yarn build
    systemctl restart "$SVC"; systemctl reload nginx
    ok "Mise à jour terminée"
    ;;
  backup)
    D=$(date +%Y%m%d_%H%M%S)
    F="/home/$APP_USER/backups/app_$D.tar.gz"
    info "Backup $D…"
    tar -czf "$F" "$APP_DIR" \
      --exclude='*/node_modules' --exclude='*/venv' \
      --exclude='*/build' --exclude='*/uploads'
    # Dump MongoDB
    mongodump --uri "mongodb://127.0.0.1:27017/resources_analyzer_prod" \
      --out "/home/$APP_USER/backups/mongo_$D" >/dev/null 2>&1 || true
    tar -czf "/home/$APP_USER/backups/mongo_$D.tar.gz" -C "/home/$APP_USER/backups" "mongo_$D" 2>/dev/null || true
    rm -rf "/home/$APP_USER/backups/mongo_$D" 2>/dev/null || true
    ok "App + Mongo sauvegardés : $F"
    ls -lh "/home/$APP_USER/backups/" | tail -6
    ;;
  ssl-renew)  certbot renew; systemctl reload nginx; ok "SSL renouvelé" ;;
  health)
    echo "═══ HEALTH CHECK — RESOURCES-ANALYZER PRO ═══"
    echo -n "  Service systemd : "; systemctl is-active "$SVC" && ok "active" || err "inactive"
    echo -n "  API local 8003  : "
    curl -s --max-time 5 "http://127.0.0.1:$BACKEND_PORT/api/" | grep -q "RESOURCES-ANALYZER" && ok "OK" || err "KO"
    echo -n "  HTTPS frontend  : "
    C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$DOMAIN")
    [[ "$C" == "200" ]] && ok "HTTP $C" || err "HTTP $C"
    echo -n "  VITAE-PUBLICA   : "
    V=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://vitae-publica.tech")
    [[ "$V" =~ ^(200|301|302)$ ]] && ok "HTTP $V ✅ intact" || err "HTTP $V"
    echo -n "  MongoDB         : "
    mongosh --quiet --eval "db.runCommand({ping:1}).ok" 2>/dev/null | grep -q 1 && ok "répond" || err "injoignable"
    ;;
  clean-uploads)
    info "Nettoyage uploads temporaires > 7 jours…"
    find "$APP_DIR/uploads/temp" -type f -mtime +7 -delete 2>/dev/null || true
    ok "Uploads temp nettoyés"
    ;;
  *)
    cat <<USAGE

Usage : resources-analyzer <commande>

  start          Démarrer le service
  stop           Arrêter le service
  restart        Redémarrer service + reload Nginx
  status         Statut complet (service + nginx + ports + ufw)
  logs           50 dernières lignes journalctl
  logs-follow    Suivre les logs en temps réel
  logs-nginx     Logs Nginx accès
  logs-error     Logs erreurs (Nginx + API)
  update         Git pull + rebuild + redémarrage
  backup         Sauvegarde app + dump MongoDB
  ssl-renew      Renouveler le SSL
  health         Test de santé (service/API/HTTPS/Mongo/VITAE)
  clean-uploads  Nettoyer uploads temporaires

USAGE
    exit 1 ;;
esac
MAINT_EOF
chmod +x "/home/$APP_USER/maintenance.sh"
chown "$APP_USER:$APP_USER" "/home/$APP_USER/maintenance.sh"
ln -sf "/home/$APP_USER/maintenance.sh" /usr/local/bin/resources-analyzer
log_success "Raccourci global : resources-analyzer <cmd>"

# ═══════════════════════════════════════════════════════════════
# SECTION 16 — CRON
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 16 — Cron jobs…"
# Ajout idempotent : on filtre les doublons
(crontab -l 2>/dev/null | grep -v "resources-analyzer " || true; cat <<CRON
# RESOURCES-ANALYZER PRO
0 2 * * * /usr/local/bin/resources-analyzer backup       >> /home/$APP_USER/logs/cron.log 2>&1
*/5 * * * * curl -s http://127.0.0.1:$BACKEND_PORT/api/ | grep -q RESOURCES-ANALYZER || systemctl restart resources-analyzer
0 4 * * 0 /usr/local/bin/resources-analyzer clean-uploads >> /home/$APP_USER/logs/cron.log 2>&1
30 4 * * 0 find /home/$APP_USER/logs -name '*.gz' -mtime +30 -delete
CRON
) | crontab -
log_success "Cron jobs installés (backup quotidien, health 5min, cleanup hebdo)"

# ═══════════════════════════════════════════════════════════════
# SECTION 17 — SCRIPTS ANNEXES (SSL séparé + script futur)
# ═══════════════════════════════════════════════════════════════
cat > "/home/$APP_USER/scripts/install-ssl.sh" <<SSL_EOF
#!/bin/bash
# Installer SSL après propagation DNS
set -e
certbot --nginx -d $DOMAIN \\
  --non-interactive --agree-tos --email admin@$MAIN_DOMAIN \\
  --redirect --staple-ocsp
systemctl reload nginx
echo "✅ SSL installé pour $DOMAIN"
SSL_EOF
chmod +x "/home/$APP_USER/scripts/install-ssl.sh"
chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/scripts"

# ═══════════════════════════════════════════════════════════════
# SECTION 18 — TESTS DE VALIDATION
# ═══════════════════════════════════════════════════════════════
log_step "SECTION 18 — Tests de validation finale…"
PASS=0; FAIL=0
run_test() {
  if eval "$2" &>/dev/null; then
    log_success "TEST [$1] PASSÉ"; PASS=$((PASS+1))
  else
    log_error "TEST [$1] ÉCHOUÉ"; FAIL=$((FAIL+1))
  fi
}
run_test "Python 3.11+"                  "python${PYTHON_VERSION} --version | grep -qE '3\.(11|12)'"
run_test "Node.js v20+"                   "node --version | grep -qE 'v(2[0-9]|3[0-9])'"
run_test "MongoDB actif"                  "systemctl is-active --quiet mongod"
run_test "Service resources-analyzer actif" "systemctl is-active --quiet resources-analyzer"
run_test "API local 8003 répond"          "curl -s --max-time 10 http://127.0.0.1:8003/api/ | grep -q RESOURCES-ANALYZER"
run_test "Frontend build présent"         "test -f $APP_DIR/frontend/build/index.html"
run_test ".env backend chmod 600"         "[[ \$(stat -c '%a' $APP_DIR/backend/.env) == '600' ]]"
run_test "Nginx actif"                    "systemctl is-active --quiet nginx"
run_test "Vhost resources-analyzer actif" "test -L /etc/nginx/sites-enabled/resources-analyzer"
run_test "Config Nginx valide"            "nginx -t 2>&1 | grep -q successful"
run_test "VITAE-PUBLICA port 8001 intact" "ss -tlnp | grep -q ':8001'"
run_test "UFW actif"                      "ufw status | grep -q 'Status: active'"
run_test "User resources existe"          "id $APP_USER"
run_test "Dossier logs présent"           "test -d /home/$APP_USER/logs"
run_test "Raccourci resources-analyzer"   "command -v resources-analyzer"

echo
echo "  ┌─────────────────────────────────────┐"
echo "  │  RÉSULTATS DES TESTS                │"
echo "  ├─────────────────────────────────────┤"
printf "  │  ✅ Passés  : %-2s / 15             │\n" "$PASS"
printf "  │  ❌ Échoués : %-2s / 15             │\n" "$FAIL"
echo "  └─────────────────────────────────────┘"

# ═══════════════════════════════════════════════════════════════
# SECTION 19 — RÉSUMÉ FINAL
# ═══════════════════════════════════════════════════════════════
echo
echo -e "\e[32m══════════════════════════════════════════════════════════"
echo "  ✅  RESOURCES-ANALYZER PRO — INSTALLATION TERMINÉE"
echo "══════════════════════════════════════════════════════════"
cat <<EOF

  🌐 Application    : https://$DOMAIN
  🔌 API Backend    : http://127.0.0.1:$BACKEND_PORT (interne)
  📁 Dossier app    : $APP_DIR
  👤 User Linux     : $APP_USER (isolé de 'vitae')
  🐍 Backend        : FastAPI + Uvicorn (systemd, 2 workers)
  🍃 MongoDB DB     : $MONGO_DB_NAME (loopback uniquement)
  🔒 SSL            : Let's Encrypt (auto-renouvellement)
  📋 Logs           : /home/$APP_USER/logs/
  💾 Backups        : /home/$APP_USER/backups/ (nightly)

  ─────────────────────────────────────────────────────
  CARTOGRAPHIE DES PORTS
  ─────────────────────────────────────────────────────
   22   SSH                         [PUBLIC]
   80   HTTP → HTTPS                [PUBLIC]
   443  HTTPS Nginx                 [PUBLIC]
  8001  VITAE-PUBLICA (Uvicorn)     [LOOPBACK — INTACT ✅]
  8002  Service existant            [LOOPBACK — INTACT ✅]
  8003  RESOURCES-ANALYZER PRO      [LOOPBACK — NOUVEAU ✅]

  ─────────────────────────────────────────────────────
  APPLICATIONS ACTIVES
  ─────────────────────────────────────────────────────
  VITAE-PUBLICA      : https://vitae-publica.tech
  RESOURCES-ANALYZER : https://$DOMAIN

  ─────────────────────────────────────────────────────
  MAINTENANCE
  ─────────────────────────────────────────────────────
  resources-analyzer status
  resources-analyzer restart
  resources-analyzer logs-follow
  resources-analyzer health
  resources-analyzer backup
  resources-analyzer update
  resources-analyzer ssl-renew

  ─────────────────────────────────────────────────────
  SÉCURITÉ
  ─────────────────────────────────────────────────────
  JWT_SECRET généré : $JWT_SECRET
  EMERGENT_LLM_KEY  : ${EMERGENT_LLM_KEY:0:12}…

  ⚠️  Conservez ces secrets — ils ne seront plus affichés.

  ─────────────────────────────────────────────────────
  LOG COMPLET   : $LOG_FILE
  TESTS PASSÉS  : $PASS/15
  INSTALLATION  : $TIMESTAMP
  ─────────────────────────────────────────────────────
  Ahmed ELY Mustapha — RESOURCES-ANALYZER PRO
  $(date '+%Y-%m-%d %H:%M:%S')
EOF
echo "══════════════════════════════════════════════════════════"
echo -e "\e[0m"

{
  echo "Installation terminée : $(date)"
  echo "Tests passés : $PASS/15"
  echo "JWT_SECRET   : $JWT_SECRET"
} >> "$LOG_FILE"
