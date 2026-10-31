---
layer: 30-playbooks
doc: add-role-permission
task: "Add a new custom permission, assign permissions to a puesto/equipo, or create a new role"
triggers: ["permission", "role", "puesto", "equipo", "access control", "RBAC", "bundle", "restrict access", "guard", "action_permissions"]
preconditions:
  - 10-architecture/adr/0104-rbac-action-permissions-roles-teams.md
  - 10-architecture/backend-apps.md
  - 40-quality/security.md
validation:
  - python manage.py sync_permissions
  - pytest backend/core/tests/test_rbac_action_coverage.py backend/core/tests/test_permission_references.py backend/core/tests/test_rbac_bundles.py -v
  - pytest backend/[app]/tests -v
  - npx tsc --noEmit
forbidden:
  - Hardcoding user IDs or usernames in permission checks
  - Using is_staff for feature gating (use explicit permissions)
  - Checking permissions in serializers (check in views or services)
  - Using raw verbs outside the closed list (annul/cancel/confirm/post/reverse/pay/dispatch/close/reopen/write_off/purge/approve/export/import)
  - Calling group.permissions.set() directly — always use RoleService.materialize() or set_role_composition()
status: active
owner: core-team
last_review: 2026-10-30
---

# Playbook — Add permission / puesto / equipo

## System overview (RBAC Fase 1)

ERPGrafico uses Django Groups typed as **puestos** (ROLE) or **equipos** (TEAM) via a `GroupProfile` one-to-one model. Permissions are declared on ViewSets via `action_permissions`, grouped into 48 **bundles**, and materialized to the group's `permissions` set by `RoleService`.

**Architecture decision:** [ADR-0104](../10-architecture/adr/0104-rbac-action-permissions-roles-teams.md)

### 11 seeded roles (puestos de sistema)

| Puesto | Bundle base | Sensibles incluidos |
|--------|-------------|---------------------|
| Administrador del sistema | is_system=True (all) | all |
| Gerencia | all.manage | hr.payroll, treasury.payments, accounting.audit |
| Ventas | sales.manage | — |
| Compras | purchasing.manage | — |
| Producción | production.read | — |
| Jefatura de Producción | production.manage | — |
| Bodega y Despacho | warehouse.operate | — |
| Administración y Finanzas | accounting.manage, treasury.manage | treasury.payments, accounting.close |
| Auditor | all.read | accounting.audit |
| RR.HH. | hr.manage | hr.payroll |
| Contabilidad | accounting.manage | accounting.close, accounting.audit |

### Bundle taxonomy

| Kind | Count | Naming | Cumulative? |
|------|-------|--------|-------------|
| Module × read | 13 | `{app}.read` | base |
| Module × operate | 13 | `{app}.operate` | ⊇ read |
| Module × manage | 13 | `{app}.manage` | ⊇ operate |
| Sensitive capability | 9 | `{area}.{capability}` | never in module levels |

Sensitive bundles: `hr.payroll`, `treasury.payments`, `core.security`, `core.users`, `accounting.close`, `accounting.audit`, `sales.pricing`, `purchasing.pricing`, `core.export_any`.

---

## Task A — Add a new custom permission to a ViewSet action

Use this task when you need a new action (e.g. `confirm`, `annul`) on an existing or new ViewSet.

### A1. Register the permission in the app's migration or `AppConfig.ready()`

Custom permissions must be declared as `Meta.permissions` on the model that they guard, **not** via a registry call:

```python
# backend/sales/models.py
class SalesOrder(TimeStampedModel):
    class Meta:
        permissions = [
            ("confirm_salesorder", "Puede confirmar pedidos de venta"),
            ("annul_salesorder", "Puede anular pedidos de venta"),
        ]
```

Then generate and apply the migration:

```bash
python manage.py makemigrations sales
python manage.py migrate
```

**Verb must be from the closed list:** `annul`, `cancel`, `confirm`, `post`, `reverse`, `pay`, `dispatch`, `close`, `reopen`, `write_off`, `purge`, `approve`, `export`, `import`. Any other verb requires updating [ADR-0104](../10-architecture/adr/0104-rbac-action-permissions-roles-teams.md) first.

### A2. Declare `action_permissions` on the ViewSet

```python
# backend/sales/views.py
from core.api.permissions import StandardizedModelPermissions

class SalesOrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, StandardizedModelPermissions]
    queryset = SalesOrder.objects.select_related("customer")

    action_permissions: dict[str, str | tuple[str, ...] | None] = {
        "confirm": "sales.confirm_salesorder",
        "annul":   "sales.annul_salesorder",
        "summary": None,   # authenticated, no extra permission
    }

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        ...
```

`StandardizedModelPermissions` reads `action_permissions` before dispatching. An action not listed and not a standard HTTP verb raises `PermissionDenied`.

### A3. Assign the permission to the right bundles

Open `backend/core/rbac/bundles.py` and add the new codename to the appropriate bundle(s). Follow the rule: operate and manage levels are cumulative, so if the permission belongs to `sales.operate` it will automatically be included in `sales.manage` via `expand()`.

```python
# backend/core/rbac/bundles.py
BUNDLE_DEFINITIONS = {
    ...
    "sales.operate": {
        ...,
        "sales.confirm_salesorder",   # add here
    },
    "sales.manage": {
        ...,
        "sales.annul_salesorder",     # annul is manage-level
    },
}
```

**Sensitive permissions** (payroll amounts, closing accounting periods, payment execution, user administration) must NOT be added to module bundles; they go into sensitive capability bundles only.

### A4. Run the guarantee tests

```bash
pytest backend/core/tests/test_rbac_action_coverage.py \
       backend/core/tests/test_permission_references.py \
       backend/core/tests/test_rbac_bundles.py -v
```

- `test_rbac_action_coverage` — every write action on every ViewSet must appear in `action_permissions`.
- `test_permission_references` — every codename in `action_permissions` must exist in the DB after `sync_permissions`.
- `test_rbac_bundles` — module levels are cumulative; sensitive perms are not in module bundles.

### A5. Materialize permissions

```bash
python manage.py sync_permissions
```

This runs `RoleService.materialize(group)` for every group, rebuilding their effective permission set from bundles + extra − excluded.

### A6. Enforce in the service layer (when needed)

When a permission must also be verified inside a service (e.g. before a cascade side effect):

```python
# backend/sales/services.py
from django.core.exceptions import PermissionDenied

def confirm_order(order, user):
    if not user.has_perm("sales.confirm_salesorder"):
        raise PermissionDenied("Sin permiso para confirmar pedidos.")
    ...
```

### A7. Frontend hook

```ts
// features/sales/hooks/useCanConfirmOrder.ts
import { usePermission } from '@/hooks/usePermission'

export function useCanConfirmOrder() {
  return usePermission('sales.confirm_salesorder')
}
```

```tsx
<PermissionGuard permission="sales.confirm_salesorder">
  <Button onClick={handleConfirm}>Confirmar</Button>
</PermissionGuard>
```

---

## Task B — Adjust the composition of an existing puesto or equipo

Use this task when you need to add or remove permissions for a seeded role, or configure a custom role.

**Never call `group.permissions.set()` directly.** Always go through `RoleService.set_role_composition()`.

```python
from core.rbac.services import RoleService
from django.contrib.auth.models import Group

group = Group.objects.get(name="Ventas")
RoleService.set_role_composition(
    group=group,
    bundles=["sales.manage"],
    extra=["purchasing.view_purchaseorder"],   # one-off extras
    excluded=[],
    actor=request.user,
    request=request,
)
```

`set_role_composition` is atomic, calls `materialize`, and writes an `ActionLog(kind=SECURITY)` entry. It also returns `sod_warnings` if any Separation-of-Duties rule is triggered.

### Via the API (frontend or scripts)

```http
PUT /api/core/groups/{id}/composition/
Authorization: Bearer <token>
Content-Type: application/json

{
  "bundles": ["sales.manage"],
  "extra_permissions": [],
  "excluded_permissions": []
}
```

Requires `auth.change_group`.

---

## Task C — Create a new puesto or equipo

Before creating a new role, confirm that composition of existing bundles on an existing role cannot satisfy the need.

### C1. Create the group + profile

```python
from django.contrib.auth.models import Group
from core.models.rbac import GroupProfile
from core.rbac.services import RoleService

group, _ = Group.objects.get_or_create(name="Coordinador de Proyectos")
profile, _ = GroupProfile.objects.get_or_create(
    group=group,
    defaults={"kind": GroupProfile.Kind.ROLE, "is_system": False},
)
RoleService.set_role_composition(
    group=group,
    bundles=["production.operate", "sales.read"],
    extra=[],
    excluded=[],
    actor=actor,
    request=request,
)
```

For a **team** (equipo), use `kind=GroupProfile.Kind.TEAM`. Teams are typically project-scoped and do not appear in the default role assignment UI.

### C2. File an ADR

New roles that affect the security model require an ADR (per global invariant 12). Reference [ADR-0104](../10-architecture/adr/0104-rbac-action-permissions-roles-teams.md).

---

## Task D — Validate role assignment (no-escalation)

When assigning a user to groups, call `validate_role_assignment` to enforce the no-escalation rule (the assigning user cannot grant a group whose combined permissions exceed their own):

```python
from core.rbac.services import RoleService

warnings = RoleService.validate_role_assignment(
    actor=request.user,
    target=target_user,
    new_groups=selected_groups,
)
# warnings is a list of SoD violations; raise PermissionDenied if escalation
```

Log the change:

```python
RoleService.log_user_roles_change(
    user=target_user,
    before=old_groups,
    after=new_groups,
    actor=request.user,
    request=request,
    sod_warnings=warnings,
)
```

---

## Separation-of-Duties rules

These four combinations trigger warnings (never blocking):

| Rule | Conflicting bundles |
|------|---------------------|
| purchasing_treasury | purchasing.manage + treasury.payments |
| sales_billing | sales.manage + billing.manage |
| payroll_accounting | hr.payroll + accounting.manage |
| hr_treasury | hr.payroll + treasury.payments |

Warnings are persisted in `ActionLog`. They do not prevent the assignment but should be reviewed by a supervisor.

---

## Validation checklist

```bash
# Run the three guarantee tests
pytest backend/core/tests/test_rbac_action_coverage.py \
       backend/core/tests/test_permission_references.py \
       backend/core/tests/test_rbac_bundles.py -v

# Sync DB permissions
python manage.py sync_permissions

# App-specific tests
pytest backend/[app]/tests -v -k "permission"

# Frontend type-check
npx tsc --noEmit
npm run lint
```

## Definition of done

- [ ] Permission declared as `Meta.permissions` on the model and migrated.
- [ ] Verb is from the closed list (or ADR updated to add it).
- [ ] `action_permissions` dict updated on the ViewSet.
- [ ] Codename added to the correct bundle(s) in `core/rbac/bundles.py`.
- [ ] Three guarantee tests pass.
- [ ] `python manage.py sync_permissions` runs without error.
- [ ] Service-layer check added if business logic requires it.
- [ ] Frontend `usePermission` / `<PermissionGuard>` updated.
- [ ] Tests: unauthorized → 403, authorized → 2xx.
- [ ] If new role created: ADR filed.
- [ ] No `is_staff` or hardcoded user ID checks added.
- [ ] No `group.permissions.set()` called directly.
