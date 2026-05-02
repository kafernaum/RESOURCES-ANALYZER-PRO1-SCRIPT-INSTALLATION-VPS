#!/bin/bash
# ══════════════════════════════════════════════════════════════
# diagnose-auth.sh — Diagnostic de l'erreur "erreur de création"
# Identifie la cause exacte en testant chaque maillon
# Exécuter sur le VPS : sudo bash diagnose-auth.sh
# ══════════════════════════════════════════════════════════════
set +e   # On continue même en cas d'erreur — on diagnostique tout

DOMAIN="resources-analyzer.vitae-publica.tech"
APP_USER="resources"
APP_DIR="/home/$APP_USER/app"
BACKEND_PORT=8003

G="\e[32m"; R="\e[31m"; Y="\e[33m"; B="\e[34m"; N="\e[0m"
ok()   { echo -e "${G}  ✅ $1${N}"; }
ko()   { echo -e "${R}  ❌ $1${N}"; }
warn() { echo -e "${Y}  ⚠️  $1${N}"; }
h()    { echo -e "\n${B}━━ $1 ━━${N}"; }

echo "══════════════════════════════════════════════════════════"
echo "  DIAGNOSTIC AUTH — RESOURCES-ANALYZER PRO"
echo "  $DOMAIN"
echo "══════════════════════════════════════════════════════════"

# ─────────────── 1) Service backend ───────────────
h "1) Service backend systemd"
if systemctl is-active --quiet resources-analyzer; then
  ok "Service resources-analyzer ACTIVE"
else
  ko "Service INACTIVE — c'est probablement la cause"
  echo "    journalctl -u resources-analyzer -n 30 :"
  journalctl -u resources-analyzer -n 30 --no-pager | sed 's/^/      /'
fi

# ─────────────── 2) Port 8003 en écoute ───────────────
h "2) Port $BACKEND_PORT en écoute"
if ss -tlnp 2>/dev/null | grep -q ":$BACKEND_PORT"; then
  ok "Port $BACKEND_PORT en écoute"
else
  ko "Port $BACKEND_PORT NON en écoute — uvicorn n'a pas démarré"
fi

# ─────────────── 3) MongoDB ───────────────
h "3) MongoDB"
if systemctl is-active --quiet mongod; then
  ok "mongod ACTIVE"
  if command -v mongosh &>/dev/null; then
    PING=$(mongosh --quiet --eval 'db.runCommand({ping:1}).ok' 2>/dev/null)
    [[ "$PING" == "1" ]] && ok "MongoDB répond au ping" || ko "MongoDB ne répond pas"
    USERS=$(mongosh --quiet --eval 'db.getSiblingDB("resources_analyzer_prod").users.countDocuments({})' 2>/dev/null)
    echo "    Utilisateurs déjà en base : ${USERS:-0}"
  fi
else
  ko "MongoDB INACTIVE — l'auth ne peut pas fonctionner"
fi

# ─────────────── 4) Fichier .env ───────────────
h "4) Fichier .env backend"
ENV_FILE="$APP_DIR/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  ok ".env présent ($(stat -c '%a' "$ENV_FILE"))"
  for KEY in MONGO_URL DB_NAME JWT_SECRET CORS_ORIGINS EMERGENT_LLM_KEY; do
    if grep -q "^$KEY=" "$ENV_FILE"; then
      VAL=$(grep "^$KEY=" "$ENV_FILE" | cut -d'=' -f2-)
      if [[ -z "$VAL" ]] || [[ "$VAL" =~ VOTRE_ ]]; then
        ko "$KEY vide ou non renseigné !"
      else
        ok "$KEY défini (${VAL:0:30}...)"
      fi
    else
      ko "$KEY MANQUANT dans .env"
    fi
  done
else
  ko ".env MANQUANT"
fi

# ─────────────── 5) systemd charge bien le .env ? ───────────────
h "5) systemd → variables d'environnement effectives"
PID=$(systemctl show -p MainPID --value resources-analyzer 2>/dev/null)
if [[ -n "$PID" ]] && [[ "$PID" != "0" ]]; then
  for KEY in MONGO_URL DB_NAME JWT_SECRET; do
    HAS=$(tr '\0' '\n' < "/proc/$PID/environ" 2>/dev/null | grep "^$KEY=" | head -1)
    if [[ -n "$HAS" ]]; then
      VAL="${HAS#*=}"
      [[ "$VAL" == "fallback" ]] && ko "$KEY chargé MAIS = 'fallback' (le .env n'est PAS lu)" \
        || ok "$KEY chargé par systemd"
    else
      ko "$KEY NON chargé dans le process — EnvironmentFile cassé"
    fi
  done
else
  warn "Process backend non trouvé (PID=$PID)"
fi

# ─────────────── 6) Test API en local (127.0.0.1) ───────────────
h "6) Test API en local (127.0.0.1:$BACKEND_PORT)"
ROOT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  "http://127.0.0.1:$BACKEND_PORT/api/")
[[ "$ROOT" == "200" ]] && ok "GET /api/ → 200" || ko "GET /api/ → $ROOT"

# Test register
RESP=$(curl -s -X POST "http://127.0.0.1:$BACKEND_PORT/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"diag-test-'$(date +%s)'@example.com","password":"diag123456","name":"Diag Test","role":"jurist"}' \
  --max-time 10)
if echo "$RESP" | grep -q "access_token"; then
  ok "POST /api/auth/register en local → 200 ✅ (token reçu)"
elif echo "$RESP" | grep -q "déjà enregistré\|already"; then
  ok "POST /api/auth/register en local → 409 (email existant, c'est OK)"
else
  ko "POST /api/auth/register en local → ÉCHEC"
  echo "    Réponse : $RESP"
fi

# ─────────────── 7) Test API via Nginx (HTTPS public) ───────────────
h "7) Test API via Nginx HTTPS"
HTTPS_ROOT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  "https://$DOMAIN/api/")
if [[ "$HTTPS_ROOT" == "200" ]]; then
  ok "GET https://$DOMAIN/api/ → 200"
elif [[ "$HTTPS_ROOT" == "404" ]]; then
  ko "GET /api/ → 404 — Nginx ne proxy PAS vers le backend"
elif [[ "$HTTPS_ROOT" == "502" ]] || [[ "$HTTPS_ROOT" == "504" ]]; then
  ko "GET /api/ → $HTTPS_ROOT — backend inaccessible depuis Nginx"
else
  warn "GET /api/ → $HTTPS_ROOT"
fi

HTTPS_REG=$(curl -s -X POST "https://$DOMAIN/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"diag-https-'$(date +%s)'@example.com","password":"diag123456","name":"D","role":"jurist"}' \
  -w "\nHTTP_CODE:%{http_code}" --max-time 15)
CODE=$(echo "$HTTPS_REG" | grep "HTTP_CODE:" | cut -d':' -f2)
BODY=$(echo "$HTTPS_REG" | grep -v "HTTP_CODE:")
echo "    Status HTTP: $CODE"
echo "    Body: ${BODY:0:300}"
case "$CODE" in
  200|201) ok "Register HTTPS fonctionne ✅" ;;
  409) ok "409 = email existant (comportement normal)" ;;
  422) ko "422 = validation Pydantic — vérifier le payload côté frontend" ;;
  500) ko "500 — voir journalctl -u resources-analyzer (souvent : MongoDB / bcrypt)" ;;
  502|504) ko "$CODE — backend non joignable depuis Nginx" ;;
  *) ko "Code inattendu : $CODE" ;;
esac

# ─────────────── 8) Frontend build embarque la bonne URL ? ───────────────
h "8) Frontend build → REACT_APP_BACKEND_URL"
INDEX="$APP_DIR/frontend/build/index.html"
if [[ -f "$INDEX" ]]; then
  ok "build/index.html présent"
  # Chercher l'URL dans les bundles JS
  FOUND=$(grep -rh "vitae-publica.tech" "$APP_DIR/frontend/build/static/js/" 2>/dev/null | grep -oE "https://[a-z0-9.-]+vitae-publica\.tech" | sort -u | head -3)
  if echo "$FOUND" | grep -q "$DOMAIN"; then
    ok "Build embarque https://$DOMAIN ✅"
  elif [[ -n "$FOUND" ]]; then
    ko "Build embarque une AUTRE URL : $FOUND"
    echo "    → Le frontend tape sur le mauvais backend !"
    echo "    Fix : éditer $APP_DIR/frontend/.env.production puis"
    echo "          cd $APP_DIR/frontend && sudo -u $APP_USER yarn build"
    echo "          systemctl reload nginx"
  else
    warn "URL backend non trouvée dans le bundle (peut-être ok si build récent)"
  fi
else
  ko "build/index.html ABSENT — le frontend n'est pas buildé"
fi

# ─────────────── 9) CORS ───────────────
h "9) CORS"
CORS_HDR=$(curl -s -I -X OPTIONS "https://$DOMAIN/api/auth/register" \
  -H "Origin: https://$DOMAIN" \
  -H "Access-Control-Request-Method: POST" \
  --max-time 10 | grep -i "access-control-allow-origin" | head -1)
if [[ -n "$CORS_HDR" ]]; then
  ok "CORS header présent : $CORS_HDR"
else
  ko "Pas de header CORS — vérifier CORS_ORIGINS dans .env"
fi

# ─────────────── 10) Logs récents ───────────────
h "10) 20 dernières lignes du backend"
journalctl -u resources-analyzer -n 20 --no-pager | sed 's/^/  /' || true

# ─────────────── 11) Logs Nginx erreurs ───────────────
h "11) Erreurs Nginx récentes"
NGX_ERR="/home/$APP_USER/logs/nginx-error.log"
[[ -f "$NGX_ERR" ]] && tail -10 "$NGX_ERR" | sed 's/^/  /' || warn "Pas de log nginx-error.log"

# ─────────────── 12) Diagnostic final ───────────────
h "DIAGNOSTIC FINAL"
echo
echo "Si tu vois '❌' à l'étape 5 → le .env n'est pas chargé par systemd"
echo "  Fix : vérifier que /etc/systemd/system/resources-analyzer.service contient :"
echo "        EnvironmentFile=$ENV_FILE"
echo "        puis : sudo systemctl daemon-reload && sudo systemctl restart resources-analyzer"
echo
echo "Si '❌' à l'étape 6 (local) → bug Python (souvent bcrypt ou MongoDB)"
echo "  Fix : sudo -u $APP_USER bash -c 'cd $APP_DIR/backend && source venv/bin/activate && pip install -U bcrypt'"
echo "        puis : sudo systemctl restart resources-analyzer"
echo
echo "Si '✅' à l'étape 6 mais '❌' à l'étape 7 → problème Nginx ou CORS"
echo "  Fix : vérifier proxy_pass dans /etc/nginx/sites-available/resources-analyzer"
echo
echo "Si '❌' à l'étape 8 (build embarque mauvaise URL) → rebuild requis"
echo "  Fix : echo 'REACT_APP_BACKEND_URL=https://$DOMAIN' > $APP_DIR/frontend/.env.production"
echo "        cd $APP_DIR/frontend && sudo -u $APP_USER yarn build"
echo "        sudo systemctl reload nginx"
echo
echo "══════════════════════════════════════════════════════════"
