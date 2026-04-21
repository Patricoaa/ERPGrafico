---
layer: 40-quality
doc: ci-cd
status: active
owner: platform-team
last_review: 2026-04-21
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
master merge → auto-deploy staging → smoke tests → manual promote → prod
```

- Tag `v[semver]` on prod release.
- Changelog auto-generated from Conventional Commits.
- Sentry release created + source maps uploaded.
- Grafana annotation.

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
