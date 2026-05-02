#!/bin/bash
set -euo pipefail
# ══════════════════════════════════════════════════════════════
# install-ssl.sh — Installation du certificat SSL séparée
# À exécuter APRÈS la propagation DNS
# RESOURCES-ANALYZER PRO
# ══════════════════════════════════════════════════════════════

DOMAIN="resources-analyzer.vitae-publica.tech"
EMAIL="admin@vitae-publica.tech"

G="\e[32m"; R="\e[31m"; Y="\e[33m"; N="\e[0m"
ok()   { echo -e "${G}✅ $1${N}"; }
err()  { echo -e "${R}❌ $1${N}"; }
info() { echo -e "${Y}ℹ️  $1${N}"; }

[[ $EUID -ne 0 ]] && { err "Exécuter en root : sudo bash install-ssl.sh"; exit 1; }

info "Vérification de la propagation DNS…"
if command -v dig &>/dev/null; then
  DNS_IP=$(dig +short "$DOMAIN" | head -1)
  SERVER_IP=$(curl -s --max-time 5 ifconfig.me || hostname -I | awk '{print $1}')
  if [[ -z "$DNS_IP" ]]; then
    err "DNS non résolu pour $DOMAIN — configurer l'entrée A d'abord"
    exit 1
  fi
  if [[ "$DNS_IP" != "$SERVER_IP" ]]; then
    err "DNS pointe vers $DNS_IP au lieu de $SERVER_IP — attendre la propagation"
    read -rp "Forcer quand même ? (y/n) : " C; [[ "$C" != "y" ]] && exit 1
  else
    ok "DNS OK ($DOMAIN → $DNS_IP)"
  fi
fi

info "Vérification du vhost Nginx…"
[[ -L /etc/nginx/sites-enabled/resources-analyzer ]] \
  || { err "Vhost non activé — lancer d'abord install-resources-analyzer.sh"; exit 1; }

info "Demande du certificat Let's Encrypt…"
certbot --nginx \
  -d "$DOMAIN" \
  --non-interactive --agree-tos \
  --email "$EMAIL" \
  --redirect --staple-ocsp

systemctl reload nginx
ok "SSL installé et Nginx rechargé"

info "Vérification du certificat…"
certbot certificates 2>/dev/null | grep -A5 "$DOMAIN" || true

info "Test de renouvellement (dry-run)…"
certbot renew --dry-run 2>&1 | grep -iE "success|error" | head -5
ok "Renouvellement automatique opérationnel"

echo
ok "SSL installé pour https://$DOMAIN"
