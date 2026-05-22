---
layer: 30-playbooks
doc: disaster-recovery-pyme
task: runbook de incidente — recuperación del ERP
triggers: [disaster, recovery, no-levanta, caído, restore, hardware roto, server muerto]
preconditions: [backup-and-restore-postgres]
validation: [smoke.sh pasa post-recovery]
forbidden: [debugging en caliente sin runbook, restore sin verificar backup, push de fixes a master sin smoke]
status: active
owner: core-team
last_review: 2026-05-21
---

# Disaster Recovery — Runbook PYME (1 página)

Qué hacer cuando "el ERP no anda". No es un manual exhaustivo: es la secuencia que cualquier persona con SSH y este doc puede ejecutar en <4 horas.

**RTO objetivo (no SLA contractual):** restaurar servicio en <4h.
**RPO objetivo:** perder ≤24h de transacciones (backup diario).

> Si el último backup tiene >24h, el dato perdido es lo que se cargó entre el último backup y la caída. Documentar en el cierre del incidente.

## Triage — 5 minutos

```bash
# 1. ¿El host responde?
ssh pato@<host>  # si NO → §A. Host muerto

# 2. ¿Los contenedores están up?
docker compose ps   # si todos los servicios "Up (healthy)" → §B. App caída sin contenedor caído

# 3. ¿La DB responde?
docker compose exec db pg_isready -U postgres  # si NO → §C. DB caída

# 4. ¿Disco lleno?
df -h | grep -E '8[5-9]|9[0-9]|100'  # si HAY líneas → §D. Disco lleno

# 5. ¿Backend devuelve algo?
curl -fsS http://localhost:8100/api/healthz/   # si NO → §E. Backend roto

# 6. ¿Nginx?
curl -fsS http://localhost/   # si NO → §F. Nginx/SSL
```

---

## §A. Host muerto

**Síntoma:** SSH no responde, ping falla.

1. Verificar físicamente: encendido, network LED, monitor. Reiniciar si está apagado/colgado.
2. Si arranca pero servicios no levantan: continuar con §B.
3. Si NO arranca (hardware roto):
   - **Mover el SSD** a otra máquina con Proxmox/Ubuntu compatible.
   - Si SSD también muerto:
     - Conseguir hardware sustituto (PC vieja de respaldo, VPS temporal cloud).
     - Instalar Ubuntu Server + Docker + Docker Compose.
     - `git clone` del repo del proyecto.
     - Copiar `.env.dev` desde la copia segura (Bitwarden / Keepass — **no del repo**).
     - `docker compose up -d` levanta stack vacío.
     - Restaurar DB desde R2: ver §C-restore más abajo.
     - Apuntar DNS al nuevo host (si cambió IP).
4. Notificar a usuarios por canal pre-acordado (WhatsApp, email manual) — "ERP en recuperación, ETA Xh".

## §B. App caída, contenedores aparentemente OK

```bash
# Revisar logs de los últimos 100 entries por servicio
docker compose logs --tail=100 backend
docker compose logs --tail=100 celery_worker
docker compose logs --tail=100 frontend

# Reiniciar el servicio sospechoso (no toda la stack)
docker compose restart backend
sleep 5
curl -fsS http://localhost:8100/api/healthz/

# Si sigue: bajar todo, revisar imágenes, levantar
docker compose down
docker compose up -d
```

Si error es por **migration pendiente** tras un deploy roto:
```bash
docker compose exec backend python manage.py migrate --check
# Si falla → hay migration sin aplicar
docker compose exec backend python manage.py migrate
# Si la migration es la causa del problema → rollback al tag anterior:
git checkout v<previous>
docker compose pull && docker compose up -d
```

## §C. DB caída

```bash
docker compose logs --tail=200 db
```

Causas comunes:
| Síntoma en logs | Causa | Fix |
|----|----|----|
| `out of disk space` | Disco lleno | Ir a §D primero, luego volver |
| `could not start due to corrupted WAL` | Corrupción de WAL (corte de luz) | **Restore desde backup** (procedimiento abajo) |
| `permission denied on data directory` | Permisos del volumen | `docker compose down && docker volume inspect postgres_data` |
| Container exitea inmediatamente | Versión incompatible tras upgrade | Verificar `image: postgres:16-alpine` no cambió |

### C-restore — restore desde el último backup

```bash
# 1. Bajar la app (no la DB todavía)
docker compose stop backend celery_worker celery_beat frontend nginx

# 2. Verificar que tenés backup reciente
ls -lah /mnt/data/backups/postgres/ | tail -5
#   Si está vacío: descargar de R2
#   aws --endpoint-url $R2_BACKUPS_ENDPOINT s3 ls s3://$R2_BACKUPS_BUCKET/daily/ | tail -5
#   aws --endpoint-url $R2_BACKUPS_ENDPOINT s3 cp s3://.../daily/<latest>.sql.zst /mnt/data/backups/postgres/

# 3. Drop + restore (DESTRUYE PROD — punto de no retorno)
LATEST=$(ls -t /mnt/data/backups/postgres/erpgrafico-*.sql.zst | head -1)
echo "Voy a restaurar: $LATEST"
read -p "Confirmar (escribí RESTORE): " confirm
[ "$confirm" = "RESTORE" ] || exit 1

docker compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS erpgrafico;"
docker compose exec -T db psql -U postgres -c "CREATE DATABASE erpgrafico OWNER postgres;"
zstd -dc "$LATEST" | docker compose exec -T db psql -U postgres -d erpgrafico

# 4. Levantar app
docker compose up -d

# 5. Smoke test
./scripts/smoke.sh https://erp.tudominio.local
```

Si el smoke falla: revisar `docker compose logs backend` y `frontend`. Habitualmente migrations o env vars desactualizados.

## §D. Disco lleno

```bash
df -h
du -sh /mnt/data/* | sort -h
du -sh /var/lib/docker/* | sort -h
```

Causas comunes y fix:
| Síntoma | Fix |
|---------|-----|
| `/var/lib/docker/containers/<id>/<id>-json.log` enorme | Configurar `log-opts` en `/etc/docker/daemon.json` con `max-size`/`max-file`, luego `docker compose restart` |
| `/mnt/data/backups/` lleno | El cleanup del backup script no corre; ejecutar manualmente `find /mnt/data/backups -mtime +30 -delete` |
| Volúmenes Docker huérfanos | `docker volume prune` (cuidado: no eliminar `postgres_data` ni `redis_data`) |
| Imágenes viejas | `docker image prune -a` (cuidado: post-recovery hay que `docker compose pull` de nuevo) |

## §E. Backend devuelve 5xx

```bash
docker compose logs --tail=100 backend
# Buscar: tracebacks, OperationalError (DB), MemoryError, AuthFailed
```

| Síntoma | Fix |
|---------|-----|
| `OperationalError: connection to server failed` | §C — la DB está caída o satura conexiones. Si saturación: subir `CONN_MAX_AGE`, revisar `max_connections` de Postgres |
| `MemoryError` | El gunicorn pidió más RAM de la disponible. Bajar workers (`WORKERS=2` en lugar de 4), o el container exceedeó su límite — revisar `docker stats` |
| `Sentry` no llega | Revisar `SENTRY_DSN` en env; sin Sentry seguís ciego, prioridad |

## §F. Nginx / SSL

```bash
docker compose logs --tail=50 nginx
# Buscar: certificate expired, upstream timeout, no resolver
```

| Síntoma | Fix |
|---------|-----|
| `certificate has expired` | Renovar con certbot: `docker compose exec nginx certbot renew`, luego `docker compose exec nginx nginx -s reload` |
| `connect() failed (111: Connection refused)` upstream backend | Backend caído — ir a §E o §B |
| `no resolver defined` | Olvido de config; agregar `resolver 8.8.8.8` en nginx.conf |

---

## Pre-vuelo (qué tener SIEMPRE listo)

| Recurso | Dónde está | Verificar trimestralmente |
|---------|-----------|----------------------------|
| Credenciales R2 backups | Bitwarden / Keepass | Que el token siga válido |
| `.env.dev` de prod | Bitwarden / Keepass (cifrado) | Idem |
| SSH key del host | Bitwarden + máquina secundaria | Que se puede entrar desde 2 máquinas distintas |
| Acceso a Cloudflare DNS | Cuenta Cloudflare con MFA | Que el MFA funciona |
| Último backup downloadeable de R2 | aws s3 ls — verificar TS reciente | Trimestral test de descarga |
| Hardware sustituto identificado | Nota física + foto | Encendido funciona |
| Lista de contactos a notificar | Documento aparte | Números/emails al día |

## Post-incidente

1. Documentar en `docs/99-walkthroughs/incident-YYYY-MM-DD.md`:
   - Síntoma inicial.
   - Pasos ejecutados (con timestamps).
   - Causa raíz identificada.
   - Datos perdidos (si los hay).
   - Acciones de prevención para el futuro.
2. Si la causa raíz es prevenible (e.g. cron de backup roto hace 3 días → ahora se sabe que falló silencioso → agregar segundo canal de alerta):
   - Crear PR con el fix.
3. Actualizar este runbook si el incidente reveló un caso no cubierto.

## Lo que NO está cubierto deliberadamente

- **Failover automático.** Es PYME single-node — la recuperación es manual y eso está aceptado.
- **HA / réplicas calientes.** Ver [system-diagram.md](../10-architecture/system-diagram.md#deployment-units).
- **Point-in-time recovery (PITR).** WAL archiving no está configurado — el último backup diario es lo que hay. Activar PITR cuando el volumen lo justifique.
- **DR de Redis.** Es cache + broker; reconstruir desde cero está OK. Cualquier task Celery en vuelo al momento del crash se pierde (idempotencia de las tareas críticas mitiga esto — ver [idempotency.md](../20-contracts/idempotency.md)).
- **DR de MinIO local.** Media crítica vive en Cloudflare R2 (managed HA). MinIO local guarda derivados (exports temporales, miniaturas) — re-generables.

## Referencias

- Backup/restore detallado: [backup-and-restore-postgres.md](backup-and-restore-postgres.md)
- Smoke tests: [../40-quality/ci-cd.md#smoke-tests](../40-quality/ci-cd.md#smoke-tests)
- Topología: [../10-architecture/system-diagram.md](../10-architecture/system-diagram.md)
- Walkthroughs históricos de incidentes: [../99-walkthroughs/](../99-walkthroughs/)
