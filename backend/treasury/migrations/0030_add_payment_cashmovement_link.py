# Generated manually for treasury integration

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0029_alter_cashmovement_movement_type_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='payment',
            name='cash_movement',
            field=models.OneToOneField(
                blank=True,
                help_text='Vincula este pago a un movimiento físico de efectivo',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='linked_payment',
                to='treasury.cashmovement',
                verbose_name='Movimiento de Efectivo Asociado'
            ),
        ),
        migrations.AddField(
            model_name='cashmovement',
            name='payment',
            field=models.OneToOneField(
                blank=True,
                help_text='Vincula este movimiento a un pago a terceros',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='linked_cash_movement',
                to='treasury.payment',
                verbose_name='Pago Asociado'
            ),
        ),
    ]
