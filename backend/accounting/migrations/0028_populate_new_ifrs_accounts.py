from django.db import migrations


def create_new_accounts(apps, schema_editor):
    Account = apps.get_model('accounting', 'Account')
    AccountingSettings = apps.get_model('accounting', 'AccountingSettings')

    new_accounts = [
        ('1.1.03.03', 'Inventario de Productos Fabricables', 'ASSET', '1.1.03'),
        ('4.1.03', 'Ingresos por Suscripciones', 'INCOME', '4.1'),
        ('4.2.08', 'Revalorizacion de Stock', 'INCOME', '4.2'),
        ('4.2.09', 'Otros Ingresos Operativos (POS)', 'INCOME', '4.2'),
        ('5.1.04', 'Costo por Suscripciones', 'EXPENSE', '5.1'),
        ('5.2.20', 'Gasto por Mora / Penalizaciones', 'EXPENSE', '5.2'),
        ('5.2.21', 'Gasto por Comision de Apertura', 'EXPENSE', '5.2'),
        ('5.2.22', 'Gasto por Impuesto de Timbres (ITE)', 'EXPENSE', '5.2'),
        ('5.2.23', 'Otros Egresos Operativos (POS)', 'EXPENSE', '5.2'),
        ('5.2.24', 'Error de Vuelto POS', 'EXPENSE', '5.2'),
        ('5.2.25', 'Error de Sistema POS', 'EXPENSE', '5.2'),
        ('5.2.26', 'Gasto Incobrabilidad', 'EXPENSE', '5.2'),
    ]

    for code, name, type_code, parent_code in new_accounts:
        parent = Account.objects.filter(code=parent_code).first()
        Account.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'account_type': type_code,
                'parent': parent,
                'is_reconcilable': True,
            }
        )

    settings = AccountingSettings.objects.first()
    if settings:
        def lookup(code):
            return Account.objects.filter(code=code).first()

        updates = {
            'manufacturable_inventory_account': '1.1.03.03',
            'default_subscription_expense_account': '5.1.04',
            'default_subscription_revenue_account': '4.1.03',
            'revaluation_account': '4.2.08',
            'pos_other_inflow_account': '4.2.09',
            'pos_other_outflow_account': '5.2.23',
            'pos_cashback_error_account': '5.2.24',
            'pos_system_error_account': '5.2.25',
            'loan_penalty_expense_account': '5.2.20',
            'loan_commission_expense_account': '5.2.21',
            'loan_stamp_tax_expense_account': '5.2.22',
            'default_uncollectible_expense_account': '5.2.26',
        }
        for field, code in updates.items():
            account = lookup(code)
            if account:
                setattr(settings, field, account)
        settings.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0027_accountingsettings_hr_account_fields'),
    ]

    operations = [
        migrations.RunPython(create_new_accounts, migrations.RunPython.noop),
    ]
