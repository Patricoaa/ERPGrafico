import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("treasury", "0029_alter_historicalpaymentallocation_options_and_more"),
        ("purchasing", "0006_purchaseorder_payment_method_add_check"),
    ]

    operations = [
        migrations.AddField(
            model_name="historicalpurchaseorder",
            name="payment_method_ref",
            field=models.ForeignKey(
                blank=True,
                db_constraint=False,
                null=True,
                on_delete=django.db.models.deletion.DO_NOTHING,
                related_name="+",
                to="treasury.paymentmethod",
                verbose_name="Método de Pago (Ref)",
            ),
        ),
        migrations.AddField(
            model_name="purchaseorder",
            name="payment_method_ref",
            field=models.ForeignKey(
                blank=True,
                help_text="FK a treasury.PaymentMethod. Reemplaza el campo legacy payment_method.",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="purchase_orders",
                to="treasury.paymentmethod",
                verbose_name="Método de Pago (Ref)",
            ),
        ),
    ]
