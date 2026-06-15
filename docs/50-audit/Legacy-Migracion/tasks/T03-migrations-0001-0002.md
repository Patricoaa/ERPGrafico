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
    UoMCategory = apps.get_model('inventory', 'UoMCategory')
    UoM = apps.get_model('inventory', 'UoM')
    Warehouse = apps.get_model('inventory', 'Warehouse')
    ProductCategory = apps.get_model('inventory', 'ProductCategory')
    Product = apps.get_model('inventory', 'Product')

    # UoM: NO tiene `code`; se identifica por `name` y exige `category` (FK NOT NULL).
    uom_cat, _ = UoMCategory.objects.get_or_create(name='Unidad')
    uom, _ = UoM.objects.get_or_create(
        name='Unidad',
        defaults={'category': uom_cat, 'uom_type': 'REFERENCE', 'ratio': 1},
    )

    # Warehouse: NO tiene `is_default`.
    wh, _ = Warehouse.objects.get_or_create(
        code='LEGACY-DEFAULT',
        defaults={'name': 'Bodega Legacy Default'},
    )

    # Product: exige `category` (ProductCategory, PROTECT, NOT NULL); campo de tipo
    # es `product_type` (no `type`); NO existe `default_warehouse`.
    prod_cat, _ = ProductCategory.objects.get_or_create(name='Legacy')
    prod_qs = Product.objects.filter(code='LEGACY-OT-PRODUCT')
    if prod_qs.exists():
        prod = prod_qs.first()
        if prod.product_type != 'SERVICE':
            raise RuntimeError(
                f"LEGACY-OT-PRODUCT existe pero con product_type='{prod.product_type}'. Debe ser SERVICE."
            )
    else:
        prod = Product.objects.create(
            code='LEGACY-OT-PRODUCT',
            name='Servicio OT Legacy (importación histórica)',
            product_type='SERVICE',
            category=prod_cat,
            uom=uom,
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
- [ ] Existe `Product.objects.get(code='LEGACY-OT-PRODUCT')` con `product_type='SERVICE'`, `category` asignada y `uom` (name='Unidad').
- [ ] Existe `Warehouse.objects.get(code='LEGACY-DEFAULT')` (el builder de OT toma de aquí el warehouse).
- [ ] Si `LEGACY-OT-PRODUCT` ya existe con otro `product_type`, la migración falla con mensaje claro.

## Comandos de verificación

```bash
python manage.py migrate legacy
python manage.py shell -c "from inventory.models import Product; p = Product.objects.get(code='LEGACY-OT-PRODUCT'); print(p, p.product_type, p.uom, p.category)"
```

## Riesgos

- **Migración ruidosa** en producción: requiere coordinar deploy con el equipo.
- **Campos reales** (verificado): `UoM` sin `code` (+`category` requerida); `Warehouse` sin `is_default`; `Product.product_type` (no `type`), `category` requerida (PROTECT), sin `default_warehouse`.
- **Idempotencia**: si se ejecuta 2 veces, no falla (todo es `get_or_create` con validación).
