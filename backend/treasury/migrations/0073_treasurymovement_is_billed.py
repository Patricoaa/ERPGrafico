from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0072_from_card_statement'),
    ]

    operations = [
        migrations.AddField(
            model_name='treasurymovement',
            name='is_billed',
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text='True si este cargo ya fue incluido en un CreditCardStatement.',
                verbose_name='Facturado',
            ),
        ),
    ]
