---
layer: 40-quality
doc: ci-cd
status: active
owner: platform-team
last_review: 2026-10-14
---

# CI / CD

> **Estado actual:** el pipeline corre lint / type-check / test / build / security scan en GitHub Actions.
> **No existe entorno de producción ni staging.** El único entorno activo es el dev server (`pato@192.168.1.86`).

## Pipeline actual (`.github/workflows/pipeline.yml`)

```
[push/PR] → frontend job → backend job → security job
```

Todos los jobs deben pasar para mergear. Los jobs de backend y lint son no-bloqueantes mientras se cierra la deuda técnica existente (ver notas en el YAML).

### Frontend job

```yaml
- npm ci
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
- ruff check .          # ratchet: falla si introduce más de 284 errores existentes
- pytest --cov=.        # non-blocking (124 tests fallando — deuda rastreada)
```

### Security job

```yaml
- bandit -r ./backend -ll
- safety check
```

## Branch strategy

- `master` — protected. CI verde requerido para mergear.
- Feature branches: `feat/…`, `fix/…`, `refactor/…`.
- PR requiere: CI verde, 1 approval (2 si toca `20-contracts/`), sin comentarios sin resolver.

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
