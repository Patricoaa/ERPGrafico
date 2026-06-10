# Phase 1 — Foundation

> Cimientos: app `legacy` + 6 modelos + 2 migraciones + 3 permisos. **Sin esto, ninguna otra fase puede ejecutarse.**

## Precondiciones

- [ ] Repo en estado limpio.
- [ ] `backend/` con migraciones al día.
- [ ] `docs/00-context/stack-decisions.md` revisado (stack: Django 5 + DRF + Celery).
- [ ] No hay PRs abiertos tocando `backend/contacts`, `backend/sales`, `backend/production`, `backend/treasury`.

## Tasks

| Task | Título | Salida |
|---|---|---|
| [T01](../tasks/T01-create-legacy-app.md) | Crear app `legacy` | Estructura de carpetas + `apps.py` + `permissions.py` |
| [T02](../tasks/T02-define-models.md) | Definir 6 modelos | `backend/legacy/models.py` con los 6 modelos |
| [T03](../tasks/T03-migrations-0001-0002.md) | Migraciones 0001 y 0002 | `0001_initial.py` (auto) + `0002_legacy_seed.py` (manual) |
| [T04](../tasks/T04-permissions-and-group.md) | Permisos y grupo | `0003_legacy_permissions.py` + seed en `setup_demo_data` |

## Entregables

- `backend/legacy/` con estructura completa (§0 de `03-backend-models.md`).
- `backend/legacy/models.py` con los 6 modelos.
- `backend/legacy/migrations/0001_initial.py` (auto-generado).
- `backend/legacy/migrations/0002_legacy_seed.py` (UoM + Warehouse + `LEGACY-OT-PRODUCT`).
- `backend/legacy/migrations/0003_legacy_permissions.py` (3 permisos + grupo `legacy-admins`).
- `backend/legacy/permissions.py` con los 3 codenames.
- `backend/core/registry.py` actualizado con entry `legacy.legacyimport`.

## DoD de la fase

- [ ] `python manage.py makemigrations legacy` no genera nada nuevo (modelos estables).
- [ ] `python manage.py migrate` aplica `legacy.0001`, `legacy.0002`, `legacy.0003` sin error.
- [ ] `python manage.py shell -c "from inventory.models import Product; print(Product.objects.get(code='LEGACY-OT-PRODUCT'))"` retorna el producto.
- [ ] `python manage.py shell -c "from django.contrib.auth.models import Permission; print(Permission.objects.filter(codename__in=['view_legacy','pay_pending_legacy','import_legacy']).count())"` retorna `3`.
- [ ] `python manage.py shell -c "from django.contrib.auth.models import Group; print(Group.objects.get(name='legacy-admins').permissions.count())"` retorna `3`.
- [ ] `pytest backend/legacy/tests/test_models.py -v` pasa con al menos 5 tests verdes.
- [ ] `backend/legacy/admin.py` registra **solo** `LegacyImport`.
- [ ] No se introdujeron `any` en TypeScript (no aplica en backend).
- [ ] No se violan los 12 global invariants (revisar `GOVERNANCE.md`).

## Decisiones tomadas en esta fase

1. **`BigAutoField` PK** en todos los modelos legacy (consistencia con `SaleOrder`).
2. **`UoM` y `Warehouse` con `code` fijo** (`'UN'` y `'LEGACY-DEFAULT'`) y validación ruidosa si existen con otro nombre.
3. **`LEGACY-OT-PRODUCT`** es `type=SERVICE` con `uom=UN` y `default_warehouse=LEGACY-DEFAULT`.
4. **Grupo `legacy-admins`** es el único que recibe los 3 permisos automáticamente.
5. **`registry` solo registra `LegacyImport`** — los otros 5 modelos no son entry points.

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| UoM `UN` ya existe con otro nombre | Migración falla ruidosamente con instrucción clara |
| Warehouse `LEGACY-DEFAULT` ya existe | Misma estrategia |
| `LEGACY-OT-PRODUCT` ya existe como NO-service | Falla ruidosamente |
| Grupo `legacy-admins` ya existe con otros permisos | `get_or_create` + `add` (no `set`), preserva permisos existentes |

## Comandos de verificación rápida

```bash
# 1. Migrar
python manage.py migrate legacy

# 2. Verificar
python manage.py shell <<'PY'
from inventory.models import Product, UoM, Warehouse
from legacy.models import LegacyImport
from django.contrib.auth.models import Group, Permission

print('UoM UN:', UoM.objects.filter(code='UN').exists())
print('Warehouse LEGACY-DEFAULT:', Warehouse.objects.filter(code='LEGACY-DEFAULT').exists())
print('LEGACY-OT-PRODUCT:', Product.objects.filter(code='LEGACY-OT-PRODUCT').exists())
print('legacy-admins:', Group.objects.filter(name='legacy-admins').exists())
print('Permisos legacy:', Permission.objects.filter(codename__in=['view_legacy','pay_pending_legacy','import_legacy']).count())
PY

# 3. Tests
pytest backend/legacy/tests/test_models.py -v

# 4. Lint
ruff check backend/legacy/
```

## Salida para la Phase 2

Al cerrar Phase 1, ya se puede:
- Importar contactos legacy (Phase 2 T05).
- Importar vendedores legacy (Phase 2 T06).
- Resolver duplicados de contactos (Phase 2 T07).

**No** se puede aún:
- Importar NVs (faltan contactos y vendedores).
- Importar pagos (faltan NVs).
- Consumir la API unificada (faltan serializers).
