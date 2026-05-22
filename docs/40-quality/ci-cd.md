---
layer: 40-quality
doc: ci-cd
status: active
owner: platform-team
last_review: 2026-05-21
---

# CI / CD

## Pipeline stages

```
[push] → lint → type-check → test → build → security scan → deploy(staging) → smoke → [manual] deploy(prod)
```

Every stage is a hard gate. No merge if any stage red.

## CI per PR

### Frontend job

```yaml
- npm ci
- npm run lint
- npx tsc --noEmit
- npm run test -- --coverage
- npm run build
- lighthouse-ci  # against built artifact
- npm audit --audit-level=high
```

### Backend job

```yaml
- pip install -r requirements.txt
- python manage.py check --deploy
- python manage.py makemigrations --dry-run --check
- ruff check .
- mypy apps
- pytest --cov=apps --cov-fail-under=80
- pip-audit
```

### Contract sync job
- Generate OpenAPI via `spectacular`.
- Validate frontend Zod schemas parse example payloads.
- Fails if drift detected.

### Security job
- Secret scan (`gitleaks`).
- SAST (`bandit` python, `semgrep`).
- SBOM generation (`syft`).

## Branch strategy

- `master` — protected, deploy-to-staging on merge.
- Feature branches: `feat/…`, `fix/…`, `refactor/…`.
- PR requires: green CI, 1 approval (2 if touches `20-contracts/`), no unresolved comments.

## Release flow

```
master merge → smoke tests (local + pre-deploy) → manual prod deploy → smoke tests (post-deploy)
```

- Tag `v[semver]` on prod release.
- Changelog auto-generated from Conventional Commits (ver [versioning-policy.md](../90-governance/versioning-policy.md)).
- Sentry release created + source maps uploaded (sustituye annotations de Grafana — no hay Grafana en stack PYME, ver [observability.md](observability.md)).

## Smoke tests

Bash mínimo que se corre **antes** de tagear y **después** de levantar contenedores en prod. Valida que los endpoints críticos respondan con auth real, no solo `/healthz`.

Vive en `scripts/smoke.sh` (a crear) y se invoca:

```bash
SMOKE_USER=smoke SMOKE_PASS=xxx ./scripts/smoke.sh https://erp.tudominio.local
```

Esqueleto canónico:

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${1:?usage: smoke.sh <base-url>}"
USER="${SMOKE_USER:?env SMOKE_USER required}"
PASS="${SMOKE_PASS:?env SMOKE_PASS required}"

step() { printf '\n→ %s\n' "$*"; }

step "healthz"
curl -fsS "$BASE/api/healthz/" | grep -q '"status":"ok"'

step "auth"
TOKEN=$(curl -fsS -X POST "$BASE/api/token/" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" | jq -r .access)
[ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]

# Endpoints críticos: lectura barata, valida queryset + permisos.
for path in \
  "/api/sales/orders/?page_size=1" \
  "/api/purchasing/orders/?page_size=1" \
  "/api/billing/invoices/?page_size=1" \
  "/api/treasury/movements/?page_size=1" \
  "/api/accounting/entries/?page_size=1"; do
  step "GET $path"
  curl -fsS "$BASE$path" -H "Authorization: Bearer $TOKEN" \
    | jq -e 'has("results") or has("count")' > /dev/null
done

step "smoke OK"
```

**Reglas:**
- Cualquier endpoint cuyo fallo dejaría al usuario "sin trabajar" debe estar en `smoke.sh`. Agregar uno es 2 líneas.
- El usuario `smoke` es un User real con rol `read-only`, sembrado por migración o `setup_demo_data`.
- Si `smoke.sh` falla post-deploy: rollback inmediato (ver §Rollback). No debugging en caliente.

## Rollback

- Backend: `docker compose pull && docker compose up -d` with previous image tag.
- Frontend: Vercel / Nginx swap to previous build.
- DB: forward-only migrations preferred. Reverse migration only when data-safe; otherwise roll forward with fix.

## Secrets in CI

- GitHub Actions secrets for tokens.
- Never echoed, never in logs (`::add-mask::` on generated).
- Short-lived OIDC tokens preferred over long-lived API keys.

## Artifacts retention

| Artifact | Retention |
|----------|-----------|
| Build images | 90 days |
| Test reports | 30 days |
| Coverage reports | 30 days |
| Sentry releases | Indefinite |
| SBOM | Per-release, indefinite |

## Environments

| Env | Branch | Auto-deploy | Data |
|-----|--------|-------------|------|
| preview | any PR | yes | synthetic |
| staging | master | yes | anonymized prod snapshot |
| prod | tag `v*` | manual gate | real |

## Definition of "green"

- All stages pass.
- Coverage ≥ threshold per [testing.md](testing.md).
- No new high/critical vulns.
- No performance regression >10%.
- Contract diff clean OR ADR linked.
