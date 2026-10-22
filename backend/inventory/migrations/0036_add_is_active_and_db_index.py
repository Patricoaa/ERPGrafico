# Generated migration for Phase 1: Add is_active to ProductAttribute and db_index/help_text to others
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0035_fix_track_inventory_non_stock_products"),
    ]

    operations = [
        # ProductAttribute: add is_active BooleanField
        migrations.AddField(
            model_name="productattribute",
            name="is_active",
            field=models.BooleanField(
                default=True,
                db_index=True,
                help_text="Desactivar para archivar el atributo; los productos históricos lo siguen referenciando.",
                verbose_name="Activo",
            ),
        ),
        # Location: add db_index=True to existing is_active
        migrations.AlterField(
            model_name="location",
            name="is_active",
            field=models.BooleanField(
                default=True,
                db_index=True,
                help_text="Desactivar para archivar la ubicación; los movimientos de stock históricos la siguen referenciando.",
                verbose_name="Activa",
            ),
        ),
        # UoM: add help_text
        migrations.AlterField(
            model_name="uom",
            name="is_active",
            field=models.BooleanField(
                default=True,
                db_index=True,
                help_text="Desactivar para archivar la unidad de medida; los productos históricos la siguen referenciando.",
                verbose_name="Activo",
            ),
        ),
        # UoMCategory: add help_text
        migrations.AlterField(
            model_name="uomcategory",
            name="is_active",
            field=models.BooleanField(
                default=True,
                db_index=True,
                help_text="Desactivar para archivar la categoría de medida; las unidades históricas la siguen referenciando.",
                verbose_name="Activo",
            ),
        ),
    ]