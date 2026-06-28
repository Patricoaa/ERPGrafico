from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model

from workflow.models import Task
from workflow.services import WorkflowService

User = get_user_model()


@pytest.mark.django_db(transaction=True)
def test_create_task_rollback(env, rule_with_assignee):
    """
    Si notify_assignment falla, el @transaction.atomic en create_task
    revierte la creación del Task.
    """
    task_count_before = Task.objects.count()

    with patch.object(
        WorkflowService, "notify_assignment", side_effect=RuntimeError("Notificación falló")
    ):
        with pytest.raises(RuntimeError):
            WorkflowService.create_task(
                task_type="TEST_TYPE",
                title="Test",
                description="Test",
                created_by=env["user"],
            )

    assert Task.objects.count() == task_count_before, (
        "No debe quedar Task huérfano si notify_assignment falla"
    )


@pytest.mark.django_db(transaction=True)
def test_finalize_task_update_rollback(env, task):
    """
    Si finalize_task_completion falla, el @transaction.atomic en
    finalize_task_update revierte el serializer.save().
    """
    class FakeSerializer:
        def __init__(self, task_instance):
            self.task = task_instance

        def save(self, **kwargs):
            self.task.status = Task.Status.COMPLETED
            self.task.save()
            return self.task

    serializer = FakeSerializer(task)
    old_status = task.status

    with patch.object(
        WorkflowService,
        "finalize_task_completion",
        side_effect=RuntimeError("Completion falló"),
    ):
        with pytest.raises(RuntimeError):
            WorkflowService.finalize_task_update(task, serializer, env["user"])

    task.refresh_from_db()
    assert task.status == old_status, (
        "El status del Task no debe cambiar si finalize_task_completion falla"
    )


@pytest.mark.django_db(transaction=True)
def test_complete_task_rollback_hub(env, task):
    """
    complete_task lanza ValueError para tareas HUB_ antes de escribir
    el Task. El @transaction.atomic no llega a hacer rollback porque no
    hubo escritura, pero verificamos que la protección existe.
    """
    task.task_type = "HUB_STAGE_APPROVAL"
    task.category = Task.Category.TASK
    task.save()
    task_count_before = Task.objects.count()

    with pytest.raises(ValueError, match="etapa del HUB"):
        WorkflowService.complete_task(task, env["user"])

    assert Task.objects.count() == task_count_before
    task.refresh_from_db()
    assert task.status == Task.Status.PENDING


@pytest.mark.django_db(transaction=True)
def test_complete_task_rollback_files(env, task):
    """
    Si send_notification falla después de crear Attachments dentro de
    complete_task (CREDIT_POS_REQUEST), el @transaction.atomic revierte
    todo (Task update + Attachments).
    """
    task.task_type = "CREDIT_POS_REQUEST"
    task.category = Task.Category.APPROVAL
    task.created_by = env["user"]
    task.data = {"request_data": {"draft_id": "abc"}}
    task.save()

    with patch.object(
        WorkflowService, "send_notification", side_effect=RuntimeError("Notificación falló")
    ):
        with pytest.raises(RuntimeError):
            WorkflowService.complete_task(task, env["user"])

    task.refresh_from_db()
    task.refresh_from_db()
    assert task.status == Task.Status.PENDING, (
        "El status del Task debe revertirse si send_notification falla en complete_task"
    )
    assert task.completed_by is None, (
        "completed_by debe revertirse si send_notification falla"
    )


@pytest.mark.django_db
def test_handle_task_update_no_atomic_decorator():
    """handle_task_update NO debe tener @transaction.atomic (se llama desde
    métodos que ya tienen atomic en el borde, evitaría savepoints anidados)."""
    import inspect

    from workflow.services import WorkflowService

    source = inspect.getsource(WorkflowService.handle_task_update)
    assert "@transaction.atomic" not in source, (
        "handle_task_update no debe tener @transaction.atomic"
    )


@pytest.mark.django_db
def test_complete_task_has_atomic_decorator():
    """complete_task DEBE mantener @transaction.atomic."""
    import inspect

    from workflow.services import WorkflowService

    source = inspect.getsource(WorkflowService.complete_task)
    assert "@transaction.atomic" in source, (
        "complete_task debe tener @transaction.atomic"
    )
