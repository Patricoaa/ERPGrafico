from django.db import migrations


def create_gin_index(apps, schema_editor):
    # Solo se ejecuta en PostgreSQL, se salta silenciosamente en SQLite
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS contacts_contact_fts_gin
        ON contacts_contact
        USING gin(
            to_tsvector('simple',
                coalesce(name::text, '') || ' ' ||
                coalesce(contact_name::text, '') || ' ' ||
                coalesce(code::text, '')
            )
        );
    """)


def drop_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("DROP INDEX IF EXISTS contacts_contact_fts_gin;")


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("contacts", "0008_t23_partners_data_migration"),
    ]

    operations = [
        migrations.RunPython(create_gin_index, drop_gin_index),
    ]
