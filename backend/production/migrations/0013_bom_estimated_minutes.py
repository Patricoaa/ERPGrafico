from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('production', '0012_scantoken'),
    ]

    operations = [
        migrations.AddField(
            model_name='billofmaterials',
            name='estimated_prepress_min',
            field=models.PositiveIntegerField(default=0, verbose_name='Minutos Pre-Impresión'),
        ),
        migrations.AddField(
            model_name='billofmaterials',
            name='estimated_press_min',
            field=models.PositiveIntegerField(default=0, verbose_name='Minutos Impresión'),
        ),
        migrations.AddField(
            model_name='billofmaterials',
            name='estimated_postpress_min',
            field=models.PositiveIntegerField(default=0, verbose_name='Minutos Post-Impresión'),
        ),
    ]
