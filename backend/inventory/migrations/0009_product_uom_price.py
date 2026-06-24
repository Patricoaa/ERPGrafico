import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0008_product_price_inheritance"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProductUoMPrice",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "price_net",
                    models.DecimalField(
                        decimal_places=0,
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(0)],
                        verbose_name="Precio Neto",
                    ),
                ),
                (
                    "price_gross",
                    models.DecimalField(
                        decimal_places=0,
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(0)],
                        verbose_name="Precio Bruto",
                    ),
                ),
                (
                    "product",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="uom_prices",
                        to="inventory.product",
                        verbose_name="Producto",
                    ),
                ),
                (
                    "uom",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        to="inventory.uom",
                        verbose_name="Unidad de Medida",
                    ),
                ),
            ],
            options={
                "verbose_name": "Precio por UoM",
                "verbose_name_plural": "Precios por UoM",
                "unique_together": {("product", "uom")},
            },
        ),
    ]
