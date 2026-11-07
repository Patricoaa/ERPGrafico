---
layer: 40-quality
doc: ci-cd
status: active
owner: platform-team
last_review: 2026-11-06
---

# CI / CD

> **Estado actual:** `CI Pipeline` está **deshabilitado manualmente** desde abril de 2026 y `master` **no tiene protección de rama**. Hoy nada bloquea un merge. Este documento describe lo que hace el pipeline cuando está activo; ver [Activar el gate](#activar-el-gate).
> **No existe entorno de producción ni staging.** El único entorno activo es el dev server (`pato@192.168.1.86`).

## Pipeline actual (`.github/workflows/pipeline.yml`)

```
[push/PR] → frontend job → backend job → security job
```

Bloquean el job de backend `manage.py check`, las migraciones, el ratchet de Ruff y el gate `ci_gate`. El resto de la suite y varios pasos de lint y seguridad no bloquean.

### Frontend job

```yaml
- npm ci --legacy-peer-deps
- npm run lint          # non-blocking (FSD boundary errors en progreso)
- npm run type-check    # hard gate
- npm run test -- --run --coverage
- npm run build         # hard gate
```

### Backend job

```yaml
- pip install -r requirements.txt
- python manage.py check
- python manage.py makemigrations --check --dry-run
- ruff check . --select F821   # hard gate: nombres indefinidos
- ruff check .          # ratchet: falla si supera 342 errores; bajar el número al corregirlos
- pytest -m ci_gate     # hard gate: invariantes y conteo de queries (ADR-0118)
- pytest --cov=.        # non-blocking; fallos conocidos en testing.md
```

### Security job

```yaml
- bandit -r ./backend -ll
- safety check
```

## Branch strategy

- `master` — sin protección de rama hoy. Objetivo: CI verde requerido para mergear.
- Feature branches: `feat/…`, `fix/…`, `refactor/…`.
- Objetivo para los PR: CI verde, 1 approval (2 si toca `20-contracts/`), sin comentarios sin resolver.

## Activar el gate

Son dos pasos manuales. Antes de exigir el check, confirmar que `Automated Versioning` puede seguir empujando a `master`, porque publica ahí sus commits de versión.

1. Reactivar el pipeline: `gh workflow enable pipeline.yml`.
2. Exigir el check de backend en `master`, desde *Settings → Branches* o con la API de protección de ramas.

Mientras tanto, el gate se puede correr a mano:

```bash
cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest -m ci_gate -q
```

## Release flow

El versionado es manual: `chore(release): X.Y.Z` con bump en `package.json` y tag git. Ver [versioning-policy.md](../90-governance/versioning-policy.md).

## Secrets en CI

- GitHub Actions secrets para tokens.
- Nunca en logs (`::add-mask::` en generados).
- Preferir OIDC de corta vida sobre API keys permanentes.

## Environments

| Env | Branch | Auto-deploy | Data | Estado |
|-----|--------|-------------|------|--------|
| dev server | n/a (Mutagen sync desde local) | n/a | synthetic (`setup_demo_data`) | **activo** |
| staging | — | — | — | **no existe** |
| prod | — | — | — | **no existe** |
