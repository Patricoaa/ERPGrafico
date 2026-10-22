# Generated migration for Phase 1: Add db_index and help_text to ClosingChecklistTemplate.is_active
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0040_remove_account_created_by_remove_account_deleted_at_and_more"),
    ]

    operations = [
        # ClosingChecklistTemplate: add db_index=True and help_text to existing is_active
        migrations.AlterField(
            model_name="closingchecklisttemplate",
            name="is_active",
            field=models.BooleanField(
                default=True,
                db_index=True,
                help_text="Desactivar para archivar la plantilla de cierre; los cierres históricos la siguen referenciando.",
                verbose_name="Activa",
            ),
        ),
    ]