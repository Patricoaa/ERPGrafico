# Phase 3 — Sale Notes

> Importación de las **7.980** NVs legacy (todas vivas; **no hay anuladas**). Decisión manual vs auto WorkOrder.

> ⚠️ **REESCRITO — ver `00` §1.4/§3.1 y `04` §4 (autoritativos).** Columnas reales: `descripcion`/`detalles`/`folio`/`fecha_ingreso`/`estado_trabajo`+`estado_despachado` (no `descripcion_texto`/`numero`/`fecha`/`estado`). **No existe `anulada`** ni el estado `IN_PRODUCTION` (solo `terminado`→DISPATCHED y `pendiente`→PENDING). El swap "vendor externo como customer" **se elimina**: `customer = cliente real` siempre.

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

- [ ] `python manage.py import_legacy_dump --stage=orders --dry-run` lista 7.980 NVs.
- [ ] `python manage.py import_legacy_dump --stage=orders` importa; `LegacySaleNote.objects.count() == 7980`.
- [ ] `LegacySaleNote.objects.filter(status='DISPATCHED').count() == 7960` (terminado/despachado).
- [ ] `LegacySaleNote.objects.filter(status='PENDING').count() == 20` (pendiente/no despachado).
- [ ] No hay NVs anuladas (estado inexistente en el legacy).
- [ ] `pytest backend/legacy/tests/test_order_importer.py -v` pasa.

## Decisiones tomadas en esta fase

1. **Categorías hardcodeadas** en el importer (no se consulta `legacy.categorias`): más simple, más auditable, fail-fast si aparece categoría 6.
2. **No hay estado `anulada`** en el legacy → no se omite nada; se filtra solo `deleted_at IS NULL` (hoy 0 filas).
3. **`customer = cliente real` siempre**; `vendor` es solo referencia a `LegacyVendor`. (Se elimina el swap "vendor externo como customer"; ver `04` §4.1.)
4. **`description` = `descripcion`** (línea corta); **`notes` = `detalles`** (texto largo, 7.379 con contenido). No se parsea.
5. **`dispatched_at`** se setea con `fecha_ingreso` (sin hora) si `estado_despachado='despachado'`.
6. **`is_pending`** = True cuando `estado_trabajo='pendiente'`.
7. **`legacy_number` = `folio`** (no único, 109 vacíos) — solo display.
8. **Work order se difiere a Phase 4**: en este import solo se crea `LegacySaleNote`; la OT se crea en T11.

## Mapeo de estados legacy

| `estado_trabajo` / `estado_despachado` | `LegacySaleNote.status` | `is_pending` | `dispatched_at` |
|---|---|---|---|
| `terminado` / `despachado` (7.960) | `DISPATCHED` | `False` | `fecha_ingreso` |
| `pendiente` / `no despachado` (20) | `PENDING` | `True` | `NULL` |

(Solo 2 combos reales, 1:1. No existen `IN_PRODUCTION` ni `anulada`.)

## Mapeo de vendor/customer

```python
def map_vendor_customer(customer_id, vendor):
    # customer = cliente real SIEMPRE; vendor = LegacyVendor (referencia).
    return customer_id, None, vendor
```

> ⚠️ Se **elimina** `vendor_as_contact` y el swap del plan previo: como 137/137 vendedores son `externo`, ese swap dejaría a ninguna NV con su cliente real como `customer` (y colisionaría con los 122 RUT compartidos, dado que `Contact.tax_id` es único). Detalle en `04` §4.1.

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
def test_creates_note_for_terminado():
    # estado_trabajo='terminado' → LegacySaleNote status='DISPATCHED', dispatched_at set
    ...

def test_creates_note_for_pendiente():
    # estado_trabajo='pendiente' → status='PENDING', is_pending=True, dispatched_at=None
    ...

def test_skips_deleted():
    # deleted_at IS NOT NULL → 0 LegacySaleNote
    ...

def test_customer_is_real_client():
    # customer = cliente real; related_contact=None (sin swap de vendor)
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
| `descripcion`/`detalles` con caracteres raros | Se guardan tal cual (TextField acepta UTF-8) |
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
print('Total:', LegacySaleNote.objects.count())          # 7980
print('DISPATCHED:', LegacySaleNote.objects.filter(status='DISPATCHED').count())  # 7960
print('PENDING:', LegacySaleNote.objects.filter(status='PENDING').count())        # 20
PY

# 4. Idempotencia
python manage.py import_legacy_dump --stage=orders --dsn="$LEGACY_DSN"
# Debe seguir en 7980

# 5. Tests
pytest backend/legacy/tests/test_order_importer.py -v
```

## Salida para la Phase 4

Al cerrar Phase 3, ya se puede:
- Crear WorkOrders para cada `LegacySaleNote` (Phase 4 T11).
- Importar pagos históricos vinculados a las NVs (Phase 5 T15).

**No** se puede aún:
- Mostrar en UI (faltan serializers + frontend).
- Registrar pagos nuevos (falta el endpoint).
