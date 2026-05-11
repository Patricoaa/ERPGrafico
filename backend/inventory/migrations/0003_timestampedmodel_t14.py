"""
T-14: Apply TimeStampedModel to inventory models without timestamps.

Modelos migrados:
  - ProductCategory:       AddField created_at + updated_at. Backfill: now().
  - UoMCategory:           AddField created_at + updated_at. Backfill: now().
  - UoM:                   AddField created_at + updated_at. Backfill: now().
  - ProductAttribute:      created_at ya existía. AddField updated_at. Backfill: created_at.
  - ProductAttributeValue: AddField created_at + updated_at. Backfill: now().
"""
from django.db import migrations, models
from django.utils import timezone


def backfill_product_attribute_updated_at(apps, schema_editor):
    """ProductAttribute ya tenía created_at — usarlo como valor de updated_at."""
    ProductAttribute = apps.get_model('inventory', 'ProductAttribute')
    db = schema_editor.connection.alias
    items = list(ProductAttribute.objects.using(db).all())
    for item in items:
        item.updated_at = item.created_at
    ProductAttribute.objects.using(db).bulk_update(items, ['updated_at'], batch_size=500)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0002_remove_historicalproduct_mfg_default_delivery_days_and_more'),
    ]

    operations = [
        # --- ProductCategory ---
        migrations.AddField(
            model_name='productcategory',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                verbose_name='Creado el',
                default=timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='productcategory',
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                verbose_name='Actualizado el',
            ),
        ),

        # --- UoMCategory ---
        migrations.AddField(
            model_name='uomcategory',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                verbose_name='Creado el',
                default=timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='uomcategory',
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                verbose_name='Actualizado el',
            ),
        ),

        # --- UoM ---
        migrations.AddField(
            model_name='uom',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                verbose_name='Creado el',
                default=timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='uom',
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                verbose_name='Actualizado el',
            ),
        ),

        # --- ProductAttribute: created_at ya existe, añadir verbose_name + updated_at ---
        migrations.AlterField(
            model_name='productattribute',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                verbose_name='Creado el',
            ),
        ),
        migrations.AddField(
            model_name='productattribute',
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                verbose_name='Actualizado el',
            ),
        ),
        migrations.RunPython(
            backfill_product_attribute_updated_at,
            reverse_code=noop_reverse,
        ),

        # --- ProductAttributeValue ---
        migrations.AddField(
            model_name='productattributevalue',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                verbose_name='Creado el',
                default=timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='productattributevalue',
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                verbose_name='Actualizado el',
            ),
        ),
    ]
