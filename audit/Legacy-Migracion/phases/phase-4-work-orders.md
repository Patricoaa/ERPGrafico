# Phase 4 — Work Orders

> Creación de **7.980** OTs históricas finalizadas (una por NV legacy). NO bloqueadas. Descripción con `legacy_external_id`. La OT se crea **directamente** vía ORM en `FINISHED` (sin `WorkOrderService.create_manual`, que rechaza productos SERVICE y generaría una tarea de workflow por OT). Código autoritativo: `04-backend-import-pipeline.md` §7.

## Precondiciones

- [ ] Phase 1 cerrada.
- [ ] Phase 3 cerrada (`LegacySaleNote` poblada).
- [ ] `LEGACY-OT-PRODUCT` y `Warehouse(code='LEGACY-DEFAULT')` existen (Phase 1 T03).
- [ ] Revisado `production/models.py` (`WorkOrder.Status`, `WorkOrder.Stage`, asignación de `number` vía `SequenceService` en `save()`).

## Tasks

| Task | Título | Salida |
|---|---|---|
| [T11](../tasks/T11-work-order-builder.md) | `build_work_order_for_legacy_note` | `backend/legacy/services/work_order_builder.py` |
| [T14](../tasks/T14-data-migration-validation.md) | Validación data migration 0002 | Pre-check `Product`/`Warehouse` antes de crear OT |

## Entregables

- `backend/legacy/services/__init__.py`.
- `backend/legacy/services/work_order_builder.py` con `build_work_order_for_legacy_note`.
- `backend/legacy/tests/test_work_order_builder.py` con 4+ tests.

> **Sin cambios en `production/`**: la relación OT↔NV vive en `LegacySaleNote.work_order` (`OneToOneField → production.WorkOrder`, `null=True`, `on_delete=SET_NULL`), definida en T02. No se agrega FK ni parámetro a `WorkOrderService`.

## DoD de la fase

- [ ] `LegacySaleNote.objects.filter(work_order__isnull=True).count() == 0` tras correr el builder.
- [ ] `WorkOrder.objects.filter(is_manual=True, current_stage='FINISHED').count() >= 7980` (o más si había OTs manuales previas).
- [ ] Ninguna OT legacy genera tarea de workflow nueva (no se usa `create_manual`). Las OTs legacy se identifican por `stage_data->>'legacy'='true'` o el reverse `legacysalenote`.
- [ ] Cada `LegacySaleNote` tiene un `WorkOrder` cuya descripción empieza con `[<legacy_external_id>]` y contiene la categoría snapshot.
- [ ] `pytest backend/production/tests -v` pasa (no regresiones).
- [ ] `pytest backend/legacy/tests/test_work_order_builder.py -v` pasa.

## Decisiones tomadas en esta fase

1. **Una OT por NV legacy** (cada NV legacy tiene 1 línea textual).
2. **`is_manual=True`**: la OT se crea a mano, sin pasar por el flujo venta → OT.
3. **`status=WorkOrder.Status.FINISHED` + `current_stage=WorkOrder.Stage.FINISHED`** desde el inicio (es histórica; no se ejecuta flujo de producción).
4. **No se usa `create_manual`**: se evita la validación de "fabricable" (rechaza SERVICE), la expansión de BOM y la creación de tareas de workflow/history.
5. **Sin materiales ni history de etapas**: no hubo consumo real de inventario que registrar.
6. **No bloqueada**: editable si el manager lo necesita (`WorkOrder` no tiene campo `is_blocked`).
7. **`warehouse`** se obtiene de `Warehouse(code='LEGACY-DEFAULT')` (Product **no** tiene `default_warehouse`).
8. **Relación única** `LegacySaleNote.work_order` (OneToOne, `SET_NULL`). Si se borra la OT, la NV queda con `work_order=NULL`.

## Mapeo legacy → WorkOrder

| Campo `WorkOrder` | Valor |
|---|---|
| `product` | `LEGACY-OT-PRODUCT` |
| `warehouse` | `Warehouse(code='LEGACY-DEFAULT')` |
| `description` | `[{legacy_external_id}] {description} — {category_snapshot}` (≤255) |
| `related_contact` | `LegacySaleNote.customer` (la OT no tiene FK `customer` directa) |
| `is_manual` | `True` |
| `status` | `WorkOrder.Status.FINISHED` |
| `current_stage` | `WorkOrder.Stage.FINISHED` |
| `stage_data` | `{'quantity': float(note.quantity), '_version': 1, 'legacy': True}` |
| `number` | auto (`SequenceService` en `WorkOrder.save()`) |

## Builder

```python
def build_work_order_for_legacy_note(note):
    if note.work_order_id:
        return note.work_order  # idempotente

    product = Product.objects.get(code='LEGACY-OT-PRODUCT')
    warehouse = Warehouse.objects.get(code='LEGACY-DEFAULT')

    wo = WorkOrder.objects.create(
        description=f'[{note.legacy_external_id}] {note.description} — {note.category_snapshot}'[:255],
        is_manual=True,
        product=product,
        warehouse=warehouse,
        related_contact=note.customer,
        status=WorkOrder.Status.FINISHED,
        current_stage=WorkOrder.Stage.FINISHED,
        stage_data={'quantity': float(note.quantity), '_version': 1, 'legacy': True},
    )

    note.work_order = wo
    note.save(update_fields=['work_order'])
    return wo
```

## Validación pre-builder (T14)

```python
def validate_work_order_dependencies():
    """Falla ruidosamente si Product o Warehouse no están listos."""
    try:
        product = Product.objects.get(code='LEGACY-OT-PRODUCT')
    except Product.DoesNotExist:
        raise CommandError('Product LEGACY-OT-PRODUCT no existe. Ejecuta migrate legacy.0002.')
    if product.product_type != 'SERVICE':   # campo real: product_type (no type)
        raise CommandError(f"LEGACY-OT-PRODUCT debe ser SERVICE (es '{product.product_type}').")
    if not product.uom_id:
        raise CommandError('LEGACY-OT-PRODUCT sin uom.')
    if not Warehouse.objects.filter(code='LEGACY-DEFAULT').exists():
        raise CommandError('Warehouse LEGACY-DEFAULT no existe. Ejecuta migrate legacy.0002.')
    return product
```

## Tests de muestra

```python
def test_creates_workorder_for_legacy_note():
    note = LegacySaleNoteFactory(...)
    wo = build_work_order_for_legacy_note(note)
    assert wo.is_manual is True
    assert wo.status == WorkOrder.Status.FINISHED
    assert wo.current_stage == WorkOrder.Stage.FINISHED
    assert note.work_order == wo

def test_no_genera_tarea_de_workflow():
    # No se crea WorkflowTask para la OT legacy (no pasa por create_manual)
    ...

def test_idempotente():
    note = LegacySaleNoteFactory(...)
    wo1 = build_work_order_for_legacy_note(note)
    wo2 = build_work_order_for_legacy_note(note)
    assert wo1.id == wo2.id

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
| `WorkOrder.save()` exige condición no esperada al persistir directo en FINISHED | Probar con 1 OT antes del batch (T14); revisar signals de `production` |
| `Product` o `Warehouse` borrados | Data migration 0002 los crea; pre-check en builder |
| Performance (~7.980 OTs) | ~5 min en bulk; aceptable para import inicial; usar Celery si > 30 min |
| Doble creación | Idempotencia: si `note.work_order_id` ya existe, return |

## Comandos de verificación rápida

```bash
# 1. Crear OTs (batch)
python manage.py shell <<'PY'
from legacy.services.work_order_builder import build_work_order_for_legacy_note
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
