---
layer: 40-quality
doc: security
status: active
owner: security-team
last_review: 2026-10-30
---

# Security

## Threat model summary

Single-tenant ERP, sensitive data: financial records, customer PII, invoices (fiscal). Primary threats:

1. Credential compromise → account takeover.
2. Privilege escalation → access to other roles' data.
3. Injection (SQL, XSS, SSRF) → data exfil.
4. Insecure direct object reference (IDOR) → read/write other org's data.
5. Supply chain (dependency) compromise.

## Authentication

- JWT access (15 min) + refresh (7 days) via `/api/token/`.
- Refresh rotation on use; old refresh blacklisted.
- Passwords: Django hasher (`PBKDF2` min, `argon2` preferred).
- MFA: TOTP via `django-otp` (required for roles with `core.security` or `treasury.payments` bundles, e.g. *Administrador del sistema*, *Administración y Finanzas*).
- Login throttle: 5 attempts / 15 min per IP + per username.

## Authorization (RBAC Fase 1)

**Architecture decision:** [ADR-0104](../10-architecture/adr/0104-rbac-action-permissions-roles-teams.md) — `action_permissions` dict, bundle taxonomy, GroupProfile.

### Invariants

- Most ViewSets declare `permission_classes = [IsAuthenticated, StandardizedModelPermissions]`; exceptions (public endpoints, custom auth flows) must document the deviation.
- Every non-standard action is listed in the ViewSet's `action_permissions` class-level dict. An unlisted write action raises `PermissionDenied` by construction.
- Object-level permission checks for detail/update/delete (never assume list filter is enough).
- Frontend route guards are UX, never trust — always enforce server-side.

### Model

Django Groups are typed as **puestos** (ROLE) or **equipos** (TEAM) via `GroupProfile` (one-to-one). Effective permissions = `expand(bundles) ∪ extra_permissions − excluded_permissions`.

Permissions are grouped into 48 bundles: 13 apps × 3 module levels (read ⊂ operate ⊂ manage) + 9 sensitive capability bundles. Sensitive bundles (`hr.payroll`, `treasury.payments`, `core.security`, `core.users`, `accounting.close`, `accounting.audit`, `sales.pricing`, `purchasing.pricing`, `core.export_any`) are **never** included in module-level bundles; they must be granted explicitly.

### Custom permission verbs (closed list)

`annul`, `cancel`, `confirm`, `post`, `reverse`, `pay`, `dispatch`, `close`, `reopen`, `write_off`, `purge`, `approve`, `export`, `import`

Any other verb requires an ADR update.

### RoleService rules

- `set_role_composition()` is the only authorized way to change a group's bundle/extra/excluded set — it is atomic, calls `materialize()`, and writes an `ActionLog(kind=SECURITY)` entry.
- `validate_role_assignment()` enforces the no-escalation rule: users cannot grant groups whose combined permissions exceed their own.
- Four Separation-of-Duties rules are evaluated in warn mode: `purchasing_treasury`, `sales_billing`, `payroll_accounting`, `hr_treasury`. Warnings are persisted in the audit log but never block the assignment.

### Guarantee tests

Three CI tests protect the RBAC invariants:

| Test | What it checks |
|------|----------------|
| `test_rbac_action_coverage.py` | Every write action declares a permission in `action_permissions` |
| `test_permission_references.py` | Every `action_permissions` value references an existing DB permission |
| `test_rbac_bundles.py` | Module levels are cumulative; sensitive perms not in module bundles |

### Example — correct ViewSet declaration

```python
from core.api.permissions import StandardizedModelPermissions

class SalesOrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, StandardizedModelPermissions]
    queryset = SalesOrder.objects.select_related("customer")

    action_permissions: dict[str, str | tuple[str, ...] | None] = {
        "confirm": "sales.confirm_salesorder",
        "annul":   "sales.annul_salesorder",
        "summary": None,   # authenticated, no extra permission
    }
```

## Input validation

- **All** input via DRF serializer. No raw `request.data` access in services.
- Frontend Zod validation is UX. Backend validation is authoritative.
- File uploads: size limit, MIME whitelist, content sniff (not only extension).
- Never interpolate user input into SQL; use ORM or parameterized queries.

## Secrets

- `.env` never committed. `.env.example` has keys with dummy values.
- Prod secrets: vault / CI secret store. Never in code, never in logs.
- Django `SECRET_KEY`, JWT signing key: rotated yearly + on compromise.
- Celery task args: no tokens or passwords (broker logs them).

## Transport

- HTTPS only in prod. `SECURE_SSL_REDIRECT = True`, HSTS enabled.
- `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SameSite=Strict`.
- Nginx terminates TLS, forwards with `X-Forwarded-Proto`.

## CORS

- `CORS_ALLOWED_ORIGINS` explicit. No `*` in prod.
- Credentials allowed only for first-party origin.

## CSRF

- JWT stateless → CSRF not applicable to `/api/*` endpoints using bearer auth.
- Django admin uses session auth → CSRF enforced.

## XSS

- Frontend: React escapes by default. Never use `dangerouslySetInnerHTML` with unsanitized content.
- If required (e.g. rendered markdown): run through `DOMPurify`.
- CSP header via Nginx: `default-src 'self'; script-src 'self'; ...`.

## File storage (MinIO)

- Signed URLs for downloads, TTL ≤15 min.
- Upload path: namespaced by organization + resource id.
- Served via dedicated subdomain, cookie-free.

## Dependency security

- **Frontend**: `npm audit` in CI; Renovate bot; pin exact versions.
- **Backend**: `pip-audit` + Dependabot.
- SBOM generated per release.
- Critical vuln → patch within 48h, high within 7 days.

## Logging (security-relevant)

Log these events, always:
- Login success / failure.
- Permission denied (403).
- Token refresh / blacklist.
- Role change on user.
- Fiscal operations: folio issue, period close, invoice cancel.
- Deletion of any record (soft or hard).

Do NOT log: passwords, JWTs, API keys, card numbers, full PII.

## Audit trail

- Every fiscal mutation writes to `workflow.Transition` or equivalent audit model.
- Immutable once written (append-only).
- Retention: ≥7 years for fiscal (jurisdiction-specific).

## Review gates

PR requires security review if it touches:
- Authentication / JWT / permission classes.
- New external integration (outbound HTTP).
- File upload / download.
- New role (puesto/equipo) or permission bundle change in `core/rbac/`.
- Dependencies with known CVEs.

## Incident response

1. Contain (revoke tokens, disable account).
2. Assess scope (audit logs).
3. Notify users per jurisdiction law.
4. Post-mortem within 5 days; ADR if systemic fix required.

## OWASP Top 10 self-check (run before release)

- [ ] A01 Broken access control — object-level perms tested
- [ ] A02 Cryptographic failures — hashes, TLS, secrets OK
- [ ] A03 Injection — ORM / parameterized / Zod
- [ ] A04 Insecure design — threat modeled
- [ ] A05 Misconfiguration — `manage.py check --deploy` clean
- [ ] A06 Vulnerable deps — audit clean
- [ ] A07 Auth failures — rate limit + MFA
- [ ] A08 Integrity — signed releases, SBOM
- [ ] A09 Logging/monitoring — events above covered
- [ ] A10 SSRF — outbound requests whitelisted
