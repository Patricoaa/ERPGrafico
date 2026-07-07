# T04 — Permissions and group

> **Phase**: 1
> **Tiempo estimado**: 30 min
> **Complejidad**: baja

## Precondiciones

- [ ] T01, T02, T03 cerradas.

## Archivos a tocar/crear

- `backend/legacy/migrations/0003_legacy_permissions.py` (nueva).
- `backend/legacy/permissions.py` (completar).
- `backend/core/registry.py` (modificar — T25).
- `backend/contacts/management/commands/setup_demo_data.py` (o equivalente; modificar para asignar grupo `legacy-admins` al superuser).

## 1. Completar `permissions.py`

```python
# backend/legacy/permissions.py
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from rest_framework.permissions import BasePermission


LEGACY_PERMISSIONS = [
    ('view_legacy', 'Ver datos legacy',
     'Permite ver NVs, contactos, vendedores y pagos legacy.'),
    ('pay_pending_legacy', 'Registrar pagos sobre NVs legacy',
     'Crea LegacyPaymentRegistration. Requiere treasury.add_treasurymovement.'),
    ('import_legacy', 'Importar datos legacy',
     'Permite ejecutar el import desde la BD legacy.'),
]


def create_legacy_permissions():
    ct = ContentType.objects.get_for_model('legacy.LegacyImport')
    for codename, name, _ in LEGACY_PERMISSIONS:
        Permission.objects.get_or_create(
            codename=codename,
            content_type=ct,
            defaults={'name': name},
        )


class LegacyPayPendingPermission(BasePermission):
    message = 'Requiere permisos legacy.pay_pending_legacy y treasury.add_treasurymovement.'

    def has_permission(self, request, view):
        u = request.user
        return (u.is_authenticated
                and u.has_perm('legacy.pay_pending_legacy')
                and u.has_perm('treasury.add_treasurymovement'))
```

## 2. Crear `0003_legacy_permissions.py`

```python
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
    operations = [migrations.RunPython(create_legacy_admins_group, remove_legacy_admins_group)]
```

## 3. Modificar `setup_demo_data`

Agregar al final del comando existente:

```python
from django.contrib.auth.models import Group
from legacy.permissions import LEGACY_PERMISSIONS

# Asignar grupo legacy-admins al superuser
group = Group.objects.get(name='legacy-admins')
superuser.groups.add(group)
```

## DoD

- [ ] `python manage.py migrate legacy` aplica 0003 sin error.
- [ ] `Permission.objects.filter(codename__in=['view_legacy','pay_pending_legacy','import_legacy']).count() == 3`.
- [ ] `Group.objects.get(name='legacy-admins').permissions.count() == 3`.
- [ ] `setup_demo_data` asigna el grupo al superuser.

## Comandos de verificación

```bash
python manage.py migrate legacy
python manage.py shell <<'PY'
from django.contrib.auth.models import Group, Permission
print('Permisos legacy:', Permission.objects.filter(codename__startswith='legacy.').count() or
      Permission.objects.filter(codename__in=['view_legacy','pay_pending_legacy','import_legacy']).count())
print('Grupo legacy-admins:', Group.objects.get(name='legacy-admins').permissions.count())
PY
```

## Riesgos

- **Grupo ya existe con otros permisos**: `get_or_create` + `add` (no `set`) preserva los existentes.
- **Permisos duplicados**: `get_or_create` previene duplicados.
- **`setup_demo_data` no se llama en producción**: el grupo se crea igual, pero nadie lo recibe. Documentar en onboarding.
