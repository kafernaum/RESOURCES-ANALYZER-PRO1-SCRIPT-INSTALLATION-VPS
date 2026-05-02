#!/bin/bash
set -euo pipefail
# ══════════════════════════════════════════════════════════════
# check-prerequisites.sh — Vérifications avant installation
# RESOURCES-ANALYZER PRO — resources-analyzer.vitae-publica.tech
# Ahmed ELY Mustapha
# ══════════════════════════════════════════════════════════════

DOMAIN="resources-analyzer.vitae-publica.tech"
BACKEND_PORT=8003
EMERGENT_LLM_KEY="${EMERGENT_LLM_KEY:-}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"

G="\e[32m"; R="\e[31m"; Y="\e[33m"; B="\e[34m"; N="\e[0m"
OK=0; WARN=0; KO=0
ok()   { echo -e "${G}  ✅ $1${N}"; OK=$((OK+1)); }
warn() { echo -e "${Y}  ⚠️  $1${N}"; WARN=$((WARN+1)); }
ko()   { echo -e "${R}  ❌ $1${N}"; KO=$((KO+1)); }
h()    { echo -e "\n${B}▸ $1${N}"; }

echo "══════════════════════════════════════════════════════════"
echo "  PRÉ-FLIGHT — RESOURCES-ANALYZER PRO"
echo "══════════════════════════════════════════════════════════"

h "1) OS"
OS_NAME=$(lsb_release -is 2>/dev/null || echo Unknown)
OS_VER=$(lsb_release -rs 2>/dev/null || echo 0)
[[ "$OS_NAME" == "Ubuntu" ]] && ok "OS : $OS_NAME $OS_VER" || warn "OS : $OS_NAME $OS_VER (non Ubuntu)"

h "2) Exécution root"
[[ $EUID -eq 0 ]] && ok "Exécution root OK" || warn "Pas en root — certains checks échoueront"

h "3) Binaires requis"
for B in curl wget git openssl; do
  command -v "$B" &>/dev/null && ok "$B présent" || ko "$B manquant"
done
for OPT in python3 node npm yarn nginx certbot mongosh jq; do
  command -v "$OPT" &>/dev/null && ok "$OPT présent ($($OPT --version 2>&1 | head -1))" \
    || warn "$OPT absent — sera installé par le script principal"
done

h "4) Versions minimales"
if command -v python3 &>/dev/null; then
  PY=$(python3 --version 2>&1 | awk '{print $2}')
  PY_MAJ=$(echo "$PY" | cut -d. -f1); PY_MIN=$(echo "$PY" | cut -d. -f2)
  { [[ $PY_MAJ -ge 3 ]] && [[ $PY_MIN -ge 11 ]]; } \
    && ok "Python $PY ≥ 3.11" || warn "Python $PY < 3.11 (le script installera 3.11)"
fi
if command -v node &>/dev/null; then
  NJ=$(node --version | sed 's/v//' | cut -d. -f1)
  [[ $NJ -ge 20 ]] && ok "Node.js v$NJ ≥ 20" || warn "Node.js v$NJ < 20"
fi

h "5) Ports"
for P in 80 443; do
  ss -tlnp 2>/dev/null | grep -q ":$P " && ok "Port $P en écoute (Nginx)" \
    || warn "Port $P non détecté"
done
for P in 8001 8002; do
  ss -tlnp 2>/dev/null | grep -q ":$P" && ok "Port $P en écoute (intact)" \
    || warn "Port $P non détecté (vérifier manuellement)"
done
if ss -tlnp 2>/dev/null | grep -q ":$BACKEND_PORT"; then
  ko "Port $BACKEND_PORT DÉJÀ UTILISÉ — déplacer BACKEND_PORT ou libérer"
else
  ok "Port $BACKEND_PORT libre"
fi

h "6) Espace disque"
FREE=$(df / | awk 'NR==2 {print int($4/1024/1024)}')
[[ $FREE -ge 5 ]] && ok "Espace disque : ${FREE} Go" || warn "Espace disque : ${FREE} Go (< 5 Go)"

h "7) RAM"
TOTAL_MB=$(free -m | awk '/^Mem:/ {print $2}')
[[ $TOTAL_MB -ge 2048 ]] && ok "RAM : ${TOTAL_MB} Mo" || warn "RAM : ${TOTAL_MB} Mo (< 2 Go)"

h "8) Connectivité internet"
ping -c 1 -W 3 google.com &>/dev/null && ok "Ping google.com OK" || ko "Pas d'internet"
curl -s --max-time 5 https://deb.nodesource.com >/dev/null && ok "NodeSource accessible" \
  || warn "NodeSource inaccessible"
curl -s --max-time 5 https://repo.mongodb.org >/dev/null && ok "MongoDB repo accessible" \
  || warn "MongoDB repo inaccessible"

h "9) Propagation DNS"
if command -v dig &>/dev/null; then
  DNS_IP=$(dig +short "$DOMAIN" | head -1)
  SERVER_IP=$(curl -s --max-time 5 ifconfig.me || hostname -I | awk '{print $1}')
  if [[ -z "$DNS_IP" ]]; then
    warn "DNS non résolu pour $DOMAIN — configurer avant Certbot"
  elif [[ "$DNS_IP" == "$SERVER_IP" ]]; then
    ok "DNS $DOMAIN → $DNS_IP (= IP serveur)"
  else
    warn "DNS $DOMAIN → $DNS_IP (IP serveur = $SERVER_IP) : propagation en cours ?"
  fi
else
  warn "dig absent — installer dnsutils pour tester DNS"
fi

h "10) Emergent LLM Key"
if [[ -z "$EMERGENT_LLM_KEY" ]]; then
  warn "EMERGENT_LLM_KEY non définie (export avant install ou éditer .env)"
else
  ok "EMERGENT_LLM_KEY définie (${EMERGENT_LLM_KEY:0:8}…)"
fi

h "11) OpenAI (optionnel)"
if [[ -n "$OPENAI_API_KEY" ]]; then
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models)
  [[ "$CODE" == "200" ]] && ok "OpenAI API key valide" || warn "OpenAI API key HTTP $CODE"
else
  warn "OPENAI_API_KEY non définie (optionnel si Emergent key suffit)"
fi

h "12) VITAE-PUBLICA santé"
if systemctl is-active --quiet nginx 2>/dev/null; then
  ok "Nginx actif"
else
  ko "Nginx inactif — VITAE-PUBLICA peut être HS"
fi
C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://vitae-publica.tech 2>/dev/null || echo 000)
[[ "$C" =~ ^(200|301|302)$ ]] && ok "https://vitae-publica.tech → HTTP $C" \
  || warn "https://vitae-publica.tech → HTTP $C"

echo
echo "══════════════════════════════════════════════════════════"
printf "  Résultat : ${G}%s OK${N}   ${Y}%s WARN${N}   ${R}%s KO${N}\n" "$OK" "$WARN" "$KO"
echo "══════════════════════════════════════════════════════════"
[[ $KO -gt 0 ]] && { echo "Corrigez les ❌ avant de lancer l'installation."; exit 1; }
echo "Vous pouvez lancer : sudo bash install-resources-analyzer.sh"
exit 0
