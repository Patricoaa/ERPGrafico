# Generated migration for treasury app

from django.db import migrations, models


def migrate_account_types(apps, schema_editor):
    """Migrar tipos existentes BANK → CHECKING"""
    TreasuryAccount = apps.get_model('treasury', 'TreasuryAccount')
    
    # BANK → CHECKING (por defecto)
    updated_count = TreasuryAccount.objects.filter(account_type='BANK').update(
        account_type='CHECKING'
    )
    print(f"Migrated {updated_count} BANK accounts to CHECKING")
    # CASH permanece igual


def reverse_migration(apps, schema_editor):
    """Revertir migración"""
    TreasuryAccount = apps.get_model('treasury', 'TreasuryAccount')
    TreasuryAccount.objects.filter(account_type='CHECKING').update(
        account_type='BANK'
    )


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0037_treasury_account_number'),
    ]

    operations = [
        migrations.AlterField(
            model_name='treasuryaccount',
            name='account_type',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('CHECKING', 'Cuenta Corriente'),
                    ('CREDIT_CARD', 'Tarjeta de Crédito'),
                    ('DEBIT_CARD', 'Tarjeta de Débito'),
                    ('CHECKBOOK', 'Chequera'),
                    ('CASH', 'Efectivo'),
                ],
                default='CASH',
                verbose_name='Tipo'
            ),
        ),
        migrations.RunPython(migrate_account_types, reverse_migration),
    ]
