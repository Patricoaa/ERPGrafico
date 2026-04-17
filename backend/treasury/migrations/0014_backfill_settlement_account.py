"""
F1 data migration: poblar settlement_account para PaymentMethods existentes.

Reglas:
- CARD_TERMINAL con device vinculado → settlement_account = device.provider.bank_treasury_account
- Resto → settlement_account = treasury_account (fallback explícito)

Esto asegura que create_movement use la cuenta correcta sin depender de fallbacks implícitos.
"""
from django.db import migrations


def backfill_settlement_accounts(apps, schema_editor):
    PaymentMethod = apps.get_model('treasury', 'PaymentMethod')

    for pm in PaymentMethod.objects.all():
        if pm.settlement_account_id:
            continue

        if pm.method_type == 'CARD_TERMINAL' and pm.linked_terminal_device_id:
            device = pm.linked_terminal_device
            provider = device.provider
            if provider and provider.bank_treasury_account_id:
                pm.settlement_account_id = provider.bank_treasury_account_id
                pm.save(update_fields=['settlement_account'])
                continue

        # Fallback: copiar treasury_account visible como liquidación.
        if pm.treasury_account_id:
            pm.settlement_account_id = pm.treasury_account_id
            pm.save(update_fields=['settlement_account'])


def reverse_noop(apps, schema_editor):
    PaymentMethod = apps.get_model('treasury', 'PaymentMethod')
    PaymentMethod.objects.update(settlement_account=None)


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0013_settlement_account_and_bridge_types'),
    ]

    operations = [
        migrations.RunPython(backfill_settlement_accounts, reverse_noop),
    ]
