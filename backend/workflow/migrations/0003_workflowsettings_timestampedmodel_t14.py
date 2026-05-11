"""
T-14: Apply TimeStampedModel to WorkflowSettings.

WorkflowSettings ya tenía updated_at (auto_now=True) — ahora heredado de TimeStampedModel.
La columna updated_at ya existe en la DB: Django detectará que no es necesario un AlterField
porque los parámetros son idénticos (auto_now=True).

Se añade created_at con backfill = now().
"""
from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):

    dependencies = [
        ('workflow', '0002_notification_metadata'),
    ]

    operations = [
        # created_at es nuevo; updated_at ya existe y es idéntico al de TimeStampedModel.
        migrations.AddField(
            model_name='workflowsettings',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                verbose_name='Creado el',
                default=timezone.now,
            ),
            preserve_default=False,
        ),
        # AlterField de updated_at para añadir verbose_name (antes era campo manual sin label).
        migrations.AlterField(
            model_name='workflowsettings',
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                verbose_name='Actualizado el',
            ),
        ),
    ]
