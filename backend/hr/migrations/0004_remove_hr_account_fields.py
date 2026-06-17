from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('hr', '0003_fts_gin_index'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='globalhrsettings',
            name='account_anticipos',
        ),
        migrations.RemoveField(
            model_name='globalhrsettings',
            name='account_previred_por_pagar',
        ),
        migrations.RemoveField(
            model_name='globalhrsettings',
            name='account_remuneraciones_por_pagar',
        ),
    ]
