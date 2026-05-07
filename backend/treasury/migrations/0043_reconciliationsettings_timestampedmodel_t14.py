"""
T-14: Apply TimeStampedModel to ReconciliationSettings.

ReconciliationSettings ya tenía updated_at (auto_now=True) y history = HistoricalRecords().
Ahora hereda TimeStampedModel:
  - updated_at: ya existe en DB, mismo parámetro — solo añade verbose_name vía AlterField.
  - created_at: nuevo campo, backfill = now().
"""
from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0042_sync_treasury_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='reconciliationsettings',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                verbose_name='Creado el',
                default=timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='reconciliationsettings',
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                verbose_name='Actualizado el',
            ),
        ),
    ]
