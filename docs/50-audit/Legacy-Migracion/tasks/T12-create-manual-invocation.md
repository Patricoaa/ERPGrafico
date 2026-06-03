# T12 — Extend `WorkOrderService.create_manual` with `sale_note_id`

> **Phase**: 4
> **Tiempo estimado**: 20 min
> **Complejidad**: baja

## Precondiciones

- [ ] T11 cerrada (o en paralelo).

## Archivos a tocar/crear

- `backend/production/models.py` (agregar `WorkOrder.sale_note` FK).
- `backend/production/services.py::WorkOrderService.create_manual` (agregar parámetro `sale_note_id`).
- `backend/production/migrations/000N_add_sale_note_fk.py` (auto).

## 1. `WorkOrder.sale_note` FK

```python
# backend/production/models.py
class WorkOrder(TimeStampedModel):
    # ... campos existentes ...
    sale_note = models.ForeignKey(
        'legacy.LegacySaleNote',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='work_order_ref',  # LegacySaleNote ya tiene 'work_order' (OneToOne); este es el back-ref
    )
```

**Nota**: `LegacySaleNote.work_order` es `OneToOneField`, por lo que el back-ref automático es `work_order` (singular). El nuevo FK en `WorkOrder` hacia `LegacySaleNote` debe usar `related_name` distinto o no tener `related_name` (default `lazysalenote_set`).

**Decisión**: usar `related_name='+'` (sin back-ref) porque la navegación siempre es `LegacySaleNote → WorkOrder` (one-to-one), no al revés.

## 2. Modificar `create_manual`

```python
# backend/production/services.py
@staticmethod
def create_manual(*, product, uom, warehouse, quantity, description, customer, related_contact=None, sale_note_id=None, skip_initial_stage=False):
    # ... validaciones existentes (UoM, warehouse, etc.) ...

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

## 3. Generar migración

```bash
python manage.py makemigrations production
```

## DoD

- [ ] `WorkOrder.sale_note` FK existe y es nullable.
- [ ] `WorkOrderService.create_manual` acepta `sale_note_id=None` por default.
- [ ] Tests de `production` siguen pasando (no regresiones).
- [ ] Migración aplica sin error.

## Comandos de verificación

```bash
python manage.py makemigrations production
python manage.py migrate production
pytest backend/production/tests -v
```

## Riesgos

- **Migración en producción**: requiere deploy coordinado. Es aditiva (nullable), no destructiva.
- **Conflictos con OTs existentes**: ninguna (campo nullable).
