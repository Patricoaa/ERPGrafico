from django.db import migrations


def backfill_assigned_group(apps, schema_editor):
    Task = apps.get_model("workflow", "Task")
    Group = apps.get_model("auth", "Group")

    tasks = Task.objects.filter(assigned_group__isnull=True, data__has_key="candidate_group")
    for task in tasks:
        name = (task.data or {}).get("candidate_group")
        if not name:
            continue
        try:
            group = Group.objects.get(name=name)
            task.assigned_group = group
            task.save(update_fields=["assigned_group"])
        except Group.DoesNotExist:
            pass


class Migration(migrations.Migration):

    dependencies = [
        ("workflow", "0015_task_required_permission_approvalpolicy"),
    ]

    operations = [
        migrations.RunPython(backfill_assigned_group, migrations.RunPython.noop),
    ]
