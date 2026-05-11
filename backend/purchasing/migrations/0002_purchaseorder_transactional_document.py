"""
T-10: Migrate PurchaseOrder to TransactionalDocument abstract base.

Schema changes (all in purchasing_purchaseorder table):
  - total_net: max_digits 12→14  (decimal_places already 0)
  - total_tax: max_digits 12→14
  - total:     max_digits 12→14

No column is added or dropped — all fields already existed.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('purchasing', '0001_initial'),
        ('accounting', '0009_accountingsettings_auto_post_reconciliation_adjustments'),
    ]

    operations = [
        migrations.AlterField(
            model_name='purchaseorder',
            name='total_net',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Neto'),
        ),
        migrations.AlterField(
            model_name='purchaseorder',
            name='total_tax',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Impuesto'),
        ),
        migrations.AlterField(
            model_name='purchaseorder',
            name='total',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Total'),
        ),
    ]
