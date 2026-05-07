"""
T-11: Migrate Invoice to TransactionalDocument abstract base.

Schema changes (all in billing_invoice table):
  - total_net:              max_digits 12→14  (decimal_places already 0)
  - total_tax:              max_digits 12→14
  - total:                  max_digits 12→14
  - total_discount_amount:  max_digits 12→14
  - notes:                  AddField (new column from TransactionalDocument, blank=True)

number is NOT changed: Invoice keeps blank=True / non-unique (folio
can repeat across dte_type). The abstract's unique=True is overridden
by Invoice's explicit redeclaration (no DB constraint added).
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0007_alter_historicalinvoice_dte_type_and_more'),
        ('accounting', '0009_accountingsettings_auto_post_reconciliation_adjustments'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='notes',
            field=models.TextField(blank=True, verbose_name='Notas'),
        ),
        migrations.AlterField(
            model_name='invoice',
            name='total_net',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Neto'),
        ),
        migrations.AlterField(
            model_name='invoice',
            name='total_tax',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Impuesto'),
        ),
        migrations.AlterField(
            model_name='invoice',
            name='total',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Total'),
        ),
        migrations.AlterField(
            model_name='invoice',
            name='total_discount_amount',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=14, verbose_name='Monto Descuento Total'),
        ),
    ]
