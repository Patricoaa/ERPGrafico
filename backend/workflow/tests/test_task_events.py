import pytest
from django.contrib.contenttypes.models import ContentType

from workflow.models import Task, TaskEvent
from workflow.serializers import TaskSerializer
from workflow.services import WorkflowService


@pytest.mark.django_db
def test_complete_task_logs_an_event_with_notes(env, task):
    WorkflowService.complete_task(task, env["user"], notes="Colores revisados")

    event = TaskEvent.objects.get(task=task)
    assert event.action == TaskEvent.Action.COMPLETED
    assert event.user == env["user"]
    assert event.notes == "Colores revisados"


@pytest.mark.django_db
def test_reopening_keeps_the_previous_approval_in_the_history(env):
    owner = env["user"]  # any model instance works as the task's object
    ct = ContentType.objects.get_for_model(owner)
    task = Task.objects.create(
        title="Aprobar impresión", task_type="OT_PRESS_APPROVAL", category=Task.Category.APPROVAL,
        content_type=ct, object_id=owner.pk,
    )
    WorkflowService.complete_task(task, owner, notes="OK primera vez")

    WorkflowService.reset_tasks_for_object(owner, ["PRESS"], user=owner)
    WorkflowService.complete_task(Task.objects.get(pk=task.pk), owner, notes="OK segunda vez")

    actions = list(TaskEvent.objects.filter(task=task).values_list("action", "notes"))
    assert actions == [
        ("COMPLETED", "OK primera vez"),
        ("REOPENED", ""),
        ("COMPLETED", "OK segunda vez"),
    ]
    history = TaskSerializer(Task.objects.get(pk=task.pk)).data["events_data"]
    assert [e["action"] for e in history] == ["COMPLETED", "REOPENED", "COMPLETED"]
    assert history[0]["user_name"] == owner.username


@pytest.mark.django_db
def test_design_approval_requires_confirmation_and_evidence(env):
    from django.core.files.uploadedfile import SimpleUploadedFile

    from production.models import WorkOrder

    wo = WorkOrder.objects.create(
        description="OT diseño", status=WorkOrder.Status.IN_PROGRESS, current_stage=WorkOrder.Stage.PREPRESS,
        stage_data={"design_needed": True},
    )
    task = Task.objects.create(
        title="Aprobar pre-impresión", task_type="OT_PREPRESS_APPROVAL", category=Task.Category.APPROVAL,
        content_type=ContentType.objects.get_for_model(wo), object_id=wo.pk,
    )

    with pytest.raises(ValueError, match="cliente aprobó el diseño"):
        WorkflowService.complete_task(task, env["user"], files=[SimpleUploadedFile("ok.pdf", b"x")])
    with pytest.raises(ValueError, match="evidencia"):
        WorkflowService.complete_task(task, env["user"], confirmations={"design_approved": True})

    WorkflowService.complete_task(
        task, env["user"], confirmations={"design_approved": True}, files=[SimpleUploadedFile("ok.pdf", b"x")],
    )
    event = TaskEvent.objects.get(task=task)
    assert event.confirmations == {"design_approved": True}
    assert len(event.attachment_ids) == 1


@pytest.mark.django_db
def test_prepress_without_design_needs_nothing_extra(env):
    from production.models import WorkOrder

    wo = WorkOrder.objects.create(description="OT", status=WorkOrder.Status.IN_PROGRESS, current_stage=WorkOrder.Stage.PREPRESS)
    task = Task.objects.create(
        title="Aprobar pre-impresión", task_type="OT_PREPRESS_APPROVAL", category=Task.Category.APPROVAL,
        content_type=ContentType.objects.get_for_model(wo), object_id=wo.pk,
    )
    WorkflowService.complete_task(task, env["user"])
    task.refresh_from_db()
    assert task.status == Task.Status.COMPLETED
