from django.db import migrations


class Migration(migrations.Migration):
    """Elimina el PIN de POS: la venta en caja ya no requiere autorización por PIN."""

    dependencies = [
        ("core", "0017_actionlog_entity_fields_and_new_types"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="user",
            name="pos_pin",
        ),
        migrations.RemoveField(
            model_name="historicaluser",
            name="pos_pin",
        ),
    ]
