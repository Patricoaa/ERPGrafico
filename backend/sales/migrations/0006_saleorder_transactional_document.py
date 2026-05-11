"""
T-09: Migrate SaleOrder to TransactionalDocument abstract base.

Schema changes (all in sales_saleorder table):
  - total_net:              max_digits 12→14, decimal_places 2→0
  - total_tax:              max_digits 12→14, decimal_places 2→0
  - total:                  max_digits 12→14, decimal_places 2→0
  - total_discount_amount:  decimal_places 2→0

No column is added or dropped — all fields already existed.
Cast is safe: CLP has no fractional cents (ADR-0014).
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0005_payment_method_ref'),
        ('accounting', '0009_accountingsettings_auto_post_reconciliation_adjustments'),
    ]

    operations = [
        migrations.AlterField(
            model_name='saleorder',
            name='total_net',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Neto'),
        ),
        migrations.AlterField(
            model_name='saleorder',
            name='total_tax',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Impuesto'),
        ),
        migrations.AlterField(
            model_name='saleorder',
            name='total',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Total'),
        ),
        migrations.AlterField(
            model_name='saleorder',
            name='total_discount_amount',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=12, verbose_name='Descuento Total'),
        ),
    ]
