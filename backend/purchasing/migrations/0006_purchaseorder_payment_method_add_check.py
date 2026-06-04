from django.db import migrations, models

_CHOICES = [
    ('CASH', 'Efectivo'),
    ('CARD', 'Tarjeta'),
    ('TRANSFER', 'Transferencia'),
    ('CHECK', 'Cheque'),
    ('CREDIT', 'Crédito'),
]


class Migration(migrations.Migration):

    dependencies = [
        ('purchasing', '0005_fts_gin_index'),
    ]

    operations = [
        migrations.AlterField(
            model_name='purchaseorder',
            name='payment_method',
            field=models.CharField(
                choices=_CHOICES,
                default='CREDIT',
                max_length=20,
                verbose_name='Método de Pago',
            ),
        ),
        migrations.AlterField(
            model_name='historicalpurchaseorder',
            name='payment_method',
            field=models.CharField(
                choices=_CHOICES,
                default='CREDIT',
                max_length=20,
                verbose_name='Método de Pago',
            ),
        ),
    ]
