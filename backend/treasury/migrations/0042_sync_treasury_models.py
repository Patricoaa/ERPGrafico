from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0041_paymentterminalprovider_iva_account_required'),
    ]

    operations = [
        migrations.AlterField(
            model_name='historicalpaymentmethod',
            name='method_type',
            field=models.CharField(choices=[('CASH', 'Efectivo'), ('CARD', 'Tarjeta'), ('DEBIT_CARD', 'Tarjeta de Débito'), ('CREDIT_CARD', 'Tarjeta de Crédito'), ('CARD_TERMINAL', 'Tarjeta (Terminal Integrado)'), ('TRANSFER', 'Transferencia'), ('CHECK', 'Cheque')], max_length=20, verbose_name='Tipo de Método'),
        ),
        migrations.AlterField(
            model_name='historicaltreasuryaccount',
            name='account_type',
            field=models.CharField(choices=[('CHECKING', 'Cuenta Bancaria (Corriente/Vista)'), ('CREDIT_CARD', 'Tarjeta de Crédito (Cta. Propia)'), ('DEBIT_CARD', 'Tarjeta de Débito (Cta. Propia)'), ('CHECKBOOK', 'Chequera / Instrumentos'), ('CASH', 'Caja Física (Efectivo)'), ('BRIDGE', 'Puente'), ('MERCHANT', 'Cuenta Recaudadora')], default='CASH', max_length=20, verbose_name='Tipo'),
        ),
        migrations.AlterField(
            model_name='paymentmethod',
            name='method_type',
            field=models.CharField(choices=[('CASH', 'Efectivo'), ('CARD', 'Tarjeta'), ('DEBIT_CARD', 'Tarjeta de Débito'), ('CREDIT_CARD', 'Tarjeta de Crédito'), ('CARD_TERMINAL', 'Tarjeta (Terminal Integrado)'), ('TRANSFER', 'Transferencia'), ('CHECK', 'Cheque')], max_length=20, verbose_name='Tipo de Método'),
        ),
        migrations.AlterField(
            model_name='treasuryaccount',
            name='account_type',
            field=models.CharField(choices=[('CHECKING', 'Cuenta Bancaria (Corriente/Vista)'), ('CREDIT_CARD', 'Tarjeta de Crédito (Cta. Propia)'), ('DEBIT_CARD', 'Tarjeta de Débito (Cta. Propia)'), ('CHECKBOOK', 'Chequera / Instrumentos'), ('CASH', 'Caja Física (Efectivo)'), ('BRIDGE', 'Puente'), ('MERCHANT', 'Cuenta Recaudadora')], default='CASH', max_length=20, verbose_name='Tipo'),
        ),
    ]
