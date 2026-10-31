---
id: 0104
title: RBAC — action_permissions dict, bundle taxonomy, GroupProfile (puestos y equipos)
status: Proposed
date: 2026-10-30
author: core-team
---

# 0104 — RBAC — action_permissions dict, bundle taxonomy, GroupProfile (puestos y equipos)

**Related:** ADR-0008 (DRF ViewSets + service layer), ADR-0053 (TimeStampedModel + audit), playbook `add-role-permission.md`, contract `security.md § Authorization`.

## Context

ERPGrafico had a flat four-role model (Admin / Manager / Operator / Read-only) hard-coded in `core/roles.py` and assigned in a monolithic `sync_permissions` management command. Two structural problems made it unscalable:

1. **No per-action declaration.** Non-standard ViewSet actions (e.g. `confirm`, `annul`, `post`) had no machine-readable permission requirement. `StandardizedModelPermissions` fell back to a no-queryset branch that allowed unauthenticated access for custom actions, creating a latent privilege-escalation surface.
2. **No composable role model.** Adding a "Sales operator who can confirm but not annul" required either a new hardcoded role or granting excess permissions. There was no concept of additive bundles or per-user exceptions.

The Fase 1 backend foundation closes both gaps:

- Every ViewSet custom action now declares its required permission explicitly via `action_permissions`.
- Permissions are grouped into 48 pre-defined bundles (39 module-level + 9 sensitive capabilities).
- Django Groups become typed (ROLE or TEAM) via a `GroupProfile` one-to-one model.
- A `RoleService` materializes effective permissions atomically and audits every change.

## Decision

### 1. `action_permissions` dict on ViewSets

Every DRF ViewSet that exposes non-standard actions declares a class-level dict:

```python
action_permissions: dict[str, str | tuple[str, ...] | None] = {
    "confirm":  "sales.confirm_salesorder",
    "annul":    "sales.annul_salesorder",
    "export":   ("sales.export_salesorder", "core.export_any"),  # OR-tuple
    "summary":  None,   # public within authenticated session
}
```

`StandardizedModelPermissions` reads this dict **before** the "no queryset" branch. Any action not declared and not a standard HTTP verb raises `PermissionDenied`. The guarantee is enforced by `core/tests/test_rbac_action_coverage.py` (every write action must declare a permission) and `core/tests/test_permission_references.py` (declared codenames must exist in the DB after `sync_permissions`).

### 2. Closed verb list for custom permissions

Custom action codenames use only verbs from this closed list:

`annul`, `cancel`, `confirm`, `post`, `reverse`, `pay`, `dispatch`, `close`, `reopen`, `write_off`, `purge`, `approve`, `export`, `import`

No ad-hoc verbs. New verbs require updating this list (and this ADR).

### 3. Bundle taxonomy (`core.rbac.bundles`)

Permissions are grouped into 48 bundles:

| Kind | Count | Naming | Access model |
|------|-------|--------|--------------|
| Module × read | 13 | `{app}.read` | view_* only |
| Module × operate | 13 | `{app}.operate` | view + add + change + standard verbs |
| Module × manage | 13 | `{app}.manage` | all non-sensitive perms for the app |
| Sensitive capability | 9 | `{area}.{capability}` | specific high-risk perms, never in module levels |

Module levels are **cumulative**: `read ⊂ operate ⊂ manage`. Sensitive bundles (`hr.payroll`, `hr.salary_advances`, `treasury.payments`, `treasury.credit_cards`, `treasury.bank_loans`, `contacts.profit_distribution`, `core.security`, `tax.declarations`, `accounting.fiscal_year`) are **excluded** from module-level bundles; they must be granted explicitly. This invariant is enforced by `core/tests/test_rbac_bundles.py`.

`expand(bundle_keys) -> set[Permission]` materializes a list of bundle keys to Permission objects.

`permission_catalog() -> set[str]` returns all valid `app_label.codename` strings. `curated_catalog()` hides noise apps (contenttypes, sessions, admin, auth management) for the frontend assignment UI.

### 4. `GroupProfile` model (`core.models.rbac`)

A `OneToOneField` on Django `Group` adds:

| Field | Type | Semantics |
|-------|------|-----------|
| `kind` | enum | `ROLE` (persisted assignment) or `TEAM` (project-scoped) |
| `is_system` | bool | True only for `Administrador del sistema`; protected from deletion/demotion |
| `bundles` | `list[str]` | ordered bundle keys |
| `extra_permissions` | `list[str]` | individual codenames added on top of bundles |
| `excluded_permissions` | `list[str]` | individual codenames subtracted from the expanded set |

Effective permissions = `expand(bundles) ∪ extra_permissions − excluded_permissions`.

### 5. Seeded roles

11 roles are seeded by `core.rbac.seed`:

| Role | Bundles (representative) | Sensitive caps |
|------|--------------------------|----------------|
| Administrador del sistema | all module bundles (is_system = True) | all (core.security, hr.payroll, hr.salary_advances, treasury.payments, treasury.credit_cards, treasury.bank_loans, contacts.profit_distribution, tax.declarations, accounting.fiscal_year) |
| Gerencia | all.read + all.operate + all.manage minus sensitive | tax.declarations, accounting.fiscal_year, contacts.profit_distribution |
| Ventas | sales.read/operate, billing.read/operate, inventory.read, contacts.read | treasury.payments |
| Producción | production.read/operate, inventory.read | workflow.operate |
| Jefatura de Producción | production.read/operate/manage, inventory.read/operate, contacts.read | workflow.manage |
| Bodega y Despacho | inventory.read/operate, sales.read/operate, production.read | — |
| Administración y Finanzas | accounting.read/operate/manage, billing.manage, contacts.read, hr.read | treasury.payments, treasury.bank_loans, tax.declarations |
| Auditor | all *.read bundles | — |
| RRHH | hr.read/operate/manage | hr.payroll, hr.salary_advances |
| Contabilidad | accounting.read/operate/manage | accounting.fiscal_year |
| Tesorero | treasury.read/operate/manage | treasury.payments, treasury.credit_cards, treasury.bank_loans |

### 6. `RoleService` (`core.rbac.services`)

- `materialize(group)` — sets `group.permissions` from the effective set; idempotent.
- `set_role_composition(group, bundles, extra, excluded, actor, request)` — atomic, calls `materialize`, audits the change via `ActionLog(kind=SECURITY)`.
- `validate_role_assignment(actor, target, new_groups)` — enforces no-escalation (users cannot grant groups whose combined permissions exceed their own) and evaluates SoD rules.
- `log_user_roles_change(user, before, after, actor, request, sod_warnings=None)` — writes an immutable `ActionLog(kind=SECURITY)` entry.

### 7. Separation-of-Duties rules (`core.rbac.sod`)

Four warn-mode rules (never blocking, always audited):

| Rule key | Conflicting bundles |
|----------|---------------------|
| `purchasing_treasury` | `purchasing.manage` + `treasury.payments` |
| `sales_billing` | `sales.manage` + `billing.manage` |
| `payroll_accounting` | `hr.payroll` + `accounting.manage` |
| `hr_treasury` | `hr.payroll` + `treasury.payments` |

Violations produce a `sod_warnings` list persisted in the audit log. They do not block the assignment.

### 8. API surface

| Method | Endpoint | Permission required |
|--------|----------|---------------------|
| GET | `/api/core/permissions/catalog/` | `auth.view_group` |
| GET | `/api/core/permissions/bundles/` | `auth.view_group` |
| GET | `/api/core/groups/{id}/composition/` | `auth.view_group` |
| PUT | `/api/core/groups/{id}/composition/` | `auth.change_group` |

## Consequences

**Positive:**

- Every API action has a declared, machine-verifiable permission requirement. The latent "no-queryset bypass" is closed by construction.
- Roles are composable: operators can be given a precise subset without creating new hardcoded roles.
- SoD warnings catch dangerous combinations at assignment time and leave an audit trail.
- The three guarantee tests make regressions immediately visible in CI.

**Negative / neutral:**

- `materialize()` must be called whenever a group composition changes. Callers that bypass `RoleService` (e.g. direct `group.permissions.set()`) will silently diverge. The management command `sync_permissions` serves as a reconciliation backstop.
- The closed verb list requires a deliberate ADR update to extend, which adds a small coordination cost.
- 11 seeded roles cover the initial customer scope; additional roles need bundle-composition work, not code.

## Frontend (Fase 2 — 2026-10-31)

### `can()` — única función de verificación de permisos

`AuthContext` exporta una función `can(permission: string): boolean` como único punto de verdad para verificar permisos en el frontend:

```typescript
can = (p) => user.is_superuser || user.permissions.includes(p)
```

`hasPermission` es un alias de `can` (compatibilidad retroactiva). El componente declarativo `<Can permission="…">` envuelve `can()`. `PermissionGuard` es un alias deprecado que delega a `<Can>`.

### `<ModuleGuard>` — protección de rutas por módulo

Cada `layout.tsx` de módulo envuelve su contenido con `<ModuleGuard permission="módulo.view_dashboard_módulo">`. El componente llama a `can(permission)` y redirige a `/403` si falla; muestra `null` mientras `AuthContext` carga para evitar flash del contenido protegido. Módulos con `permission: null` en el registro (actualmente `contacts`) no tienen guard.

El interceptor Axios en `lib/api.ts` escucha respuestas 403 de endpoints de datos (excluye `/auth/` y `/token/`) y despacha el evento `auth:forbidden`; `AuthContext` muestra un toast de error sin hacer logout.

### Editor de composición de roles

`RoleCompositionEditor` consume:
- `GET /api/core/permissions/bundles/` para construir la matriz de casillas.
- `GET /api/core/groups/{id}/composition/` para leer la composición actual.
- `PUT /api/core/groups/{id}/composition/` para guardar cambios.

La matriz presenta bundles regulares en filas y bundles sensibles en una sección separada. La lógica `read ⊂ operate ⊂ manage` se aplica localmente en el cambio de cada checkbox. Las 4 reglas SoD se evalúan localmente y se muestran como alertas no bloqueantes. El actor no puede otorgar bundles cuyos permisos no posee (no-escalation).

El editor se abre desde la vista Ajustes → Usuarios → Puestos con la acción "Composición" (sólo visible para grupos con `kind=ROLE` y actor con `auth.change_group`).

### Resolución de issues deferred de Fase 1

- **I5 — grupos con `kind` en UserSerializer:** `UserSerializer.to_representation()` devuelve `groups` como lista de objetos `{id, name, kind}` en lugar de lista de nombres. `POST/PATCH /users/` sigue aceptando nombres (SlugRelatedField). `POST /groups/` acepta `kind` al crear un grupo.
- **I4 — `sod_warnings` en respuesta de usuario:** `UserViewSet.create` y `update` añaden `sod_warnings` al cuerpo de la respuesta (lista de `{rule, label}`) sin romper el esquema serializer.
- **I6 — protección de módulos sin permiso:** `<ModuleGuard>` cierra la brecha del lado del cliente.

## Alternatives considered

- **Per-action `permission_classes` list** (the classic DRF pattern): verbose, error-prone, and still lacks the machine-readable catalog needed by the frontend assignment UI. Rejected.
- **django-guardian object-level permissions**: overhead not justified for a single-tenant ERP where the access dimension is role, not object. Deferred to a future phase if multi-tenant or row-level isolation is needed.
- **Blocking SoD** (hard prevent conflicting assignment): too restrictive for small teams where the same person legitimately covers multiple functions. Warn-mode with audit trail preferred.

## References

- Playbook: [`docs/30-playbooks/add-role-permission.md`](../../30-playbooks/add-role-permission.md)
- Security contract: [`docs/40-quality/security.md`](../../40-quality/security.md)
- Guarantee tests: `backend/core/tests/test_rbac_action_coverage.py`, `backend/core/tests/test_permission_references.py`, `backend/core/tests/test_rbac_bundles.py`
- Service layer ADR: [ADR-0008](0008-drf-viewsets-service-layer.md)
