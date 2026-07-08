# T14 — Data migration validation (pre-check)

> **Phase**: 4
> **Tiempo estimado**: 15 min
> **Complejidad**: baja

## Precondiciones

- [ ] T03 cerrada (data migration 0002 crea UoM/Warehouse/Product).

## Archivos a tocar/crear

- `backend/legacy/services/work_order_builder.py` (agregar `validate_work_order_dependencies`).
- `backend/legacy/management/commands/import_legacy_dump.py` (llamar validación al inicio del stage `orders`).

## Implementación

```python
# backend/legacy/services/work_order_builder.py
def validate_work_order_dependencies():
    """Falla ruidosamente si UoM, Warehouse o Product no están listos."""
    from inventory.models import UoM, Warehouse, Product
    from django.core.management.base import CommandError

    try:
        uom = UoM.objects.get(code='UN')
    except UoM.DoesNotExist:
        raise CommandError('UoM UN no existe. Ejecuta `migrate legacy.0002` primero.')

    try:
        wh = Warehouse.objects.get(code='LEGACY-DEFAULT')
    except Warehouse.DoesNotExist:
        raise CommandError('Warehouse LEGACY-DEFAULT no existe. Ejecuta `migrate legacy.0002` primero.')

    try:
        product = Product.objects.get(code='LEGACY-OT-PRODUCT')
    except Product.DoesNotExist:
        raise CommandError('Product LEGACY-OT-PRODUCT no existe. Ejecuta `migrate legacy.0002` primero.')

    if product.product_type != 'SERVICE':   # campo real: product_type (no type)
        raise CommandError(f"LEGACY-OT-PRODUCT existe pero con product_type='{product.product_type}'. Debe ser SERVICE.")

    if not product.uom_id:
        raise CommandError('LEGACY-OT-PRODUCT no tiene uom asignada.')

    # El warehouse de la OT se toma de Warehouse(code='LEGACY-DEFAULT'), no del producto
    # (Product no tiene `default_warehouse`).
    if not Warehouse.objects.filter(code='LEGACY-DEFAULT').exists():
        raise CommandError('Warehouse LEGACY-DEFAULT no existe. Ejecuta `migrate legacy.0002` primero.')

    return product
```

## Uso

En `build_work_order_for_legacy_note`:

```python
def build_work_order_for_legacy_note(note):
    if note.work_order_id:
        return note.work_order
    product = validate_work_order_dependencies()  # falla ruidosamente
    # ... resto
```

En el management command, antes de iterar:

```python
if opts['stage'] in ('orders', 'all'):
    validate_work_order_dependencies()
    import_orders(...)
```

## DoD

- [ ] `validate_work_order_dependencies` falla con `CommandError` claro si falta UoM/Warehouse/Product.
- [ ] Si el Product existe pero NO es SERVICE, falla.
- [ ] Test: simular `UoM.objects.filter(code='UN').delete()` y verificar que el builder falla.

## Comandos de verificación

```bash
pytest backend/legacy/tests/test_work_order_builder.py -v
# Test manual:
python manage.py shell -c "from inventory.models import UoM; UoM.objects.filter(code='UN').delete(); from legacy.services.work_order_builder import validate_work_order_dependencies; validate_work_order_dependencies()"
# Debe lanzar CommandError.
```

## Riesgos

- **Falsa alarma**: si el usuario ya tenía un `LEGACY-OT-PRODUCT` con `type='PHYSICAL'`, falla. Documentar.
