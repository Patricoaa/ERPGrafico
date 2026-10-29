from django.db import migrations


def forwards(apps, schema_editor):
    """One COMPLETED event per already-completed task, so existing approvals show in the history."""
    Task = apps.get_model("workflow", "Task")
    TaskEvent = apps.get_model("workflow", "TaskEvent")
    Attachment = apps.get_model("core", "Attachment")
    ContentType = apps.get_model("contenttypes", "ContentType")

    task_ct = ContentType.objects.filter(app_label="workflow", model="task").first()
    completed = Task.objects.filter(status="COMPLETED").exclude(events__isnull=False)
    for task in completed.iterator():
        attachment_ids = (
            list(Attachment.objects.filter(content_type=task_ct, object_id=task.id).values_list("id", flat=True))
            if task_ct else []
        )
        event = TaskEvent.objects.create(
            task=task,
            action="COMPLETED",
            user_id=task.completed_by_id,
            notes=task.notes or "",
            attachment_ids=attachment_ids,
        )
        if task.completed_at:
            TaskEvent.objects.filter(pk=event.pk).update(created_at=task.completed_at)


def backwards(apps, schema_editor):
    TaskEvent = apps.get_model("workflow", "TaskEvent")
    TaskEvent.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("workflow", "0011_task_event"),
        ("core", "0001_initial"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
