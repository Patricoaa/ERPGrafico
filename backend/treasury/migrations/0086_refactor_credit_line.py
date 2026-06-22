import django.core.validators
import django.db.models.deletion
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


def migrate_credit_line_data(apps, schema_editor):
    """Copy approved_amount → credit_limit and link bank → treasury_account."""
    CreditLine = apps.get_model('treasury', 'CreditLine')
    TreasuryAccount = apps.get_model('treasury', 'TreasuryAccount')
    for cl in CreditLine.objects.all():
        # 1. Copy approved_amount to credit_limit
        cl.credit_limit = cl.approved_amount or Decimal('0')
        # 2. Find first CHECKING account for the same bank
        ta = TreasuryAccount.objects.filter(
            bank_id=cl.bank_id,
            account_type='CHECKING',
        ).first()
        cl.treasury_account = ta
        cl.save()


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0085_auto_create_credit_lines_for_existing_banks'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Rename approved_amount → credit_limit (via add + data copy + remove)
        migrations.AddField(
            model_name='creditline',
            name='credit_limit',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Monto máximo autorizado por el banco para esta línea de crédito.', max_digits=18, null=True, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))], verbose_name='Límite de Crédito'),
        ),
        migrations.AddField(
            model_name='creditline',
            name='treasury_account',
            field=models.OneToOneField(blank=True, limit_choices_to={'account_type': 'CHECKING'}, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='credit_line', to='treasury.treasuryaccount', verbose_name='Cuenta Bancaria'),
        ),
        # Remove old composite index before removing bank FK
        migrations.RemoveIndex(
            model_name='creditline',
            name='treasury_cr_bank_id_48b9dc_idx',
        ),
        # Remove BankLoan FK to CreditLine
        migrations.RemoveField(
            model_name='bankloan',
            name='credit_line',
        ),
        migrations.RemoveField(
            model_name='historicalbankloan',
            name='credit_line',
        ),
        # Data migration
        migrations.RunPython(
            migrate_credit_line_data,
            reverse_code=migrations.RunPython.noop,
        ),
        # Make credit_limit non-nullable
        migrations.AlterField(
            model_name='creditline',
            name='credit_limit',
            field=models.DecimalField(decimal_places=2, help_text='Monto máximo autorizado por el banco para esta línea de crédito.', max_digits=18, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))], verbose_name='Límite de Crédito'),
        ),
        # Make treasury_account non-nullable (will fail if any CL has no account)
        migrations.AlterField(
            model_name='creditline',
            name='treasury_account',
            field=models.OneToOneField(limit_choices_to={'account_type': 'CHECKING'}, on_delete=django.db.models.deletion.PROTECT, related_name='credit_line', to='treasury.treasuryaccount', verbose_name='Cuenta Bancaria'),
        ),
        # Add credit_line FK to TreasuryMovement
        migrations.AddField(
            model_name='historicaltreasurymovement',
            name='credit_line',
            field=models.ForeignKey(blank=True, db_constraint=False, null=True, on_delete=django.db.models.deletion.DO_NOTHING, related_name='+', to='treasury.creditline', verbose_name='Línea de Crédito'),
        ),
        migrations.AddField(
            model_name='treasurymovement',
            name='credit_line',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='movements', to='treasury.creditline', verbose_name='Línea de Crédito'),
        ),
        # Update movement_type max_length + choices
        migrations.AlterField(
            model_name='historicaltreasurymovement',
            name='movement_type',
            field=models.CharField(choices=[('INBOUND', 'Entrante (Cobro/Venta)'), ('OUTBOUND', 'Saliente (Pago/Gasto)'), ('TRANSFER', 'Traspaso Interno'), ('ADJUSTMENT', 'Ajuste'), ('CREDIT_LINE_DRAW', 'Disposición Línea de Crédito'), ('CREDIT_LINE_REPAY', 'Abono Línea de Crédito')], max_length=20, verbose_name='Tipo'),
        ),
        migrations.AlterField(
            model_name='treasurymovement',
            name='movement_type',
            field=models.CharField(choices=[('INBOUND', 'Entrante (Cobro/Venta)'), ('OUTBOUND', 'Saliente (Pago/Gasto)'), ('TRANSFER', 'Traspaso Interno'), ('ADJUSTMENT', 'Ajuste'), ('CREDIT_LINE_DRAW', 'Disposición Línea de Crédito'), ('CREDIT_LINE_REPAY', 'Abono Línea de Crédito')], max_length=20, verbose_name='Tipo'),
        ),
        # New composite index
        migrations.AddIndex(
            model_name='creditline',
            index=models.Index(fields=['treasury_account', 'status'], name='treasury_cr_treasur_5902af_idx'),
        ),
        # Remove old fields
        migrations.RemoveField(
            model_name='creditline',
            name='approved_amount',
        ),
        migrations.RemoveField(
            model_name='creditline',
            name='bank',
        ),
        migrations.RemoveField(
            model_name='creditline',
            name='credit_line_type',
        ),
    ]
