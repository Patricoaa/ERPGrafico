# T13 — Transition to FINISHED with fallback

> **Phase**: 4
> **Tiempo estimado**: 20 min
> **Complejidad**: baja

## Precondiciones

- [ ] T11, T12 cerradas.

## Archivos a tocar/crear

- `backend/legacy/services/work_order_builder.py` (ya incluye fallback; aquí se detallan los casos).
- `backend/production/models.py` (verificar campo `needs_manual_finalize`).

## Implementación

El fallback ya está implementado en T11. Esta task documenta los casos:

### Caso 1: `transition_to(FINISHED)` exitoso

```python
WorkOrderService.transition_to(wo, Stage.FINISHED)
# OK: wo.current_stage='FINISHED', wo.status='FINISHED', wo.needs_manual_finalize=False
```

### Caso 2: `transition_to` lanza `TransitionError`

```python
try:
    WorkOrderService.transition_to(wo, Stage.FINISHED)
except TransitionError:
    wo.current_stage = Stage.FINISHED
    wo.status = WorkOrderStatus.FINISHED
    wo.needs_manual_finalize = True
    wo.save(update_fields=['current_stage', 'status', 'needs_manual_finalize'])
```

### Caso 3: `transition_to` lanza otra excepción

- `Exception` genérica se loguea pero **no** se propaga (la OT ya está creada, mejor dejarla en estado parcial que fallar el batch).
- `import_run.rows_failed += 1` (pero la NV y la OT sí se crean; el problema es solo la transición).

## Campo `needs_manual_finalize`

Si no existe en `WorkOrder`, agregar:

```python
# backend/production/models.py
class WorkOrder(TimeStampedModel):
    # ... campos existentes ...
    needs_manual_finalize = models.BooleanField(default=False)
```

Migración: `python manage.py makemigrations production`.

## Tests

```python
# Ya cubierto en T11. Esta task agrega:
def test_needs_manual_finalize_default_false():
    wo = WorkOrderFactory()
    assert wo.needs_manual_finalize is False
```

## DoD

- [ ] Campo `needs_manual_finalize` existe en `WorkOrder` (default `False`).
- [ ] Fallback en builder funciona.
- [ ] Tests pasan.

## Comandos de verificación

```bash
pytest backend/legacy/tests/test_work_order_builder.py backend/production/tests -v
```

## Riesgos

- **OTs con `needs_manual_finalize=True`** requieren intervención manual del admin de producción. Se documenta en el runbook.
