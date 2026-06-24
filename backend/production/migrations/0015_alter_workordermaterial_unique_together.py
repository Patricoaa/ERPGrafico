# Originally auto-generated to alter unique_together for workordermaterial.
# The underlying unique constraint was already dropped by migration 0006's
# RunPython remove_unique_together, but that RunPython did not update Django's
# migration state graph, so the state still records the old unique_together.
# On fresh databases the original AlterUniqueTogether fails with:
#   ValueError: Found wrong number (0) of constraints for
#   production_workordermaterial(work_order_id, component_id)
# because the composed index is gone.
#
# The model has no unique_together (it uses a UniqueConstraint instead), so
# we only need to update the state graph. SeparateDatabaseAndState lets us
# do that without touching the schema.

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("production", "0014_remove_specifications_field"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterUniqueTogether(
                    name="workordermaterial",
                    unique_together=set(),
                ),
            ],
        ),
    ]
