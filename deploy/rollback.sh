#!/bin/bash
set -euo pipefail
# ══════════════════════════════════════════════════════════════
# rollback.sh — Annulation propre de l'installation
# RESOURCES-ANALYZER PRO
#
# ✅ Ne touche PAS à VITAE-PUBLICA (port 8001, vhost vitae-publica)
# ✅ Ne supprime PAS les données (/home/resources/app/ conservé)
#    sauf si l'utilisateur confirme avec --purge
# ══════════════════════════════════════════════════════════════

APP_USER="resources"
APP_DIR="/home/$APP_USER/app"
DOMAIN="resources-analyzer.vitae-publica.tech"
BACKEND_PORT=8003
SVC="resources-analyzer"
PURGE=0
[[ "${1:-}" == "--purge" ]] && PURGE=1

G="\e[32m"; R="\e[31m"; Y="\e[33m"; N="\e[0m"
ok()   { echo -e "${G}✅ $1${N}"; }
err()  { echo -e "${R}❌ $1${N}"; }
info() { echo -e "${Y}ℹ️  $1${N}"; }

[[ $EUID -ne 0 ]] && { err "Exécuter en root : sudo bash rollback.sh [--purge]"; exit 1; }

echo "══════════════════════════════════════════════════════════"
echo "  ROLLBACK — RESOURCES-ANALYZER PRO"
echo "══════════════════════════════════════════════════════════"
echo
[[ $PURGE -eq 1 ]] && info "Mode --purge : /home/$APP_USER sera SUPPRIMÉ" || info "Mode conservatif : données préservées"
read -rp "Confirmer le rollback ? (y/n) : " CONF
[[ "$CONF" != "y" ]] && { info "Annulé"; exit 0; }

# 1) Arrêter et désactiver le service systemd
info "Arrêt du service systemd…"
systemctl stop  "$SVC" 2>/dev/null || true
systemctl disable "$SVC" 2>/dev/null || true
rm -f /etc/systemd/system/resources-analyzer.service
systemctl daemon-reload
ok "Service $SVC arrêté et supprimé"

# 2) Supprimer le vhost Nginx
info "Suppression du vhost Nginx…"
rm -f /etc/nginx/sites-enabled/resources-analyzer
rm -f /etc/nginx/sites-available/resources-analyzer
if nginx -t 2>&1 | grep -q successful; then
  systemctl reload nginx
  ok "Nginx rechargé (VITAE-PUBLICA préservé)"
else
  err "Config Nginx invalide après rollback — intervention manuelle requise"
  nginx -t
  exit 1
fi

# 3) Supprimer le certificat SSL
info "Suppression du certificat SSL $DOMAIN…"
certbot delete --cert-name "$DOMAIN" --non-interactive 2>/dev/null \
  && ok "Certificat SSL révoqué localement" \
  || info "Pas de certificat à supprimer (ou déjà absent)"

# 4) UFW — retirer les règles port 8003
info "Retrait des règles UFW port $BACKEND_PORT…"
ufw --force delete deny  in from any to any port $BACKEND_PORT 2>/dev/null || true
ufw --force delete allow in on lo to any port $BACKEND_PORT 2>/dev/null || true
ufw reload 2>/dev/null || true
ok "Règles UFW port $BACKEND_PORT supprimées"

# 5) Cron — retirer les entrées
info "Retrait des cron jobs resources-analyzer…"
crontab -l 2>/dev/null | grep -v "resources-analyzer" | grep -v "/home/$APP_USER" | crontab - 2>/dev/null || true
ok "Cron jobs retirés"

# 6) Logrotate
rm -f /etc/logrotate.d/resources-analyzer

# 7) Raccourci global
rm -f /usr/local/bin/resources-analyzer

# 8) Purge des données (optionnel)
if [[ $PURGE -eq 1 ]]; then
  info "Purge des données…"
  # MongoDB : drop de la base
  if command -v mongosh &>/dev/null; then
    mongosh --quiet --eval 'db.getSiblingDB("resources_analyzer_prod").dropDatabase()' 2>/dev/null || true
    ok "Base MongoDB 'resources_analyzer_prod' supprimée"
  fi
  rm -rf "/home/$APP_USER"
  userdel -r "$APP_USER" 2>/dev/null || true
  ok "/home/$APP_USER et user '$APP_USER' supprimés"
else
  info "Données conservées : /home/$APP_USER (utiliser --purge pour supprimer)"
fi

# 9) Vérification de l'intégrité de VITAE-PUBLICA
echo
info "Vérification de l'intégrité de VITAE-PUBLICA…"
ss -tlnp 2>/dev/null | grep -q ":8001" \
  && ok "Port 8001 (VITAE-PUBLICA) toujours actif ✅" \
  || err "Port 8001 non détecté — vérifier manuellement"
VC=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://vitae-publica.tech 2>/dev/null || echo 000)
[[ "$VC" =~ ^(200|301|302)$ ]] \
  && ok "https://vitae-publica.tech → HTTP $VC ✅ intact" \
  || err "https://vitae-publica.tech → HTTP $VC — vérifier"

echo
echo "══════════════════════════════════════════════════════════"
echo "  ✅ ROLLBACK TERMINÉ — RESOURCES-ANALYZER PRO SUPPRIMÉ"
echo "     VITAE-PUBLICA PRÉSERVÉ"
echo "══════════════════════════════════════════════════════════"
