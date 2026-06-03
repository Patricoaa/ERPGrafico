# T11 — Work order builder

> **Phase**: 4
> **Tiempo estimado**: 60 min
> **Complejidad**: media

## Precondiciones

- [ ] Phase 3 cerrada.
- [ ] `LEGACY-OT-PRODUCT` existe (T03).

## Archivos a tocar/crear

- `backend/legacy/services/work_order_builder.py` (nuevo).
- `backend/legacy/importers/orders.py` (llamar al builder tras crear la NV).
- `backend/legacy/tests/test_work_order_builder.py`.

## Implementación

```python
# backend/legacy/services/work_order_builder.py
import logging
from django.db import transaction
from production.services import WorkOrderService
from production.exceptions import TransitionError
from production.models import Stage, WorkOrderStatus
from inventory.models import Product
from legacy.models import LegacySaleNote

logger = logging.getLogger('legacy.workorder')


def build_work_order_for_legacy_note(note: LegacySaleNote):
    """Crea una OT manual finalizada por cada NV legacy. Idempotente."""
    if note.work_order_id:
        return note.work_order

    product = Product.objects.select_related('uom', 'default_warehouse').get(code='LEGACY-OT-PRODUCT')

    description = f'[{note.legacy_external_id}] - {note.description} - {note.category_snapshot}'

    with transaction.atomic():
        wo = WorkOrderService.create_manual(
            product=product,
            uom=product.uom,
            warehouse=product.default_warehouse,
            quantity=note.quantity,
            description=description,
            customer=note.customer,
            related_contact=note.related_contact,
            sale_note_id=note.id,
            skip_initial_stage=True,
        )

    # Marcar como finalizada
    try:
        WorkOrderService.transition_to(wo, Stage.FINISHED)
    except TransitionError as e:
        logger.warning('transition_to(FINISHED) falló para WO id=%s: %s; usando fallback manual.', wo.id, e)
        wo.current_stage = Stage.FINISHED
        wo.status = WorkOrderStatus.FINISHED
        wo.needs_manual_finalize = True
        wo.save(update_fields=['current_stage', 'status', 'needs_manual_finalize'])

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
    assert wo.current_stage == Stage.FINISHED
    assert note.work_order == wo

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

def test_fallback_si_transition_falla(monkeypatch):
    def raise_transition(*a, **kw): raise TransitionError('no permitido')
    monkeypatch.setattr(WorkOrderService, 'transition_to', raise_transition)
    note = LegacySaleNoteFactory(...)
    wo = build_work_order_for_legacy_note(note)
    assert wo.needs_manual_finalize is True
    assert wo.current_stage == Stage.FINISHED

def test_is_blocked_false():
    note = LegacySaleNoteFactory(...)
    wo = build_work_order_for_legacy_note(note)
    assert wo.is_blocked is False
```

## DoD

- [ ] `build_work_order_for_legacy_note` crea una OT con `is_manual=True`, `current_stage=FINISHED`, `is_blocked=False`.
- [ ] Re-ejecutar es idempotente.
- [ ] Descripción incluye `[legacy_external_id]`, descripción textual y categoría snapshot.
- [ ] Fallback `needs_manual_finalize=True` si `transition_to` falla.
- [ ] 5+ tests pasan.

## Comandos de verificación

```bash
pytest backend/legacy/tests/test_work_order_builder.py -v
# Integración:
python manage.py shell <<'PY'
from legacy.models import LegacySaleNote
from legacy.services.work_order_builder import build_work_order_for_legacy_note
notes_sin_wo = LegacySaleNote.objects.filter(work_order__isnull=True)
for note in notes_sin_wo.iterator():
    build_work_order_for_legacy_note(note)
print('Hecho. Total LegacySaleNote con WO:', LegacySaleNote.objects.exclude(work_order=None).count())
PY
```

## Riesgos

- `WorkOrderService.transition_to(FINISHED)` puede fallar → fallback está documentado.
- `LEGACY-OT-PRODUCT` no existe → falla con `Product.DoesNotExist` (T14 valida pre-condición).
- Performance: 7.960 OTs en bulk ~5 min. Aceptable.
