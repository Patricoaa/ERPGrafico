"""
T-12: Migrate SaleDelivery and SaleReturn to TransactionalDocument abstract base.

Schema changes (decimal_places already 0 in both models):
  sales_saledelivery:  total_net, total_tax, total — max_digits 12→14
  sales_salereturn:    total_net, total_tax, total — max_digits 12→14

No column added or dropped.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0006_saleorder_transactional_document'),
        ('accounting', '0009_accountingsettings_auto_post_reconciliation_adjustments'),
    ]

    operations = [
        # SaleDelivery
        migrations.AlterField(
            model_name='saledelivery',
            name='total_net',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Neto'),
        ),
        migrations.AlterField(
            model_name='saledelivery',
            name='total_tax',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Impuesto'),
        ),
        migrations.AlterField(
            model_name='saledelivery',
            name='total',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Total'),
        ),
        # SaleReturn
        migrations.AlterField(
            model_name='salereturn',
            name='total_net',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Neto'),
        ),
        migrations.AlterField(
            model_name='salereturn',
            name='total_tax',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Impuesto'),
        ),
        migrations.AlterField(
            model_name='salereturn',
            name='total',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Total'),
        ),
    ]
