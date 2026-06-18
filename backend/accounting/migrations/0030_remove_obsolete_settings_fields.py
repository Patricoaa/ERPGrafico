# Generated manually — remove fields obsoleted by decision:
# - auto_post_reconciliation_adjustments (siempre POSTED)
# - card_punitory_monthly_rate (sin calculo automatico)
# - card_minimum_payment_block (demasiado granular)
# - billing_model (codigo muerto, nunca implementado)

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0029_create_tax_withholding_account'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='accountingsettings',
            name='auto_post_reconciliation_adjustments',
        ),
        migrations.RemoveField(
            model_name='accountingsettings',
            name='card_punitory_monthly_rate',
        ),
        migrations.RemoveField(
            model_name='accountingsettings',
            name='card_minimum_payment_block',
        ),
        migrations.RemoveField(
            model_name='accountingsettings',
            name='billing_model',
        ),
    ]
