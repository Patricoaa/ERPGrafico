import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from inventory.models import UoMCategory, UoM, Product
from django.db import transaction

@transaction.atomic
def seed_uom():
    print("Seeding UoM Categories...")
    cat_unit, _ = UoMCategory.objects.get_or_create(name="Unidad")
    cat_weight, _ = UoMCategory.objects.get_or_create(name="Peso")
    cat_volume, _ = UoMCategory.objects.get_or_create(name="Volumen")
    cat_length, _ = UoMCategory.objects.get_or_create(name="Longitud")
    cat_time, _ = UoMCategory.objects.get_or_create(name="Tiempo de Trabajo")

    print("Seeding Reference UoMs...")
    uom_unit, _ = UoM.objects.get_or_create(
        category=cat_unit, 
        uom_type='REFERENCE', 
        name='Unidades',
        defaults={'ratio': 1.0, 'rounding': 1.0}
    )
    uom_kg, _ = UoM.objects.get_or_create(
        category=cat_weight, 
        uom_type='REFERENCE', 
        name='kg',
        defaults={'ratio': 1.0, 'rounding': 0.00001}
    )
    uom_liter, _ = UoM.objects.get_or_create(
        category=cat_volume, 
        uom_type='REFERENCE', 
        name='Litros',
        defaults={'ratio': 1.0, 'rounding': 0.001}
    )

    print("Seeding Common Conversions...")
    UoM.objects.get_or_create(
        category=cat_unit,
        name="Docena",
        defaults={'uom_type': 'BIGGER', 'ratio': 12.0, 'rounding': 1.0}
    )
    UoM.objects.get_or_create(
        category=cat_weight,
        name="g",
        defaults={'uom_type': 'SMALLER', 'ratio': 0.001, 'rounding': 1.0}
    )
    UoM.objects.get_or_create(
        category=cat_weight,
        name="Ton",
        defaults={'uom_type': 'BIGGER', 'ratio': 1000.0, 'rounding': 0.001}
    )

    print("Updating Existing Products...")
    count = Product.objects.filter(uom__isnull=True).update(uom=uom_unit, purchase_uom=uom_unit)
    print(f"Updated {count} products with default UoM 'Unidades'.")

if __name__ == '__main__':
    seed_uom()
