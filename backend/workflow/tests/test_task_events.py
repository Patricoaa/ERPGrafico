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
        assigned_to=owner,
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
def test_reopening_partial_multi_approval_starts_a_fresh_cycle(env):
    from django.contrib.auth.models import Group

    from workflow.models import ApprovalPolicy

    first_approver = env["user"]
    second_approver = type(first_approver).objects.create_user(username="second-cycle-approver", password="x")
    group = Group.objects.create(name="Stage approvers")
    first_approver.groups.add(group)
    second_approver.groups.add(group)
    document = first_approver
    task = Task.objects.create(
        title="Aprobar impresión",
        task_type="OT_PRESS_APPROVAL",
        category=Task.Category.APPROVAL,
        content_object=document,
        assigned_group=group,
    )
    ApprovalPolicy.objects.create(document_type="User", approvals_required=2)

    partial = WorkflowService.complete_task(task, first_approver)
    assert partial.status == Task.Status.PENDING

    reset_count = WorkflowService.reset_tasks_for_object(document, ["PRESS"], user=second_approver)
    assert reset_count == 1
    reopened = Task.objects.get(pk=task.pk)
    assert reopened.status == Task.Status.PENDING
    assert reopened.events.order_by("-id").first().action == TaskEvent.Action.REOPENED

    next_cycle_partial = WorkflowService.complete_task(reopened, first_approver)
    assert next_cycle_partial.status == Task.Status.PENDING
    assert next_cycle_partial.approvals_received == 1


@pytest.mark.django_db
def test_reopening_a_rejected_stage_preserves_rejection_and_resets_task(env):
    owner = env["user"]
    task = Task.objects.create(
        title="Aprobar impresión",
        task_type="OT_PRESS_APPROVAL",
        category=Task.Category.APPROVAL,
        content_object=owner,
        assigned_to=owner,
    )

    WorkflowService.reject_task(task=task, user=owner, notes="Corregir evidencia")
    assert Task.objects.get(pk=task.pk).status == Task.Status.REJECTED

    assert WorkflowService.reset_tasks_for_object(owner, ["PRESS"], user=owner) == 1
    task.refresh_from_db()
    assert task.status == Task.Status.PENDING
    assert list(task.events.values_list("action", flat=True)) == ["REJECTED", "REOPENED"]


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
        assigned_to=env["user"],
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
        assigned_to=env["user"],
    )
    WorkflowService.complete_task(task, env["user"])
    task.refresh_from_db()
    assert task.status == Task.Status.COMPLETED
