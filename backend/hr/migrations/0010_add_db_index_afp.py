# Generated migration for Phase 1: Add db_index to AFP.is_active
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hr", "0009_remove_absence_deleted_at_remove_afp_created_at_and_more"),
    ]

    operations = [
        # AFP: add db_index=True to existing is_active
        migrations.AlterField(
            model_name="afp",
            name="is_active",
            field=models.BooleanField(
                default=True,
                db_index=True,
                help_text="Desactivar para archivar la AFP; los empleados históricos la siguen referenciando.",
                verbose_name="Activa",
            ),
        ),
    ]