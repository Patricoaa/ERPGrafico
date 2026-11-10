from django.db import migrations


def drop_pos_pin_if_exists(apps, schema_editor):
    """Borra ``pos_pin`` solo si la columna existe en la tabla.

    En algunas bases la columna ya no está (esquema modificado fuera de las
    migraciones o restaurado desde un dump posterior) y ``RemoveField`` fallaría
    con ``UndefinedColumn``. Se consulta el esquema real y es portable entre
    Postgres y SQLite.
    """
    connection = schema_editor.connection
    model_names = ("User", "HistoricalUser")
    for model_name in model_names:
        model = apps.get_model("core", model_name)
        table = model._meta.db_table
        with connection.cursor() as cursor:
            columns = {
                col.name
                for col in connection.introspection.get_table_description(cursor, table)
            }
        if "pos_pin" in columns:
            schema_editor.remove_field(model, model._meta.get_field("pos_pin"))


class Migration(migrations.Migration):
    """Elimina el PIN de POS: la venta en caja ya no requiere autorización por PIN."""

    dependencies = [
        ("core", "0017_actionlog_entity_fields_and_new_types"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(drop_pos_pin_if_exists, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.RemoveField(
                    model_name="user",
                    name="pos_pin",
                ),
                migrations.RemoveField(
                    model_name="historicaluser",
                    name="pos_pin",
                ),
            ],
        ),
    ]
