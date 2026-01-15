# Generated manually for accounting restructuring

from django.db import migrations, models
import django.db.models.deletion


def populate_new_inventory_accounts(apps, schema_editor):
    """
    Migración de datos: Copiar cuenta actual a nuevos campos
    """
    AccountingSettings = apps.get_model('accounting', 'AccountingSettings')
    settings = AccountingSettings.objects.first()
    
    if settings and settings.default_inventory_account:
        # Asignar misma cuenta a todos los tipos
        settings.storable_inventory_account = settings.default_inventory_account
        settings.manufacturable_inventory_account = settings.default_inventory_account
        settings.save()
        print(f"✓ Cuentas de inventario inicializadas a: {settings.default_inventory_account.code}")
    else:
        print("⚠ No se encontró configuración contable o cuenta de inventario")


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0022_accountingsettings_default_service_expense_account'),
    ]

    operations = [
        migrations.AddField(
            model_name='accountingsettings',
            name='storable_inventory_account',
            field=models.ForeignKey(
                blank=True,
                help_text='Cuenta para productos STORABLE (ej: 1.1.03.01)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='settings_storable_inventory',
                to='accounting.account',
                verbose_name='Cuenta Inventario Almacenables'
            ),
        ),
        migrations.AddField(
            model_name='accountingsettings',
            name='manufacturable_inventory_account',
            field=models.ForeignKey(
                blank=True,
                help_text='Cuenta para productos MANUFACTURABLE (ej: 1.1.03.01)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='settings_manufacturable_inventory',
                to='accounting.account',
                verbose_name='Cuenta Inventario Fabricables'
            ),
        ),
        migrations.RunPython(populate_new_inventory_accounts),
    ]
