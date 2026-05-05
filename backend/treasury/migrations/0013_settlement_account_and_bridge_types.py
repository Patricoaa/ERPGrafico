"""
F1 refactor: arquitectura modular de cobros.

1. TreasuryAccount.account_type: agregar BRIDGE, MERCHANT.
2. TreasuryAccount.account: remover restricción de prefijo 1.1.01 (BRIDGE/MERCHANT usan otras AR).
3. PaymentMethod.settlement_account: FK nuevo.
4. PaymentMethod: remover process_via_terminal y is_terminal (deprecados).
"""
import django.db.models.deletion
from django.db import migrations, models


ACCOUNT_TYPE_CHOICES = [
    ('CHECKING', 'Cuenta Corriente'),
    ('CREDIT_CARD', 'Tarjeta de Crédito'),
    ('DEBIT_CARD', 'Tarjeta de Débito'),
    ('CHECKBOOK', 'Chequera'),
    ('CASH', 'Efectivo'),
    ('BRIDGE', 'Puente'),
    ('MERCHANT', 'Cuenta Recaudadora Pasarela'),
]


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0012_paymentmethod_card_terminal'),
        ('accounting', '0001_initial'),
    ]

    operations = [
        # 1. TreasuryAccount.account_type: nuevas choices
        migrations.AlterField(
            model_name='treasuryaccount',
            name='account_type',
            field=models.CharField(
                choices=ACCOUNT_TYPE_CHOICES,
                default='CASH',
                max_length=20,
                verbose_name='Tipo',
            ),
        ),
        migrations.AlterField(
            model_name='historicaltreasuryaccount',
            name='account_type',
            field=models.CharField(
                choices=ACCOUNT_TYPE_CHOICES,
                default='CASH',
                max_length=20,
                verbose_name='Tipo',
            ),
        ),

        # 2. TreasuryAccount.account: relajar limit_choices_to (solo ASSET)
        migrations.AlterField(
            model_name='treasuryaccount',
            name='account',
            field=models.ForeignKey(
                limit_choices_to={'account_type': 'ASSET'},
                on_delete=django.db.models.deletion.PROTECT,
                related_name='treasury_accounts',
                to='accounting.account',
                verbose_name='Cuenta Contable',
            ),
        ),
        migrations.AlterField(
            model_name='historicaltreasuryaccount',
            name='account',
            field=models.ForeignKey(
                blank=True,
                db_constraint=False,
                limit_choices_to={'account_type': 'ASSET'},
                null=True,
                on_delete=django.db.models.deletion.DO_NOTHING,
                related_name='+',
                to='accounting.account',
                verbose_name='Cuenta Contable',
            ),
        ),

        # 3. PaymentMethod.settlement_account: FK nuevo
        migrations.AddField(
            model_name='paymentmethod',
            name='settlement_account',
            field=models.ForeignKey(
                blank=True,
                help_text='Cuenta destino contable real. Para CARD_TERMINAL: cuenta puente del proveedor.',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='payment_methods_as_settlement',
                to='treasury.treasuryaccount',
                verbose_name='Cuenta de Liquidación',
            ),
        ),
        migrations.AddField(
            model_name='historicalpaymentmethod',
            name='settlement_account',
            field=models.ForeignKey(
                blank=True,
                db_constraint=False,
                help_text='Cuenta destino contable real. Para CARD_TERMINAL: cuenta puente del proveedor.',
                null=True,
                on_delete=django.db.models.deletion.DO_NOTHING,
                related_name='+',
                to='treasury.treasuryaccount',
                verbose_name='Cuenta de Liquidación',
            ),
        ),

        # 4. Actualizar help_text/verbose_name de treasury_account (ahora "visible")
        migrations.AlterField(
            model_name='paymentmethod',
            name='treasury_account',
            field=models.ForeignKey(
                help_text='Cuenta mostrada al operador. Para contabilidad usar effective_settlement_account.',
                on_delete=django.db.models.deletion.CASCADE,
                related_name='payment_methods',
                to='treasury.treasuryaccount',
                verbose_name='Cuenta de Tesorería Visible',
            ),
        ),
        migrations.AlterField(
            model_name='historicalpaymentmethod',
            name='treasury_account',
            field=models.ForeignKey(
                blank=True,
                db_constraint=False,
                help_text='Cuenta mostrada al operador. Para contabilidad usar effective_settlement_account.',
                null=True,
                on_delete=django.db.models.deletion.DO_NOTHING,
                related_name='+',
                to='treasury.treasuryaccount',
                verbose_name='Cuenta de Tesorería Visible',
            ),
        ),

        # 5. Remover campos deprecados
        migrations.RemoveField(
            model_name='paymentmethod',
            name='process_via_terminal',
        ),
        migrations.RemoveField(
            model_name='paymentmethod',
            name='is_terminal',
        ),
        migrations.RemoveField(
            model_name='historicalpaymentmethod',
            name='process_via_terminal',
        ),
        migrations.RemoveField(
            model_name='historicalpaymentmethod',
            name='is_terminal',
        ),
    ]
