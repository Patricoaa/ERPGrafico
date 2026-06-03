# T37 — Smoke scripts

> **Phase**: 8
> **Tiempo estimado**: 30 min
> **Complejidad**: baja

## Precondiciones

- [ ] Phases 1–7 cerradas.

## Archivos a crear

- `scripts/smoke_legacy_import.sh` (ejecutable).
- `scripts/smoke_legacy_api.sh` (ejecutable).

## 1. `smoke_legacy_import.sh`

Ver `08-testing-and-validation.md` §3.1 para el código completo.

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "==> 1. contacts"
python manage.py import_legacy_dump --stage=contacts --dsn="$LEGACY_DSN" 2>&1 | tee /tmp/smoke-contacts.log
ACTUAL=$(python manage.py shell -c "from contacts.models import Contact; print(Contact.objects.count())")
[[ "$ACTUAL" == "2843" ]] || { echo "FAIL: contacts $ACTUAL != 2843"; exit 1; }

# ... resto (vendors, orders, payments, idempotencia) ...
```

## 2. `smoke_legacy_api.sh`

Ver `08-testing-and-validation.md` §3.2.

## Permisos

```bash
chmod +x scripts/smoke_legacy_import.sh
chmod +x scripts/smoke_legacy_api.sh
```

## DoD

- [ ] Ambos scripts existen y son ejecutables.
- [ ] `bash scripts/smoke_legacy_import.sh` ejecuta los 4 stages + idempotencia y termina con `OK: smoke import completo`.
- [ ] `bash scripts/smoke_legacy_api.sh` ejecuta 5 curls y termina con `OK: smoke API completo`.

## Comandos de verificación

```bash
chmod +x scripts/smoke_legacy_*.sh
bash scripts/smoke_legacy_import.sh
bash scripts/smoke_legacy_api.sh
```

## Riesgos

- **`jq` no instalado**: el script de API usa `jq`; verificar que está en el CI.
- **Token de admin**: el script asume `Token.objects.get(user__username='admin')` existe. Si no, fallback con `create_user` o usar `setup_demo_data` antes.
- **Server no corriendo**: el script de API asume `http://localhost:8100` está vivo. Documentar.
