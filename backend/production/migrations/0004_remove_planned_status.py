from django.db import migrations


def migrate_planned_to_draft(apps, schema_editor):
    WorkOrder = apps.get_model('production', 'WorkOrder')
    count = WorkOrder.objects.filter(status='PLANNED').update(status='DRAFT')
    if count:
        print(f"  Converted {count} PLANNED OT(s) to DRAFT.")


class Migration(migrations.Migration):

    dependencies = [
        ('production', '0003_fts_gin_index'),
    ]

    operations = [
        migrations.RunPython(migrate_planned_to_draft, migrations.RunPython.noop),
    ]
