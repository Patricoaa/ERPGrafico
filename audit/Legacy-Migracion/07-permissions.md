# 07 — Permissions (3 permisos + seed)

> 3 permisos nuevos en `legacy` app. Asignación a grupo de admin en data migration 0003.

## 1. Permisos

| Codename | Nombre humano | Descripción |
|---|---|---|
| `legacy.view_legacy` | "Ver datos legacy" | Permite ver NVs, contactos, vendedores y pagos legacy. |
| `legacy.pay_pending_legacy` | "Registrar pagos sobre NVs legacy" | Permite crear `LegacyPaymentRegistration` (pago nuevo sobre NV legacy). Requiere además `treasury.add_treasurymovement`. |
| `legacy.import_legacy` | "Importar datos legacy" | Permite ejecutar el import (management command o endpoint). |

**Por qué solo 3**:
- `view` cubre lectura de todos los modelos legacy.
- `pay_pending_legacy` es la acción de pago nuevo (compuesta con `treasury.add_treasurymovement`).
- `import_legacy` cubre la operación de import (que es destructiva, requiere un permiso separado).

**Lo que NO hay**:
- No hay `legacy.add_*`, `legacy.change_*`, `legacy.delete_*` (Django no los genera por default en Meta; los permisos custom se definen explícitamente).

## 2. Definición en `apps.py` y `models.py`

### 2.1 `LegacyConfig` (apps.py)

```python
from django.apps import AppConfig

class LegacyConfig(AppConfig):
    name = 'legacy'
    default_auto_field = 'django.db.models.BigAutoField'
    verbose_name = 'Datos legacy (migración)'

    def ready(self):
        from . import permissions  # noqa
```

### 2.2 `permissions.py`

```python
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType

LEGACY_PERMISSIONS = [
    ('view_legacy', 'Ver datos legacy', 'Permite ver NVs, contactos, vendedores y pagos legacy.'),
    ('pay_pending_legacy', 'Registrar pagos sobre NVs legacy', 'Crea LegacyPaymentRegistration. Requiere treasury.add_treasurymovement.'),
    ('import_legacy', 'Importar datos legacy', 'Permite ejecutar el import desde la BD legacy.'),
]

def create_legacy_permissions():
    """Crea los 3 permisos custom. Llamar en data migration 0003."""
    for codename, name, description in LEGACY_PERMISSIONS:
        Permission.objects.get_or_create(
            codename=codename,
            content_type=ContentType.objects.get_for_model('legacy.LegacyImport'),
            defaults={'name': name},
        )
```

**ContentType**: se usa `legacy.LegacyImport` como ancla (cualquiera de los 6 modelos sirve; elegimos `LegacyImport` por ser el "entry point").

## 3. Asignación a grupos

### 3.1 Grupo `legacy-admins` (data migration 0003)

```python
# backend/legacy/migrations/0003_legacy_permissions.py
from django.db import migrations
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType

def create_legacy_admins_group(apps, schema_editor):
    group, _ = Group.objects.get_or_create(name='legacy-admins')
    ct = ContentType.objects.get_for_model(apps.get_model('legacy', 'LegacyImport'))
    for codename in ('view_legacy', 'pay_pending_legacy', 'import_legacy'):
        perm = Permission.objects.get(codename=codename, content_type=ct)
        group.permissions.add(perm)

def remove_legacy_admins_group(apps, schema_editor):
    Group.objects.filter(name='legacy-admins').delete()

class Migration(migrations.Migration):
    dependencies = [('legacy', '0002_legacy_seed')]
    operations = [
        migrations.RunPython(create_legacy_admins_group, remove_legacy_admins_group),
    ]
```

### 3.2 Quién recibe el grupo

- En `setup_demo_data` (management command existente), se asigna el grupo `legacy-admins` al usuario `admin` (superuser).
- En producción, **NO** se asigna automáticamente; un superuser debe hacerlo manualmente.

## 4. Verificación de permisos compuestos

### 4.1 Backend: `LegacyPayPendingPermission`

```python
from rest_framework.permissions import BasePermission

class LegacyPayPendingPermission(BasePermission):
    """Requiere legacy.pay_pending_legacy Y treasury.add_treasurymovement."""
    message = 'Requiere permisos legacy.pay_pending_legacy y treasury.add_treasurymovement.'

    def has_permission(self, request, view):
        u = request.user
        return (u.is_authenticated
                and u.has_perm('legacy.pay_pending_legacy')
                and u.has_perm('treasury.add_treasurymovement'))
```

### 4.2 Frontend: hook de permiso

```typescript
// frontend/hooks/useLegacyPermissions.ts
export function useLegacyPermissions() {
  const { data: user } = useCurrentUser();
  return {
    canView: user?.permissions?.includes('legacy.view_legacy') ?? false,
    canPay: (user?.permissions?.includes('legacy.pay_pending_legacy') ?? false)
         && (user?.permissions?.includes('treasury.add_treasurymovement') ?? false),
    canImport: user?.permissions?.includes('legacy.import_legacy') ?? false,
  };
}
```

`RegisterPaymentDrawer` consume `canPay` para mostrar u ocultar el botón "Registrar pago" en items legacy.

## 5. Resumen de visibilidad por rol

| Rol | Ve NV legacy | Ve contacto legacy | Ve vendor legacy | Puede pagar NV legacy | Puede importar |
|---|---|---|---|---|---|
| Vendedor (sin permisos legacy) | NO | NO | NO | NO | NO |
| Vendedor con `legacy.view_legacy` | SÍ | SÍ | SÍ | NO | NO |
| Vendedor con `legacy.pay_pending_legacy` + treasury | SÍ | SÍ | SÍ | SÍ | NO |
| Admin (con `legacy-admins`) | SÍ | SÍ | SÍ | SÍ | SÍ |
| Superuser | SÍ | SÍ | SÍ | SÍ | SÍ |

## 6. Migración de permisos existentes

- No se modifican permisos de `sales`, `contacts`, `production`, `treasury`, `inventory`.
- El permiso `treasury.add_treasurymovement` ya existe; se REUSA (no se duplica).

## 7. Auditoría

- Toda creación de `LegacyPaymentRegistration` y `LegacyImport` queda registrada con `registered_by`/`started_by` FK al `auth.User` (PROTECT).
- Si se borra un usuario, **NO** se borran sus registros (PROTECT); se debe reasignar manualmente.

## 8. Tests

- `test_view_legacy_required_for_legacy_in_list`: usuario sin permiso no ve NVs legacy.
- `test_pay_requires_both_permissions`: usuario con solo `legacy.pay_pending_legacy` → 403; con ambos → 201.
- `test_import_requires_legacy_import_legacy`: usuario con `legacy.view_legacy` pero sin `import_legacy` → 403 en `POST /api/legacy/imports/commit/`.
- `test_superuser_bypasses_all`: superuser siempre puede.
