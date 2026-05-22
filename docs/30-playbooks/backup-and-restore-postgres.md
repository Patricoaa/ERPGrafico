---
layer: 30-playbooks
doc: backup-and-restore-postgres
task: backup y restore de PostgreSQL en stack PYME
triggers: [backup, restore, pg_dump, pg_restore, postgres backup, disaster, recuperar base, R2 backup]
preconditions: [system-diagram]
validation: [restore mensual a base temporal, verify row counts]
forbidden: [confiar en el backup sin probarlo, comprimir sin verificar, dejar credenciales del bucket en el repo]
status: active
owner: core-team
last_review: 2026-05-21
---

# Backup y Restore — PostgreSQL (stack PYME)

Estrategia mínima y barata para no perder los libros fiscales. Asume topología single-node ([system-diagram.md](../10-architecture/system-diagram.md)) y presupuesto ~$0. Cloudflare R2 ya está en uso para media — lo reusamos para backups.

## La estrategia en una línea

`pg_dump` diario via Celery beat → comprime → sube a R2 → retiene 30 días locales + 365 días en R2 → restore probado el primer lunes de cada mes.

## Inventario

| Componente | Estado actual |
|------------|---------------|
| Stack | Postgres 16-alpine en docker compose (`db` service) |
| Volumen | `postgres_data:/var/lib/postgresql/data` (named volume Docker) |
| DB | `${POSTGRES_DB:-erpgrafico}` |
| Credenciales | `.env.dev` → `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| Storage de backup | Cloudflare R2 bucket dedicado (`erpgrafico-backups`) |
| Local staging | `/mnt/data/backups/postgres/` en el host del home-server |

---

## Step 1 — Crear el bucket R2

Una sola vez. Dashboard de Cloudflare → R2 → Create bucket → `erpgrafico-backups`.

Crear API token con scope `Object Read & Write` solo para ese bucket. Guardar `ACCESS_KEY_ID` + `SECRET_ACCESS_KEY` + `ENDPOINT` en `.env.dev`:

```bash
# .env.dev
R2_BACKUPS_BUCKET=erpgrafico-backups
R2_BACKUPS_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BACKUPS_ACCESS_KEY=...
R2_BACKUPS_SECRET_KEY=...
```

> **Nunca** committear estas credenciales. Agregarlas a `.env.dev` que está en `.gitignore`.

## Step 2 — Script de backup

Crear `scripts/backup_postgres.sh`:

```bash
#!/usr/bin/env bash
# Genera dump comprimido de Postgres y lo sube a R2. Idempotente por timestamp.
set -euo pipefail

# Cargar env del proyecto
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
set -a; source "$PROJECT_ROOT/.env.dev"; set +a

TS=$(date -u +%Y%m%dT%H%M%SZ)
LOCAL_DIR="/mnt/data/backups/postgres"
LOCAL_FILE="$LOCAL_DIR/erpgrafico-$TS.sql.zst"
R2_KEY="daily/erpgrafico-$TS.sql.zst"

mkdir -p "$LOCAL_DIR"

echo "→ Dumping Postgres ($POSTGRES_DB) at $TS"
docker compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=plain --no-owner --no-acl \
  | zstd -19 -T0 > "$LOCAL_FILE"

SIZE=$(stat -c%s "$LOCAL_FILE")
echo "→ Dump size: $(numfmt --to=iec $SIZE)"
[ "$SIZE" -gt 1000 ] || { echo "✗ Dump sospechosamente chico (<1 KB), abortando"; exit 1; }

echo "→ Uploading to R2 → $R2_KEY"
aws --endpoint-url "$R2_BACKUPS_ENDPOINT" \
    s3 cp "$LOCAL_FILE" "s3://$R2_BACKUPS_BUCKET/$R2_KEY" \
    --no-progress

echo "→ Cleaning local backups >30 días"
find "$LOCAL_DIR" -name 'erpgrafico-*.sql.zst' -mtime +30 -delete

echo "→ Pinging healthchecks.io"
curl -fsS "$HEALTHCHECKS_BACKUP_PING_URL" > /dev/null || echo "  (ping falló, no fatal)"

echo "✓ Backup OK"
```

Hacerlo ejecutable: `chmod +x scripts/backup_postgres.sh`.

**Dependencias del host:**
- `aws` CLI (`pip install awscli` o `apt install awscli`) — funciona con R2 vía `--endpoint-url`.
- `zstd` (`apt install zstd`).
- `curl`.

**Por qué `zstd -19`:** comprime ~5× mejor que gzip a costo de CPU. En un dump de 500 MB en disco bajo, vale la pena. Si la CPU es escasa, bajar a `-3`.

**Por qué `--format=plain`:** texto. Es portable, diffeable, restaurable con `psql` plano (más simple que `pg_restore` con custom format). Para DBs >5 GB, considerar `--format=custom` que permite paralelismo en restore.

## Step 3 — Cron diario

En el host del home-server (no en el contenedor):

```cron
# /etc/cron.d/erpgrafico-backup
# Diario a las 03:30 hora local
30 3 * * *  pato  cd /home/pato/ERPGrafico && PROJECT_ROOT=/home/pato/ERPGrafico ./scripts/backup_postgres.sh >> /var/log/erpgrafico-backup.log 2>&1
```

`pato` = usuario del host con permisos sobre `docker compose` y `/mnt/data`.

**Healthchecks.io setup** (1 vez): crear check "Postgres backup" con schedule `daily 03:30` + grace 30 min. Copiar la URL del ping a `HEALTHCHECKS_BACKUP_PING_URL` en `.env.dev`. Si el cron no pingea en su ventana, llega email automático.

## Step 4 — Retención en R2

R2 no tiene lifecycle policies en free tier; el cleanup se hace desde el script. Agregar al final de `backup_postgres.sh`:

```bash
echo "→ Purging R2 daily >365 días"
CUTOFF=$(date -u -d '365 days ago' +%Y%m%dT%H%M%SZ)
aws --endpoint-url "$R2_BACKUPS_ENDPOINT" \
    s3 ls "s3://$R2_BACKUPS_BUCKET/daily/" \
    | awk '{print $4}' \
    | while read key; do
        key_ts=$(echo "$key" | grep -oE '[0-9]{8}T[0-9]{6}Z' || true)
        [ -z "$key_ts" ] && continue
        if [[ "$key_ts" < "$CUTOFF" ]]; then
          echo "  - eliminando $key"
          aws --endpoint-url "$R2_BACKUPS_ENDPOINT" s3 rm "s3://$R2_BACKUPS_BUCKET/daily/$key" --no-progress
        fi
      done
```

**Política de retención:**
- Local: 30 días (capacidad típica del disco PYME).
- R2 daily: 365 días.
- R2 `monthly/`: primer dump de cada mes se copia a `monthly/` y se retiene 7 años (compliance fiscal chilena). Script aparte mensual.

Cron mensual (día 2 a las 04:00):

```cron
0 4 2 * * pato cd /home/pato/ERPGrafico && ./scripts/promote_monthly_backup.sh >> /var/log/erpgrafico-backup.log 2>&1
```

`promote_monthly_backup.sh` busca el último daily del mes recién pasado y hace `aws s3 cp` a `monthly/YYYY-MM/`. Sin cleanup en `monthly/` — son 7 años (~84 archivos).

## Step 5 — Restore (procedimiento manual)

**Cuándo:** test mensual programado **o** disaster recovery real.

### A. Test mensual a base temporal

Primer lunes de cada mes. Restaura el backup más reciente a una DB temporal (`erpgrafico_restore_test`), verifica row counts contra prod, dropea.

```bash
#!/usr/bin/env bash
# scripts/restore_test.sh — restore a DB temporal para verificar backup
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
set -a; source "$PROJECT_ROOT/.env.dev"; set +a

TEST_DB="erpgrafico_restore_test"
LATEST=$(ls -t /mnt/data/backups/postgres/erpgrafico-*.sql.zst | head -1)

echo "→ Restoring $LATEST → $TEST_DB"
docker compose exec -T db psql -U "$POSTGRES_USER" -c "DROP DATABASE IF EXISTS $TEST_DB;"
docker compose exec -T db psql -U "$POSTGRES_USER" -c "CREATE DATABASE $TEST_DB;"
zstd -dc "$LATEST" | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$TEST_DB"

echo "→ Verificando row counts vs prod"
for table in sales_saleorder billing_invoice accounting_journalentry treasury_treasurymovement; do
  PROD=$(docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT COUNT(*) FROM $table")
  REST=$(docker compose exec -T db psql -U "$POSTGRES_USER" -d "$TEST_DB"     -tAc "SELECT COUNT(*) FROM $table")
  DIFF=$((PROD - REST))
  printf "  %-40s prod=%s  restore=%s  diff=%s\n" "$table" "$PROD" "$REST" "$DIFF"
  if [ "$DIFF" -gt 100 ]; then
    echo "  ⚠ Diferencia >100 filas — backup atrasado o roto"
  fi
done

echo "→ Cleanup"
docker compose exec -T db psql -U "$POSTGRES_USER" -c "DROP DATABASE $TEST_DB;"
echo "✓ Restore test OK"
```

**Cron mensual:**

```cron
0 6 1-7 * 1 pato cd /home/pato/ERPGrafico && ./scripts/restore_test.sh >> /var/log/erpgrafico-restore-test.log 2>&1
```

(Primer lunes del mes a las 06:00 — `1-7` día del mes + `1` lunes = solo el primer lunes.)

### B. Restore real (disaster recovery)

Procedimiento documentado en [disaster-recovery-pyme.md](disaster-recovery-pyme.md). Resumen:

```bash
# 1. Detener la app
docker compose stop backend celery_worker celery_beat frontend nginx

# 2. Recrear DB limpia (cuidado: destruye prod)
docker compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS erpgrafico;"
docker compose exec -T db psql -U postgres -c "CREATE DATABASE erpgrafico OWNER postgres;"

# 3. Restaurar
zstd -dc /mnt/data/backups/postgres/erpgrafico-XXXXXXXX.sql.zst \
  | docker compose exec -T db psql -U postgres -d erpgrafico

# 4. Levantar app
docker compose up -d

# 5. Verificar
./scripts/smoke.sh https://erp.tudominio.local
```

Si el backup local no existe (disco perdido), descargar de R2 antes del paso 3:

```bash
aws --endpoint-url "$R2_BACKUPS_ENDPOINT" \
    s3 cp "s3://$R2_BACKUPS_BUCKET/daily/erpgrafico-LATEST.sql.zst" \
    /tmp/restore.sql.zst
```

## Validation

Mensual (automático):
- `restore_test.sh` corre, log en `/var/log/erpgrafico-restore-test.log`.
- Si diff >100 filas en cualquier tabla crítica → email del log + investigar.

Trimestral (manual):
- Descargar **manualmente** un backup de R2 desde una máquina distinta al home-server.
- Restaurar a una VM/contenedor descartable.
- Confirmar que la app levanta y `smoke.sh` pasa.

## Common pitfalls

- **Backup que nunca se restauró ≠ backup.** Sin el test mensual, no sabés si tu pg_dump genera basura. Es el error más común.
- **Olvidar `--no-owner --no-acl`** → restore en otro Postgres falla por usuarios inexistentes.
- **Dump del volumen Docker raw** (`docker cp` o `tar` del volumen) → no es atómico, Postgres puede estar mid-write. **Siempre** `pg_dump`.
- **Credenciales R2 en `.env` committeado** → leak total. `.env.dev` debe estar en `.gitignore`.
- **Sin Healthchecks.io ping** → el día que el cron falle (cambio de password, disco lleno, docker caído), te enterás semanas después.
- **Comprimir con `gzip` por defecto** → es razonable, pero `zstd` ahorra ~50% en R2 y CPU está disponible de noche. Solo trade-off real es tener `zstd` instalado.
- **`pg_dump --format=custom` sin probar restore** → restore requiere `pg_restore` (no `psql`); si te olvidás, en emergencia perdés tiempo. Por eso default a `plain` para PYME.

## Definition of done

- [ ] Bucket R2 + credenciales en `.env.dev` (en .gitignore).
- [ ] `scripts/backup_postgres.sh` ejecutable, prueba manual exitosa.
- [ ] Cron diario instalado, log rotation configurado (`/etc/logrotate.d/erpgrafico`).
- [ ] Healthchecks.io configurado y pingeando.
- [ ] `scripts/restore_test.sh` ejecutable, primer test mensual ejecutado a mano y pasó.
- [ ] Cron mensual de restore test instalado.
- [ ] Cron mensual `promote_monthly_backup.sh` instalado.
- [ ] Procedimiento de restore real revisado por el usuario (entiende cada paso).
- [ ] Verificación trimestral: backup descargado de R2 desde otra máquina, restaurado, app levanta.

## Referencias

- Topología: [system-diagram.md](../10-architecture/system-diagram.md)
- Runbook de incidente: [disaster-recovery-pyme.md](disaster-recovery-pyme.md)
- Smoke tests post-restore: [ci-cd.md#smoke-tests](../40-quality/ci-cd.md#smoke-tests)
- Observability del cron: [observability.md#alerts](../40-quality/observability.md#alerts)
