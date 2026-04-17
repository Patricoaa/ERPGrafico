import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0011_payment_request_terminal_batch'),
    ]

    operations = [
        # 1. Ampliar choices de method_type para incluir CARD_TERMINAL
        migrations.AlterField(
            model_name='paymentmethod',
            name='method_type',
            field=models.CharField(
                choices=[
                    ('CASH', 'Efectivo'),
                    ('CARD', 'Tarjeta'),
                    ('DEBIT_CARD', 'Tarjeta de Débito'),
                    ('CREDIT_CARD', 'Tarjeta de Crédito'),
                    ('CARD_TERMINAL', 'Tarjeta (Terminal Integrado)'),
                    ('TRANSFER', 'Transferencia'),
                    ('CHECK', 'Cheque'),
                ],
                max_length=20,
                verbose_name='Tipo de Método',
            ),
        ),
        # También en el modelo histórico
        migrations.AlterField(
            model_name='historicalpaymentmethod',
            name='method_type',
            field=models.CharField(
                choices=[
                    ('CASH', 'Efectivo'),
                    ('CARD', 'Tarjeta'),
                    ('DEBIT_CARD', 'Tarjeta de Débito'),
                    ('CREDIT_CARD', 'Tarjeta de Crédito'),
                    ('CARD_TERMINAL', 'Tarjeta (Terminal Integrado)'),
                    ('TRANSFER', 'Transferencia'),
                    ('CHECK', 'Cheque'),
                ],
                max_length=20,
                verbose_name='Tipo de Método',
            ),
        ),

        # 2. Agregar FK linked_terminal_device
        migrations.AddField(
            model_name='paymentmethod',
            name='linked_terminal_device',
            field=models.ForeignKey(
                blank=True,
                help_text='Solo para CARD_TERMINAL — el device TUU que automatiza este método.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='card_terminal_methods',
                to='treasury.paymentterminaldevice',
                verbose_name='Dispositivo Terminal Vinculado',
            ),
        ),
        migrations.AddField(
            model_name='historicalpaymentmethod',
            name='linked_terminal_device',
            field=models.ForeignKey(
                blank=True,
                db_constraint=False,
                help_text='Solo para CARD_TERMINAL — el device TUU que automatiza este método.',
                null=True,
                on_delete=django.db.models.deletion.DO_NOTHING,
                related_name='+',
                to='treasury.paymentterminaldevice',
                verbose_name='Dispositivo Terminal Vinculado',
            ),
        ),

        # 3. Data migration: DEBIT_CARD y CREDIT_CARD existentes → allow_for_sales=False
        migrations.RunSQL(
            sql="""
                UPDATE treasury_paymentmethod
                SET allow_for_sales = FALSE
                WHERE method_type IN ('DEBIT_CARD', 'CREDIT_CARD');
            """,
            reverse_sql="""
                UPDATE treasury_paymentmethod
                SET allow_for_sales = TRUE
                WHERE method_type IN ('DEBIT_CARD', 'CREDIT_CARD');
            """,
        ),
    ]
