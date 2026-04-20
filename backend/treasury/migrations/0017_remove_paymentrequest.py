from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0016_historicalpaymentterminaldevice_supported_payment_methods_and_more'),
    ]

    operations = [
        migrations.DeleteModel(
            name='HistoricalPaymentRequest',
        ),
        migrations.DeleteModel(
            name='PaymentRequest',
        ),
    ]
