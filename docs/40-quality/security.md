---
layer: 40-quality
doc: security
status: active
owner: security-team
last_review: 2026-04-21
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
- MFA: TOTP via `django-otp` (required for role `admin`, `finance`).
- Login throttle: 5 attempts / 15 min per IP + per username.

## Authorization

- Every viewset declares `permission_classes` explicitly.
- Object-level permission checks for detail/update/delete (never assume list filter is enough).
- Role matrix in `core/roles.py`; documented.
- Frontend route guards are UX, never trust — always enforce server-side.

```python
# ✅ correct — object-level check
class InvoiceViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated, IsOwnerOrAccountingTeam]

    def get_queryset(self):
        return Invoice.objects.filter(organization=self.request.user.organization)
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
- New role or permission in `core/roles.py`.
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
