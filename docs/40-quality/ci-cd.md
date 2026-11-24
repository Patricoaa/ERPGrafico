---
layer: 40-quality
doc: ci-cd
status: active
owner: platform-team
last_review: 2026-11-24
---

# CI / CD

> **Estado actual (2026-11-24):** `CI Pipeline` corre en cada PR y en cada push a `master`, y **todo su resultado bloquea**. `master` está protegida por un ruleset: solo se cambia por PR con los checks **Frontend** y **Backend** en verde.
> **No existe entorno de producción ni staging.** El único entorno activo es el dev server (`pato@192.168.1.86`).

## Pipeline (`.github/workflows/pipeline.yml`)

```
[push/PR] → Frontend · Backend · Security Scan   (jobs en paralelo)
```

### Frontend job (Node 24)

```yaml
- npm ci --legacy-peer-deps
- npm audit --omit=dev --audit-level=high   # hard gate: dependencias de runtime high/critical
- npm run lint -- --quiet   # hard gate: solo errores; los warnings los controlan los ratchets
- npm run type-check        # hard gate
- npx playwright install --with-deps chromium   # stories de Storybook
- npm run test -- --run --coverage   # hard gate (NODE_OPTIONS=--max-old-space-size=4096)
- npm run build             # hard gate
```

### Backend job (Python 3.12, Postgres 15, Redis 7)

```yaml
- pip install -r requirements.txt        # versiones fijadas (==)
- pip install ruff==0.17.6 … pip-audit   # ruff fijado: el ratchet cuenta hallazgos
- pip-audit                # hard gate: CVE en el entorno instalado (transitivas incluidas)
- ruff check . --select F821   # hard gate: nombres indefinidos
- ruff check .             # ratchet: falla si supera 338; bajar el número al corregirlos
- python manage.py check
- python manage.py makemigrations --check --dry-run
- pytest -m ci_gate        # hard gate: invariantes y conteo de queries (ADR-0118)
- pytest --cov=.           # hard gate: suite completa (ver testing.md, cuarentena)
```

### Security job

```yaml
- bandit -r ./backend -ll   -x ./backend/tmp   # informa medium/low
- bandit -r ./backend -lll  -x ./backend/tmp   # hard gate: severidad high
```

Un falso positivo se anota en la línea con `# nosec <ID>: <motivo>`; nunca se silencia el paso.

## Dependencias

- **Versiones fijadas.** `backend/requirements.txt` usa `==` para toda dependencia directa; `frontend/package-lock.json` fija el árbol de npm. `overrides` en `package.json` fuerza versiones parcheadas de transitivas (`rollup`, `handlebars`) mientras su paquete padre no las adopte.
- **Dependabot** (`.github/dependabot.yml`): semanal para npm y pip (menores y parches agrupados en un PR; mayores de a una), mensual para GitHub Actions e imágenes Docker. Sus PR pasan por el mismo CI.
- **Deuda conocida:** `@sentry/nextjs` 8 → 11 (tres mayores) queda pendiente; sus alertas restantes son moderadas.

## Branch strategy

- `master` — ruleset «master: PR + CI verde»: PR obligatorio (0 aprobaciones), checks **Frontend** y **Backend**, sin force-push ni borrado. **Sin bypass para administradores.**
- Feature branches: `feat/…`, `fix/…`, `refactor/…`, `chore/…`, `ci/…`.
- Un commit de un PR **no** debe contener el literal de salto de CI de GitHub en su mensaje: GitHub no correría los checks y el PR no se podría mergear.

## Release flow

`release.yml` corre en cada push a `master` y hace el bump con `standard-version` (commit `chore(release): vX.Y.Z` marcado para saltar CI + tag). Empuja con la deploy key `release-bot` (secret `RELEASE_DEPLOY_KEY`), la única exención del ruleset. Ver [versioning-policy.md](../90-governance/versioning-policy.md).

## Secrets en CI

- GitHub Actions secrets para tokens (`RELEASE_DEPLOY_KEY`).
- Nunca en logs (`::add-mask::` en generados).
- Preferir OIDC de corta vida sobre API keys permanentes.

## Environments

| Env | Branch | Auto-deploy | Data | Estado |
|-----|--------|-------------|------|--------|
| dev server | n/a (Mutagen sync desde local) | n/a | synthetic (`setup_demo_data`) | **activo** |
| staging | — | — | — | **no existe** |
| prod | — | — | — | **no existe** |

Tras desplegar código que toque el registro de búsqueda, correr `python manage.py rebuild_search_index --clear`.
