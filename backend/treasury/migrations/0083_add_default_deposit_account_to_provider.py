# Generated manually

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("treasury", "0082_alter_historicalpaymentmethod_method_type_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="historicalpaymentterminalprovider",
            name="default_deposit_account",
            field=models.ForeignKey(
                blank=True,
                db_constraint=False,
                null=True,
                on_delete=django.db.models.deletion.DO_NOTHING,
                related_name="+",
                to="treasury.TreasuryAccount",
                verbose_name="Cuenta de Tesorería por Defecto (Depósito)",
            ),
        ),
        migrations.AddField(
            model_name="paymentterminalprovider",
            name="default_deposit_account",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="treasury.TreasuryAccount",
                verbose_name="Cuenta de Tesorería por Defecto (Depósito)",
            ),
        ),
    ]
