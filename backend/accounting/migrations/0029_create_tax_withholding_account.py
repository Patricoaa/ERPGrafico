from django.db import migrations


def create_account(apps, schema_editor):
    Account = apps.get_model('accounting', 'Account')
    AccountingSettings = apps.get_model('accounting', 'AccountingSettings')

    parent = Account.objects.filter(code='2.1.02').first()
    Account.objects.get_or_create(
        code='2.1.02.08',
        defaults={
            'name': 'Ajuste Conciliación - Retenciones',
            'account_type': 'LIABILITY',
            'parent': parent,
            'is_reconcilable': True,
        }
    )

    settings = AccountingSettings.objects.first()
    if settings:
        account = Account.objects.filter(code='2.1.02.08').first()
        if account:
            settings.tax_withholding_account = account
            settings.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0028_populate_new_ifrs_accounts'),
    ]

    operations = [
        migrations.RunPython(create_account, migrations.RunPython.noop),
    ]
