# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("treasury", "0059_convert_merchant_to_bridge"),
    ]

    operations = [
        migrations.AddField(
            model_name="possession",
            name="total_check_sales",
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=12, verbose_name="Total Ventas Cheque"
            ),
        ),
        migrations.AddField(
            model_name="historicalpossession",
            name="total_check_sales",
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=12, verbose_name="Total Ventas Cheque"
            ),
        ),
        migrations.AddField(
            model_name="posterminal",
            name="allows_check",
            field=models.BooleanField(
                default=False,
                help_text="Habilita el método de pago 'Cheque' como opción hardcodeada en el POS, sin requerir una cuenta de tesorería vinculada.",
                verbose_name="Permite Cheque",
            ),
        ),
        migrations.AddField(
            model_name="historicalposterminal",
            name="allows_check",
            field=models.BooleanField(
                default=False,
                help_text="Habilita el método de pago 'Cheque' como opción hardcodeada en el POS, sin requerir una cuenta de tesorería vinculada.",
                verbose_name="Permite Cheque",
            ),
        ),
    ]
