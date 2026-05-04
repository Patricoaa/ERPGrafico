from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0037_delete_per_account_settings'),
    ]

    operations = [
        migrations.AddField(
            model_name='terminalbatch',
            name='settlement_movement',
            field=models.OneToOneField(
                blank=True,
                help_text='Movimiento INBOUND creado automáticamente al liquidar el lote',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='settlement_batch',
                to='treasury.treasurymovement',
                verbose_name='Movimiento de Liquidación',
            ),
        ),
        migrations.AddField(
            model_name='historicalterminalbatch',
            name='settlement_movement',
            field=models.ForeignKey(
                blank=True,
                db_constraint=False,
                help_text='Movimiento INBOUND creado automáticamente al liquidar el lote',
                null=True,
                on_delete=django.db.models.deletion.DO_NOTHING,
                related_name='+',
                to='treasury.treasurymovement',
                verbose_name='Movimiento de Liquidación',
            ),
        ),
    ]
