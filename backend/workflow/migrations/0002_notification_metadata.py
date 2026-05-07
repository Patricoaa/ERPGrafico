# Generated manually on 2026-05-07

from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('workflow', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='data',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='notification',
            name='notification_type',
            field=models.CharField(blank=True, db_index=True, max_length=100, verbose_name='Tipo de Evento'),
        ),
    ]
