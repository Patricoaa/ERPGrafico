# T11 — Work order builder

> **Phase**: 4
> **Tiempo estimado**: 40 min
> **Complejidad**: baja

La OT histórica se crea **directamente** vía ORM en `FINISHED` (sin `WorkOrderService.create_manual`, que rechaza productos SERVICE y crearía una tarea de workflow por OT). Código autoritativo: `04-backend-import-pipeline.md` §7.

## Precondiciones

- [ ] Phase 3 cerrada.
- [ ] `LEGACY-OT-PRODUCT` y `Warehouse(code='LEGACY-DEFAULT')` existen (T03).

## Archivos a tocar/crear

- `backend/legacy/services/work_order_builder.py` (nuevo).
- `backend/legacy/importers/orders.py` (llamar al builder tras crear la NV).
- `backend/legacy/tests/test_work_order_builder.py`.

## Implementación

```python
# backend/legacy/services/work_order_builder.py
import logging
from production.models import WorkOrder
from inventory.models import Product, Warehouse
from legacy.models import LegacySaleNote

logger = logging.getLogger('legacy.workorder')


def build_work_order_for_legacy_note(note: LegacySaleNote):
    """Crea una OT histórica YA finalizada por cada NV legacy. Idempotente."""
    if note.work_order_id:
        return note.work_order

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
    # WorkOrder.save() asigna `number` vía SequenceService automáticamente.

    note.work_order = wo
    note.save(update_fields=['work_order'])
    return wo
```

## Integración en importer

En `importers/orders.py`, justo después de crear la `LegacySaleNote`:

```python
from legacy.services.work_order_builder import build_work_order_for_legacy_note

with transaction.atomic():
    note, created = LegacySaleNote.objects.get_or_create(...)
    if created:
        build_work_order_for_legacy_note(note)
```

## Tests

```python
# test_work_order_builder.py
def test_creates_workorder_for_legacy_note():
    note = LegacySaleNoteFactory(...)
    wo = build_work_order_for_legacy_note(note)
    assert wo.is_manual is True
    assert wo.status == WorkOrder.Status.FINISHED
    assert wo.current_stage == WorkOrder.Stage.FINISHED
    assert note.work_order == wo

def test_idempotente():
    note = LegacySaleNoteFactory(...)
    wo1 = build_work_order_for_legacy_note(note)
    wo2 = build_work_order_for_legacy_note(note)
    assert wo1.id == wo2.id

def test_no_genera_tarea_de_workflow():
    # No se crea WorkflowTask para la OT legacy (no pasa por create_manual)
    ...

def test_descripcion_contiene_legacy_id_y_categoria():
    note = LegacySaleNoteFactory(legacy_external_id=12345, description='Tarjetas', category_snapshot='Impresion Digital')
    wo = build_work_order_for_legacy_note(note)
    assert '[12345]' in wo.description
    assert 'Tarjetas' in wo.description
    assert 'Impresion Digital' in wo.description
```

## DoD

- [ ] `build_work_order_for_legacy_note` crea una OT con `is_manual=True`, `status=FINISHED`, `current_stage=FINISHED`.
- [ ] No se genera ninguna `WorkflowTask` nueva por OT legacy.
- [ ] Re-ejecutar es idempotente.
- [ ] Descripción incluye `[legacy_external_id]`, descripción textual y categoría snapshot.
- [ ] 4+ tests pasan.

## Comandos de verificación

```bash
pytest backend/legacy/tests/test_work_order_builder.py -v
# Integración:
python manage.py shell <<'PY'
from legacy.models import LegacySaleNote
from legacy.services.work_order_builder import build_work_order_for_legacy_note
for note in LegacySaleNote.objects.filter(work_order__isnull=True).iterator():
    build_work_order_for_legacy_note(note)
print('Hecho. Total LegacySaleNote con WO:', LegacySaleNote.objects.exclude(work_order=None).count())
PY
```

## Riesgos

- `WorkOrder.save()` podría exigir alguna condición al persistir directo en FINISHED → probar con 1 OT antes del batch (T14); revisar signals de `production`.
- `LEGACY-OT-PRODUCT` o `LEGACY-DEFAULT` no existen → falla con `DoesNotExist` (T14 valida pre-condición).
- Performance: ~7.980 OTs en bulk ~5 min. Aceptable.
