from django.db import migrations, models

_CHOICES = [
    ("CASH", "Efectivo"),
    ("CARD", "Tarjeta"),
    ("TRANSFER", "Transferencia"),
    ("CHECK", "Cheque"),
    ("CREDIT", "Crédito"),
    ("CREDIT_BALANCE", "Saldo a Favor"),
]


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0011_saleorder_payment_method_add_check"),
    ]

    operations = [
        migrations.AlterField(
            model_name="historicalsaleorder",
            name="payment_method",
            field=models.CharField(
                choices=_CHOICES,
                default="CREDIT",
                max_length=20,
                verbose_name="Método de Pago",
            ),
        ),
    ]
