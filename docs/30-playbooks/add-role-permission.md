---
layer: 30-playbooks
doc: add-role-permission
task: "Add a new custom permission or assign permissions to a role"
triggers: ["permission", "role", "access control", "RBAC", "PermissionRegistry", "restrict access", "guard"]
preconditions:
  - 10-architecture/backend-apps.md
  - 40-quality/security.md
validation:
  - python manage.py sync_permissions
  - pytest backend/[app]/tests -v
  - npx tsc --noEmit
forbidden:
  - Hardcoding user IDs or usernames in permission checks
  - Using is_staff for feature gating (use explicit permissions)
  - Adding permissions directly in Django admin (use PermissionRegistry)
  - Checking permissions in serializers (check in views or services)
status: active
owner: core-team
last_review: 2026-04-22
---

# Playbook — Add role / permission

## System overview

ERPGrafico uses Django Groups as roles. Four standard roles:

| Role | Constant | Access |
|------|----------|--------|
| Administrator | `Roles.ADMIN` | All permissions (auto) |
| Manager/Accountant | `Roles.MANAGER` | Configured per need |
| Operator | `Roles.OPERATOR` | Operational permissions |
| Read only | `Roles.READ_ONLY` | All `view_*` permissions (auto) |

Permissions are registered via `PermissionRegistry` in each app's `AppConfig.ready()` and synced to DB with `python manage.py sync_permissions`.

Frontend: `usePermission(codename)` hook + `<PermissionGuard>` component.

---

## Pre-flight checklist

- [ ] Confirmed the permission does not already exist (`python manage.py shell` → `Permission.objects.filter(codename__contains='keyword')`).
- [ ] Decided which role(s) should have this permission.
- [ ] If adding a new role: confirmed it cannot be handled by adjusting existing role permissions.

---

## Steps

### 1. Register permission in AppConfig

Add to the app that owns the guarded resource:

```python
# backend/[app]/apps.py
from django.apps import AppConfig

class MyAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'my_app'

    def ready(self):
        try:
            from core.permissions import PermissionRegistry
            PermissionRegistry.register('my_app', [
                # (codename, human-readable name)
                ('approve_large_orders', 'Can approve orders above credit limit'),
                ('export_report', 'Can export financial reports'),
            ])
        except ImportError:
            pass
```

Naming convention: `{verb}_{noun}` in snake_case. Verbs: `view`, `add`, `change`, `delete` (Django defaults) + custom verbs (`approve`, `export`, `override`, `confirm`, `close`).

### 2. Assign permission to role(s) in sync_permissions command

```python
# backend/core/management/commands/sync_permissions.py
# In the OPERATOR section, add the codename:

operator_codenames = [
    # ... existing ...
    'my_app.approve_large_orders',   # include app prefix when filtering
]
```

Or for MANAGER role, add the assignment block after existing role assignments:

```python
manager_group = Group.objects.get(name=Roles.MANAGER)
manager_codenames = [
    'my_app.export_report',
]
manager_perms = Permission.objects.filter(codename__in=manager_codenames)
manager_group.permissions.add(*manager_perms)
```

### 3. Sync to database

```bash
python manage.py sync_permissions
```

Verify in shell:

```python
python manage.py shell
>>> from django.contrib.auth.models import Permission
>>> Permission.objects.filter(codename='approve_large_orders').exists()
True
```

### 4. Enforce permission in backend view

**Pattern A — ViewSet with standard model permissions** (covers add/change/delete/view automatically):

```python
from core.api.permissions import StandardizedModelPermissions

class MyModelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, StandardizedModelPermissions]
    queryset = MyModel.objects.all()
```

**Pattern B — Custom action permission** (for non-CRUD actions):

```python
from core.api.permissions import HasActionPermission

class MyModelViewSet(viewsets.ModelViewSet):
    ...

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        self.required_permission = 'my_app.approve_large_orders'
        if not HasActionPermission().has_permission(request, self):
            return Response({'error': 'Permission denied'}, status=403)

        # ... action logic
```

**Pattern C — Service layer check** (when permission must be verified inside a service):

```python
# backend/[app]/services.py
def approve_order(order, user):
    if not user.has_perm('my_app.approve_large_orders'):
        raise PermissionDenied("Insufficient permissions to approve this order.")
    # ... business logic
```

### 5. Frontend — check permission in hook

```ts
// features/[name]/hooks/useCanApprove.ts
import { usePermission } from '@/hooks/usePermission'

export function useCanApprove() {
  return usePermission('my_app.approve_large_orders')
}
```

### 6. Frontend — guard UI elements

```tsx
import { PermissionGuard } from '@/components/auth/PermissionGuard'

// Hide button entirely when no permission
<PermissionGuard permission="my_app.approve_large_orders">
  <Button onClick={handleApprove}>Aprobar</Button>
</PermissionGuard>

// Show disabled fallback
<PermissionGuard
  permission="my_app.approve_large_orders"
  fallback={<Button disabled>Aprobar</Button>}
>
  <Button onClick={handleApprove}>Aprobar</Button>
</PermissionGuard>
```

For conditional rendering without the wrapper component:

```tsx
const canApprove = usePermission('my_app.approve_large_orders')

{canApprove && <Button onClick={handleApprove}>Aprobar</Button>}
```

---

## Adding a new role (rare)

Only if existing four roles are insufficient.

1. Add constant to `Roles` class in `backend/core/permissions.py`:

```python
class Roles:
    ADMIN = 'ADMIN'
    MANAGER = 'MANAGER'
    OPERATOR = 'OPERATOR'
    READ_ONLY = 'READ_ONLY'
    AUDITOR = 'AUDITOR'  # new

    @classmethod
    def get_choices(cls):
        return [
            ...
            (cls.AUDITOR, 'Auditor'),
        ]
```

2. Add group creation + permission assignment in `sync_permissions.py`.

3. Write ADR — new roles affect security model and require review.

---

## Validation

```bash
# Sync and verify
python manage.py sync_permissions

# Tests
pytest backend/[app]/tests -v -k "permission"

# Frontend
npx tsc --noEmit
npm run lint
```

Manual: log in as OPERATOR user, verify guarded action is blocked; log in as user with permission, verify it works.

## Definition of done

- [ ] Permission registered in `AppConfig.ready()` via `PermissionRegistry`.
- [ ] Permission assigned to correct role(s) in `sync_permissions` command.
- [ ] `python manage.py sync_permissions` runs without error.
- [ ] Backend view enforces permission (StandardizedModelPermissions or HasActionPermission or service check).
- [ ] Frontend UI element guarded via `<PermissionGuard>` or `usePermission()`.
- [ ] Tests: unauthorized → 403, authorized → 2xx.
- [ ] No `is_staff` or hardcoded user ID checks added.
- [ ] If new role created: ADR filed.
