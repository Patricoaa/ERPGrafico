# Phase 4 — Work Orders

> Creación de 7.960 OTs manuales finalizadas (una por NV legacy). NO bloqueadas. Descripción con `legacy_external_id`.

## Precondiciones

- [ ] Phase 1 cerrada.
- [ ] Phase 3 cerrada (`LegacySaleNote` poblada).
- [ ] `LEGACY-OT-PRODUCT` existe (Phase 1 T03).
- [ ] `WorkOrderService.create_manual` y `transition_to` estudiados (ver `backend/production/services.py`).

## Tasks

| Task | Título | Salida |
|---|---|---|
| [T11](../tasks/T11-work-order-builder.md) | `build_work_order_for_legacy_note` | `backend/legacy/services/work_order_builder.py` |
| [T12](../tasks/T12-create-manual-invocation.md) | Invocación de `create_manual` | Parámetro `sale_note_id` agregado a `create_manual` |
| [T13](../tasks/T13-transition-finished.md) | Transition a FINISHED | `WorkOrderService.transition_to` con fallback `needs_manual_finalize` |
| [T14](../tasks/T14-data-migration-validation.md) | Validación data migration 0002 | Pre-check `UoM` y `Warehouse` antes de crear OT |

## Entregables

- `backend/legacy/services/__init__.py`.
- `backend/legacy/services/work_order_builder.py` con `build_work_order_for_legacy_note`.
- `backend/production/services.py` extendido: `create_manual` acepta `sale_note_id: int | None = None`.
- `backend/production/models.py` extendido: `WorkOrder.sale_note = ForeignKey('legacy.LegacySaleNote', null=True, on_delete=SET_NULL)`.
- Migración `backend/production/migrations/000N_add_sale_note_fk.py` (auto-generada).
- `backend/legacy/tests/test_work_order_builder.py` con 5+ tests.

## DoD de la fase

- [ ] `LegacySaleNote.objects.filter(work_order__isnull=True).count() == 0` tras correr el builder.
- [ ] `WorkOrder.objects.filter(is_manual=True, current_stage='FINISHED').count() == 7960` (o más si había OTs manuales previas).
- [ ] `WorkOrder.objects.filter(is_blocked=True, sale_note__isnull=False).count() == 0` (ninguna OT legacy está bloqueada).
- [ ] Cada `LegacySaleNote` tiene un `WorkOrder` cuya descripción empieza con `[<legacy_external_id>]` y contiene la categoría snapshot.
- [ ] `pytest backend/production/tests -v` pasa (no regresiones).
- [ ] `pytest backend/legacy/tests/test_work_order_builder.py -v` pasa.

## Decisiones tomadas en esta fase

1. **Una OT por NV legacy**, no más (no se itera por línea: cada NV legacy tiene 1 línea textual).
2. **`is_manual=True`** porque la OT se crea "a mano", sin pasar por el flujo de creación de venta → OT.
3. **`current_stage='FINISHED'`** y `status='FINISHED'` desde el inicio (no se ejecuta flujo de producción).
4. **`is_blocked=False`** por default (decisión explícita: el manager puede editarla si quiere).
5. **Descripción**: `[{legacy_external_id}] - {description} - {category_snapshot}` (mantiene trazabilidad visual).
6. **`needs_manual_finalize=True`** si `transition_to(FINISHED)` falla (fallback).
7. **`uom` y `warehouse`**: se obtienen de `LEGACY-OT-PRODUCT` (creado en data migration 0002 con UoM `UN` y Warehouse `LEGACY-DEFAULT`).
8. **`sale_note` FK en `WorkOrder`**: nullable, `on_delete=SET_NULL` (si se borra la NV legacy, la OT queda huérfana con `sale_note=NULL`).

## Mapeo legacy → WorkOrder

| Campo `WorkOrder` | Valor |
|---|---|
| `product` | `LEGACY-OT-PRODUCT` |
| `uom` | `Product.uom` (UoM `UN`) |
| `warehouse` | `Product.default_warehouse` (Warehouse `LEGACY-DEFAULT`) |
| `quantity` | `LegacySaleNote.quantity` |
| `description` | `[{legacy_external_id}] - {description} - {category_snapshot}` |
| `customer` | `LegacySaleNote.customer` |
| `related_contact` | `LegacySaleNote.related_contact` |
| `is_manual` | `True` |
| `current_stage` | `Stage.FINISHED` |
| `status` | `WorkOrderStatus.FINISHED` |
| `is_blocked` | `False` |
| `sale_note` | `LegacySaleNote` (FK inversa) |

## Builder pseudocódigo

```python
def build_work_order_for_legacy_note(note):
    if note.work_order_id:
        return note.work_order  # idempotente

    product = Product.objects.select_related('uom', 'default_warehouse').get(code='LEGACY-OT-PRODUCT')

    wo = WorkOrderService.create_manual(
        product=product,
        uom=product.uom,
        warehouse=product.default_warehouse,
        quantity=note.quantity,
        description=f'[{note.legacy_external_id}] - {note.description} - {note.category_snapshot}',
        customer=note.customer,
        related_contact=note.related_contact,
        sale_note_id=note.id,
        skip_initial_stage=True,
    )

    try:
        WorkOrderService.transition_to(wo, Stage.FINISHED)
    except TransitionError:
        wo.current_stage = Stage.FINISHED
        wo.status = WorkOrderStatus.FINISHED
        wo.needs_manual_finalize = True
        wo.save(update_fields=['current_stage', 'status', 'needs_manual_finalize'])

    note.work_order = wo
    note.save(update_fields=['work_order'])
    return wo
```

## Modificación a `WorkOrderService.create_manual`

```python
def create_manual(*, product, uom, warehouse, quantity, description, customer, related_contact=None, sale_note_id=None, skip_initial_stage=False):
    # ... validaciones existentes ...
    wo = WorkOrder.objects.create(
        product=product,
        uom=uom,
        warehouse=warehouse,
        quantity=quantity,
        description=description,
        customer=customer,
        related_contact=related_contact,
        sale_note_id=sale_note_id,
        is_manual=True,
        current_stage=Stage.DRAFT if not skip_initial_stage else Stage.FINISHED,
        status=WorkOrderStatus.DRAFT if not skip_initial_stage else WorkOrderStatus.FINISHED,
        is_blocked=False,
    )
    return wo
```

**Decisión**: `skip_initial_stage=True` se usa solo para OTs legacy (que nacen finalizadas). El flujo normal sigue usando `DRAFT` como punto de partida.

## Validación pre-builder (T14)

```python
def validate_work_order_dependencies():
    """Falla ruidosamente si UoM, Warehouse o Product no están listos."""
    try:
        uom = UoM.objects.get(code='UN')
    except UoM.DoesNotExist:
        raise CommandError('UoM UN no existe. Ejecuta migrate legacy.0002.')
    try:
        wh = Warehouse.objects.get(code='LEGACY-DEFAULT')
    except Warehouse.DoesNotExist:
        raise CommandError('Warehouse LEGACY-DEFAULT no existe. Ejecuta migrate legacy.0002.')
    try:
        product = Product.objects.get(code='LEGACY-OT-PRODUCT')
    except Product.DoesNotExist:
        raise CommandError('Product LEGACY-OT-PRODUCT no existe. Ejecuta migrate legacy.0002.')
    if product.type != Product.ProductType.SERVICE:
        raise CommandError('LEGACY-OT-PRODUCT debe ser SERVICE.')
    if not product.uom_id:
        raise CommandError('LEGACY-OT-PROPRODUCT sin uom.')
    if not product.default_warehouse_id:
        raise CommandError('LEGACY-OT-PRODUCT sin default_warehouse.')
```

## Tests de muestra

```python
def test_creates_workorder_for_legacy_note():
    note = LegacySaleNoteFactory(...)
    wo = build_work_order_for_legacy_note(note)
    assert wo.is_manual is True
    assert wo.current_stage == Stage.FINISHED
    assert note.work_order == wo

def test_idempotente():
    note = LegacySaleNoteFactory(...)
    wo1 = build_work_order_for_legacy_note(note)
    wo2 = build_work_order_for_legacy_note(note)
    assert wo1.id == wo2.id

def test_fallback_si_transition_falla(monkeypatch):
    def raise_transition(*a, **kw): raise TransitionError('no permitido')
    monkeypatch.setattr(WorkOrderService, 'transition_to', raise_transition)
    note = LegacySaleNoteFactory(...)
    wo = build_work_order_for_legacy_note(note)
    assert wo.needs_manual_finalize is True
    assert wo.current_stage == Stage.FINISHED

def test_descripcion_contiene_legacy_id_y_categoria():
    note = LegacySaleNoteFactory(legacy_external_id=12345, description='Tarjetas', category_snapshot='Impresion Digital')
    wo = build_work_order_for_legacy_note(note)
    assert '[12345]' in wo.description
    assert 'Tarjetas' in wo.description
    assert 'Impresion Digital' in wo.description
```

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| `transition_to(FINISHED)` falla | Fallback `needs_manual_finalize=True` + log |
| `UoM` o `Warehouse` borrados | Data migration 0002 los crea; pre-check en builder |
| Performance (7.960 OTs) | ~5 min en bulk; acceptable para import inicial; usar Celery si > 30 min |
| Doble creación | Idempotencia: si `note.work_order_id` ya existe, return |

## Comandos de verificación rápida

```bash
# 1. Crear OTs (batch)
python manage.py shell <<'PY'
from legacy.importers.orders import build_work_order_for_legacy_note
from legacy.models import LegacySaleNote
for note in LegacySaleNote.objects.filter(work_order__isnull=True).iterator():
    build_work_order_for_legacy_note(note)
PY

# 2. Verificar
python manage.py shell <<'PY'
from legacy.models import LegacySaleNote
from production.models import WorkOrder
print('NV con WO:', LegacySaleNote.objects.exclude(work_order=None).count())
print('NV sin WO:', LegacySaleNote.objects.filter(work_order=None).count())
print('OTs manuales FINISHED:', WorkOrder.objects.filter(is_manual=True, current_stage='FINISHED').count())
print('OTs legacy bloqueadas:', WorkOrder.objects.filter(is_blocked=True, sale_note__isnull=False).count())
PY

# 3. Tests
pytest backend/legacy/tests/test_work_order_builder.py backend/production/tests -v
```

## Salida para la Phase 5

Al cerrar Phase 4, ya se puede:
- Importar pagos históricos (Phase 5 T15) — la NV ya tiene OT.
- Registrar pagos nuevos (Phase 5 T16–T18) — la NV existe, la OT existe.

**No** se puede aún:
- Mostrar en UI (faltan serializers + frontend).
- Consumir la API unificada (faltan serializers y viewset).
