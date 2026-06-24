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
        ("billing", "0013_invoice_payment_method_add_check"),
    ]

    operations = [
        migrations.AlterField(
            model_name="historicalinvoice",
            name="payment_method",
            field=models.CharField(
                choices=_CHOICES,
                default="CREDIT",
                max_length=20,
                verbose_name="Método de Pago",
            ),
        ),
    ]
