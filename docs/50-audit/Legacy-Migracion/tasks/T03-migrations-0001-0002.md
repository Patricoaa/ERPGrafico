# T03 — Migrations 0001 + 0002 (ruidosa)

> **Phase**: 1
> **Tiempo estimado**: 30 min
> **Complejidad**: media (la 0002 es ruidosa)

## Precondiciones

- [ ] T02 cerrada (los 6 modelos existen).

## Archivos a tocar/crear

- `backend/legacy/migrations/0001_initial.py` (auto-generado por `makemigrations`).
- `backend/legacy/migrations/0002_legacy_seed.py` (manual, ruidosa).

## 1. Generar 0001

```bash
python manage.py makemigrations legacy
```

Esto crea `0001_initial.py` automáticamente. Revisar que incluye los 6 modelos y los índices/constraints esperados.

## 2. Crear 0002 (manual)

```python
# backend/legacy/migrations/0002_legacy_seed.py
from django.db import migrations


def seed_legacy_dependencies(apps, schema_editor):
    UoM = apps.get_model('inventory', 'UoM')
    Warehouse = apps.get_model('inventory', 'Warehouse')
    Product = apps.get_model('inventory', 'Product')

    # UoM
    uom_qs = UoM.objects.filter(code='UN')
    if uom_qs.exists():
        if uom_qs.first().name != 'Unidad':
            raise RuntimeError(
                f"UoM con code='UN' existe pero con name='{uom_qs.first().name}'. "
                "Renombre o ajuste esta migración."
            )
        uom = uom_qs.first()
    else:
        uom = UoM.objects.create(code='UN', name='Unidad')

    # Warehouse
    wh_qs = Warehouse.objects.filter(code='LEGACY-DEFAULT')
    if wh_qs.exists():
        wh = wh_qs.first()
    else:
        wh = Warehouse.objects.create(code='LEGACY-DEFAULT', name='Bodega Legacy Default', is_default=False)

    # Product
    prod_qs = Product.objects.filter(code='LEGACY-OT-PRODUCT')
    if prod_qs.exists():
        prod = prod_qs.first()
        if prod.type != 'SERVICE':
            raise RuntimeError(f"LEGACY-OT-PRODUCT existe pero con type='{prod.type}'. Debe ser SERVICE.")
    else:
        prod = Product.objects.create(
            code='LEGACY-OT-PRODUCT',
            name='Servicio OT Legacy (importación histórica)',
            type='SERVICE',
            uom=uom,
            default_warehouse=wh,
            is_active=True,
        )


def reverse_seed(apps, schema_editor):
    pass  # No se borra el seed para evitar pérdida accidental.


class Migration(migrations.Migration):
    dependencies = [('legacy', '0001_initial')]
    operations = [migrations.RunPython(seed_legacy_dependencies, reverse_seed)]
```

## DoD

- [ ] `python manage.py migrate legacy` aplica 0001 y 0002 sin error.
- [ ] Existe `Product.objects.get(code='LEGACY-OT-PRODUCT')` con `type='SERVICE'`, `uom.code='UN'`, `default_warehouse.code='LEGACY-DEFAULT'`.
- [ ] Si `UoM(code='UN')` ya existe con otro `name`, la migración falla con mensaje claro.

## Comandos de verificación

```bash
python manage.py migrate legacy
python manage.py shell -c "from inventory.models import Product; p = Product.objects.get(code='LEGACY-OT-PRODUCT'); print(p, p.uom, p.default_warehouse)"
```

## Riesgos

- **Migración ruidosa** en producción: requiere coordinar deploy con el equipo.
- **`type='SERVICE'`** es literal string. Si el modelo usa `ProductType.SERVICE`, ajustar.
- **Idempotencia**: si se ejecuta 2 veces, no falla (todo es `get_or_create` con validación).
