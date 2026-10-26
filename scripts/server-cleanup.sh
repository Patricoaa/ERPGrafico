#!/usr/bin/env bash
# server-cleanup.sh — limpieza periódica del dev server (192.168.1.86)
# Documentación: docs/30-playbooks/remote-dev-server.md §8
#
# Uso:  server-cleanup.sh disk   # build cache con tope (5GB) + imágenes dangling
#       server-cleanup.sh ram    # reinicio controlado del frontend si >88% del techo
#
# Instalado en el crontab de `pato` (ver playbook §8). Diseñado para cron:
# silencioso, sin dependencias extra, y NUNCA borra imágenes con tag ni volúmenes.

set -u

MODE="${1:-disk}"
COMPOSE_DIR="${COMPOSE_DIR:-/home/pato/ERPGrafico}"
FRONTEND_CONTAINER="${FRONTEND_CONTAINER:-erpgrafico-frontend-1}"
# 88% de 6 GiB ≈ 5.3 GiB — por encima, el OOM-kill del kernel es inminente:
# mejor un reinicio elegido que un kill a mitad de un compile (remote-dev-server.md §8)
THRESHOLD_PCT="${FRONTEND_MEM_THRESHOLD:-88}"

log() { logger -t erpgrafico-cleanup -- "$*"; }

case "$MODE" in
  disk)
    # Build cache CON tope: conserva 5GB para builds rápidos (sin tope llegó a 16GB)
    docker builder prune -f --keep-storage 5GB >/dev/null 2>&1 || true
    # SOLO capas dangling. Nunca `-a`: no borrar imágenes con tag de otros
    # proyectos (erpnext/odoo/etc. se podaron solo con autorización expresa).
    docker image prune -f >/dev/null 2>&1 || true
    log "disk: build-cache+dangling podados ($(df -h --output=pcent / | tail -1 | tr -d ' ') disco usado)"
    ;;
  ram)
    [ "$(docker inspect -f '{{.State.Running}}' "$FRONTEND_CONTAINER" 2>/dev/null || echo false)" = "true" ] || exit 0
    perc="$(docker stats --no-stream --format '{{.MemPerc}}' "$FRONTEND_CONTAINER" 2>/dev/null | tr -d '% ' | head -1)"
    [ -n "${perc:-}" ] || exit 0
    if awk -v p="$perc" -v t="$THRESHOLD_PCT" 'BEGIN { exit !(p + 0 > t + 0) }'; then
      log "ram: frontend en ${perc}% > ${THRESHOLD_PCT}% del techo → reinicio controlado"
      (cd "$COMPOSE_DIR" && docker compose restart frontend >/dev/null 2>&1) || true
    fi
    ;;
  *)
    echo "Uso: $0 [disk|ram]" >&2
    exit 2
    ;;
esac
