"""
Migración 0063 — Elimina POSTerminal.allows_check.

Data migration:
  Para cada POSTerminal con allows_check=True, busca (o crea) el PaymentMethod
  CHECK vinculado a la TreasuryAccount CHECK_PORTFOLIO y lo añade al M2M
  allowed_payment_methods, normalizando el patrón al igual que los demás métodos.

Schema:
  Remueve la columna allows_check de posterminal e historicalposterminal.
"""
from django.db import migrations


def wire_check_payment_method(apps, schema_editor):
    POSTerminal = apps.get_model('treasury', 'POSTerminal')
    PaymentMethod = apps.get_model('treasury', 'PaymentMethod')
    TreasuryAccount = apps.get_model('treasury', 'TreasuryAccount')

    portfolio = TreasuryAccount.objects.filter(account_type='CHECK_PORTFOLIO').first()
    if not portfolio:
        return

    check_pm, _ = PaymentMethod.objects.get_or_create(
        method_type='CHECK',
        treasury_account=portfolio,
        defaults={
            'name': 'Cheque en Cartera',
            'allow_for_sales': True,
            'allow_for_purchases': False,
            'is_active': True,
        },
    )

    for terminal in POSTerminal.objects.filter(allows_check=True):
        terminal.allowed_payment_methods.add(check_pm)


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0062_alter_historicaltreasuryaccount_account_type_and_more'),
    ]

    operations = [
        migrations.RunPython(wire_check_payment_method, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='posterminal',
            name='allows_check',
        ),
        migrations.RemoveField(
            model_name='historicalposterminal',
            name='allows_check',
        ),
    ]
