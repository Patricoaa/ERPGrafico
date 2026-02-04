from django.db import migrations, models


def migrate_default_to_allowed(apps, schema_editor):
    """
    Convierte el default_treasury_account existente en el primer
    elemento de allowed_treasury_accounts.
    """
    POSTerminal = apps.get_model('treasury', 'POSTerminal')
    for terminal in POSTerminal.objects.all():
        if terminal.default_treasury_account:
            terminal.allowed_treasury_accounts.add(terminal.default_treasury_account)


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0022_remove_cashmovement_to_container_and_more'),
    ]

    operations = [
        # 1. Crear el ManyToManyField
        migrations.AddField(
            model_name='posterminal',
            name='allowed_treasury_accounts',
            field=models.ManyToManyField(
                help_text='Cuentas que este terminal puede utilizar para registrar pagos',
                related_name='pos_terminals',
                to='treasury.treasuryaccount',
                verbose_name='Cuentas de Tesorería Permitidas'
            ),
        ),
        
        # 2. Migrar datos existentes
        migrations.RunPython(migrate_default_to_allowed, reverse_code=migrations.RunPython.noop),
        
        # 3. Hacer default_treasury_account nullable
        migrations.AlterField(
            model_name='posterminal',
            name='default_treasury_account',
            field=models.ForeignKey(
                blank=True,
                help_text='Cuenta predeterminada al iniciar sesión',
                null=True,
                on_delete=models.PROTECT,
                related_name='default_for_terminals',
                to='treasury.treasuryaccount',
                verbose_name='Cuenta de Tesorería por Defecto'
            ),
        ),
        
        # 4. Eliminar allowed_payment_methods JSONField
        migrations.RemoveField(
            model_name='posterminal',
            name='allowed_payment_methods',
        ),
        
        # 5. Hacer lo mismo para el modelo histórico
        migrations.AddField(
            model_name='historicalposterminal',
            name='allowed_treasury_accounts',
            field=models.ManyToManyField(
                blank=True,
                help_text='Cuentas que este terminal puede utilizar para registrar pagos',
                related_name='+',
                to='treasury.treasuryaccount',
                verbose_name='Cuentas de Tesorería Permitidas'
            ),
        ),
        migrations.AlterField(
            model_name='historicalposterminal',
            name='default_treasury_account',
            field=models.ForeignKey(
                blank=True,
                db_constraint=False,
                help_text='Cuenta predeterminada al iniciar sesión',
                null=True,
                on_delete=models.DO_NOTHING,
                related_name='+',
                to='treasury.treasuryaccount',
                verbose_name='Cuenta de Tesorería por Defecto'
            ),
        ),
        migrations.RemoveField(
            model_name='historicalposterminal',
            name='allowed_payment_methods',
        ),
    ]
