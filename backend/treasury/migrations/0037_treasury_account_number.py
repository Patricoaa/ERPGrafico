# Generated migration for treasury app

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0036_bank_enhancements'),
    ]

    operations = [
        migrations.AddField(
            model_name='treasuryaccount',
            name='account_number',
            field=models.CharField(
                blank=True,
                help_text='Número de cuenta bancaria (solo para cuentas corrientes)',
                max_length=50,
                null=True,
                verbose_name='N° de Cuenta Bancaria'
            ),
        ),
    ]
