"""
T-14: Apply TimeStampedModel to SalesSettings.

Agrega created_at + updated_at. Backfill: now().
"""
from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0007_saledelivery_salereturn_transactional_document'),
    ]

    operations = [
        migrations.AddField(
            model_name='salessettings',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                verbose_name='Creado el',
                default=timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='salessettings',
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                verbose_name='Actualizado el',
            ),
        ),
    ]
