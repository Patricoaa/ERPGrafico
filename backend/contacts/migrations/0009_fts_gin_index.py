from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('contacts', '0008_t23_partners_data_migration'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS contacts_contact_fts_gin
            ON contacts_contact
            USING gin(
                to_tsvector('simple',
                    coalesce(name::text, '') || ' ' ||
                    coalesce(contact_name::text, '') || ' ' ||
                    coalesce(code::text, '')
                )
            );
            """,
            reverse_sql="DROP INDEX IF EXISTS contacts_contact_fts_gin;",
        ),
    ]
