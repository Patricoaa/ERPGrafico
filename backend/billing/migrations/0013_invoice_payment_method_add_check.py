from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0012_fts_gin_index"),
    ]

    operations = [
        migrations.AlterField(
            model_name="invoice",
            name="payment_method",
            field=models.CharField(
                choices=[
                    ("CASH", "Efectivo"),
                    ("CARD", "Tarjeta"),
                    ("TRANSFER", "Transferencia"),
                    ("CHECK", "Cheque"),
                    ("CREDIT", "Crédito"),
                    ("CREDIT_BALANCE", "Saldo a Favor"),
                ],
                default="CREDIT",
                max_length=20,
                verbose_name="Método de Pago",
            ),
        ),
    ]
