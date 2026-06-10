# Phase 3 — Sale Notes

> Importación de las 7.960 NVs legacy (excluyendo las 20 anuladas). Decisión manual vs auto WorkOrder. Mapeo de vendor interno/externo.

## Precondiciones

- [ ] Phase 1 cerrada.
- [ ] Phase 2 cerrada (`ContactLegacyOrigin` y `LegacyVendor` poblados).
- [ ] `LEGACY-OT-PRODUCT` existe (Phase 1 T03).

## Tasks

| Task | Título | Salida |
|---|---|---|
| [T08](../tasks/T08-order-importer.md) | Importer de NVs | `backend/legacy/importers/orders.py` |
| [T09](../tasks/T09-manual-vs-auto-wo.md) | Decisión manual vs auto | Configuración `LEGACY_WO_MODE=manual` (siempre manual en este alcance) |
| [T10](../tasks/T10-vendor-customer-mapping.md) | Mapeo vendor/customer | `map_vendor_customer()` en `orders.py` |

## Entregables

- `backend/legacy/importers/orders.py` con `import_orders` y `map_vendor_customer`.
- Management command `import_legacy_dump.py` extendido con stage `orders`.
- `backend/legacy/tests/test_order_importer.py` con 6+ tests.
- `backend/legacy/tests/test_vendor_mapping.py` con 4+ tests (interno, externo, edge cases).

## DoD de la fase

- [ ] `python manage.py import_legacy_dump --stage=orders --dry-run` lista 7.960 NVs.
- [ ] `python manage.py import_legacy_dump --stage=orders` importa; `LegacySaleNote.objects.count() == 7960`.
- [ ] `LegacySaleNote.objects.filter(status='DISPATCHED').count() == 7740` (despachado).
- [ ] `LegacySaleNote.objects.filter(status='IN_PRODUCTION').count() == 200` (no_despachado).
- [ ] `LegacySaleNote.objects.filter(status='PENDING').count() == 20` (pendiente).
- [ ] 20 NVs anuladas NO están en la BD.
- [ ] 1 NV (la de RUT inválido) tiene `customer` con `tax_id_exception=True`.
- [ ] `pytest backend/legacy/tests/test_order_importer.py -v` pasa.

## Decisiones tomadas en esta fase

1. **Categorías hardcodeadas** en el importer (no se consulta `legacy.categorias`): más simple, más auditable, fail-fast si aparece categoría 6.
2. **Estado `anulada` se OMITE** (no se crea `LegacySaleNote` con `status='CANCELLED'`).
3. **Vendor `interno`** (futuro): `customer=cliente`, `related_contact=None`, vendor queda en la NV como referencia.
4. **Vendor `externo`** (100% del dataset actual): `customer=vendor (como Contact)`, `related_contact=cliente original`.
5. **`descripcion_texto` se preserva tal cual** (no se intenta parsear).
6. **`dispatched_at`** se setea con `fecha` (sin hora) si `despachado=True`.
7. **`is_pending`** se preserva como flag adicional.
8. **Work order se difiere a Phase 4**: en este import solo se crea `LegacySaleNote`; la OT se crea en T11–T13.

## Mapeo de estados legacy

| `ordenes.estado` | `LegacySaleNote.status` | `is_pending` | `dispatched_at` |
|---|---|---|---|
| `despachado` | `DISPATCHED` | `False` | `fecha` |
| `no_despachado` | `IN_PRODUCTION` | `False` | `NULL` |
| `pendiente` | `PENDING` | `True` | `NULL` |
| `anulada` | (omitido) | — | — |

## Mapeo de vendor/customer

```python
def map_vendor_customer(customer_id, vendor):
    if vendor.category == 'interno':
        return customer_id, None, vendor
    else:  # 'externo'
        return vendor_as_contact(vendor), customer_id, vendor
```

**`vendor_as_contact`**: crea (o recupera) un `Contact` "sombra" para el vendor, con:
- `name = vendor.name`
- `tax_id = ''` (los vendors externos no tienen RUT)
- `email = ''`
- `phone = ''`
- `address = ''`
- Marcado con `ContactLegacyOrigin(source_table='vendedores', legacy_external_id=vendor.id, ...)`.

Esto permite que el frontend muestre el vendor como "cliente" sin que sea un `Contact` real.

## Cache de lookups

Para evitar N+1 en el import:

```python
cliente_map = {
    c.legacy_external_id: c.contact_id
    for c in ContactLegacyOrigin.objects
        .filter(source_table='clientes')
        .select_related('contact')
}
vendor_map = {v.legacy_external_id: v.id for v in LegacyVendor.objects.all()}
```

**Memoria**: ~2 MB para 7.980 NVs. Aceptable.

## Tests de muestra

```python
def test_creates_lazysalenote_for_despachado():
    # 1 NV despachado → 1 LegacySaleNote con status='DISPATCHED'
    ...

def test_skips_anulada():
    # 1 NV anulada → 0 LegacySaleNote
    ...

def test_vendor_externo_makes_related_contact():
    # 1 NV con vendor externo → customer=vendor_contact, related_contact=cliente
    ...

def test_vendor_interno_keeps_related_contact_none():
    # Mock: vendor con category='interno' → customer=cliente, related_contact=None
    ...

def test_unknown_category_fails_loudly():
    # categoria_id=99 (no en CATEGORIES) → rows_failed += 1, no crea NV
    ...
```

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Categoría 6+ aparece en el dataset | Falla ruidosamente, fila se cuenta en `rows_failed` |
| Cliente legacy no tiene `ContactLegacyOrigin` | Se cuenta en `rows_failed` con log explicativo |
| Vendor legacy no existe en `LegacyVendor` | Idem |
| `descripcion_texto` con caracteres raros | Se guarda tal cual (TextField acepta UTF-8) |
| Memoria del cache | 2 MB → OK |

## Comandos de verificación rápida

```bash
# 1. Dry-run
python manage.py import_legacy_dump --stage=orders --dry-run --dsn="$LEGACY_DSN"

# 2. Import real
python manage.py import_legacy_dump --stage=orders --dsn="$LEGACY_DSN"

# 3. Verificar
python manage.py shell <<'PY'
from legacy.models import LegacySaleNote
print('Total:', LegacySaleNote.objects.count())
print('DISPATCHED:', LegacySaleNote.objects.filter(status='DISPATCHED').count())
print('IN_PRODUCTION:', LegacySaleNote.objects.filter(status='IN_PRODUCTION').count())
print('PENDING:', LegacySaleNote.objects.filter(status='PENDING').count())
print('Con related_contact:', LegacySaleNote.objects.exclude(related_contact=None).count())
PY

# 4. Idempotencia
python manage.py import_legacy_dump --stage=orders --dsn="$LEGACY_DSN"
# Debe seguir en 7960

# 5. Tests
pytest backend/legacy/tests/test_order_importer.py -v
```

## Salida para la Phase 4

Al cerrar Phase 3, ya se puede:
- Crear WorkOrders manuales para cada `LegacySaleNote` (Phase 4 T11–T13).
- Importar pagos históricos vinculados a las NVs (Phase 5 T15).

**No** se puede aún:
- Mostrar en UI (faltan serializers + frontend).
- Registrar pagos nuevos (falta el endpoint).
