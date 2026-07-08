from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("treasury", "0086_refactor_credit_line"),
    ]

    operations = [
        migrations.AddField(
            model_name="historicaltreasuryaccount",
            name="card_number",
            field=models.CharField(
                blank=True,
                help_text="Número de la tarjeta de crédito (solo para tarjetas de crédito)",
                max_length=50,
                null=True,
                verbose_name="Número de Tarjeta",
            ),
        ),
        migrations.AddField(
            model_name="treasuryaccount",
            name="card_number",
            field=models.CharField(
                blank=True,
                help_text="Número de la tarjeta de crédito (solo para tarjetas de crédito)",
                max_length=50,
                null=True,
                verbose_name="Número de Tarjeta",
            ),
        ),
    ]
