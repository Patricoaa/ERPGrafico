# F1.2 — ADR-0031: DEBIT_CARD y CHECKBOOK ya no son tipos de cuenta
# (TreasuryAccount.Type). Pasan a ser formas de pago (PaymentMethod.Type)
# sobre una cuenta CHECKING / CREDIT_CARD. Ver
# docs/50-audit/bancos/fase-1-operativo.md (F1.2) y el command
# `converge_treasury_accounts` (F1.1), que ya dejó 0 cuentas con estos
# valores en todos los entornos (gate duro de F1.2).
#
# No se eliminan datos: si quedara alguna fila con account_type en
# {DEBIT_CARD, CHECKBOOK}, la migración la dejará intacta a nivel DB
# (los choices son validación a nivel ModelForm, no constraint CHECK).
# El command sirve como guardia defensiva en caso de restauración
# posterior.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0049_alter_historicaltreasuryaccount_account_type_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='historicaltreasuryaccount',
            name='account_type',
            field=models.CharField(
                choices=[
                    ('CHECKING', 'Cuenta Bancaria (Corriente/Vista)'),
                    ('CREDIT_CARD', 'Tarjeta de Crédito (Cta. Propia)'),
                    ('CASH', 'Caja Física (Efectivo)'),
                    ('BRIDGE', 'Puente'),
                    ('MERCHANT', 'Cuenta Recaudadora'),
                    ('CHECK_PORTFOLIO', 'Cheques en Cartera'),
                ],
                default='CASH',
                max_length=20,
                verbose_name='Tipo',
            ),
        ),
        migrations.AlterField(
            model_name='treasuryaccount',
            name='account_type',
            field=models.CharField(
                choices=[
                    ('CHECKING', 'Cuenta Bancaria (Corriente/Vista)'),
                    ('CREDIT_CARD', 'Tarjeta de Crédito (Cta. Propia)'),
                    ('CASH', 'Caja Física (Efectivo)'),
                    ('BRIDGE', 'Puente'),
                    ('MERCHANT', 'Cuenta Recaudadora'),
                    ('CHECK_PORTFOLIO', 'Cheques en Cartera'),
                ],
                default='CASH',
                max_length=20,
                verbose_name='Tipo',
            ),
        ),
    ]
