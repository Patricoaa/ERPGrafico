# Generated migration for treasury app

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0035_historicalpaymentmethod_allow_for_purchases_and_more'),
        ('contacts', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='bank',
            name='swift_code',
            field=models.CharField(
                blank=True,
                help_text='Código internacional para transferencias',
                max_length=11,
                null=True,
                verbose_name='Código SWIFT/BIC'
            ),
        ),
        migrations.AddField(
            model_name='bank',
            name='account_executives',
            field=models.ManyToManyField(
                blank=True,
                help_text='Contactos que son ejecutivos de este banco',
                related_name='managed_banks',
                to='contacts.contact',
                verbose_name='Ejecutivos de Cuenta'
            ),
        ),
    ]
