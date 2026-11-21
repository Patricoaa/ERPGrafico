"""Un fabricable no se puede comprar: corrige los fabricables existentes marcados como comprables.

El reverso no hace nada: no se guarda qué productos tenían el valor anterior y la regla
de ``Product.save`` volvería a fijarlo en falso al siguiente guardado.
"""
from django.db import migrations


def clear_purchasable_manufacturables(apps, schema_editor):
    Product = apps.get_model("inventory", "Product")
    Product.objects.filter(product_type="MANUFACTURABLE", can_be_purchased=True).update(can_be_purchased=False)


class Migration(migrations.Migration):
    dependencies = [("inventory", "0037_historicalproductattribute_is_active_and_more")]

    operations = [migrations.RunPython(clear_purchasable_manufacturables, migrations.RunPython.noop)]
