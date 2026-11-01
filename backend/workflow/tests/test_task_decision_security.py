import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient

from workflow.models import ApprovalPolicy, Task, TaskEvent
from workflow.services import WorkflowService

User = get_user_model()


def _change_task(user):
    permission = Permission.objects.get(
        codename="change_task", content_type__app_label="workflow"
    )
    user.user_permissions.add(permission)
    user.refresh_from_db()
    return user


@pytest.mark.django_db
def test_task_status_and_assignment_cannot_be_changed_with_patch():
    user = User.objects.create_superuser(username="task_patch_admin", password="x")
    task = Task.objects.create(title="Approval", task_type="TEST_APPROVAL")
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.patch(
        f"/api/workflow/tasks/{task.pk}/",
        {"status": Task.Status.COMPLETED, "assigned_to": user.pk},
        format="json",
    )

    task.refresh_from_db()
    assert response.status_code == 400
    assert task.status == Task.Status.PENDING
    assert task.assigned_to is None


@pytest.mark.django_db
def test_generic_task_creation_and_deletion_are_disabled():
    user = User.objects.create_superuser(username="task_lifecycle_admin", password="x")
    client = APIClient()
    client.force_authenticate(user=user)

    create_response = client.post(
        "/api/workflow/tasks/",
        {"title": "Unmanaged approval", "task_type": "TEST_APPROVAL"},
        format="json",
    )
    task = Task.objects.create(title="Approval", task_type="TEST_APPROVAL")
    delete_response = client.delete(f"/api/workflow/tasks/{task.pk}/")

    assert create_response.status_code == 405
    assert delete_response.status_code == 405
    assert Task.objects.filter(pk=task.pk).exists()


@pytest.mark.django_db
def test_creator_cannot_approve_task_assigned_to_another_user_via_api():
    creator = _change_task(User.objects.create_user(username="task_creator", password="x"))
    assignee = User.objects.create_user(username="task_assignee", password="x")
    task = Task.objects.create(
        title="Approval",
        task_type="TEST_APPROVAL",
        category=Task.Category.APPROVAL,
        created_by=creator,
        assigned_to=assignee,
    )
    client = APIClient()
    client.force_authenticate(user=creator)

    response = client.post(f"/api/workflow/tasks/{task.pk}/complete/", {}, format="json")

    task.refresh_from_db()
    assert response.status_code == 403
    assert task.status == Task.Status.PENDING
    assert not TaskEvent.objects.filter(task=task).exists()


@pytest.mark.django_db
def test_multiple_approvals_require_distinct_group_members_and_complete_at_threshold():
    group = Group.objects.create(name="Approval pool")
    first = User.objects.create_user(username="first_approver", password="x")
    second = User.objects.create_user(username="second_approver", password="x")
    first.groups.add(group)
    second.groups.add(group)
    document = Task.objects.create(title="Document", task_type="DOC")
    task = Task.objects.create(
        title="Approval",
        task_type="DOC_APPROVAL",
        category=Task.Category.APPROVAL,
        content_object=document,
        assigned_group=group,
    )
    ApprovalPolicy.objects.create(document_type="Task", approvals_required=2)

    partial = WorkflowService.complete_task(task, first, notes="Primera revisión")
    assert partial.status == Task.Status.PENDING
    assert partial.approvals_received == 1
    assert partial.approvals_required == 2
    assert TaskEvent.objects.filter(task=task, action=TaskEvent.Action.COMPLETED).count() == 1

    with pytest.raises(ValueError, match="Ya registraste"):
        WorkflowService.complete_task(task, first)

    completed = WorkflowService.complete_task(Task.objects.get(pk=task.pk), second)
    assert completed.status == Task.Status.COMPLETED
    assert completed.completed_by == second
    assert TaskEvent.objects.filter(task=task, action=TaskEvent.Action.COMPLETED).count() == 2


@pytest.mark.django_db
def test_sale_order_policy_applies_to_pos_approval_without_persisted_document():
    user = User.objects.create_user(username="pos_policy_approver", password="x")
    task = Task.objects.create(
        title="POS credit request",
        task_type="CREDIT_POS_REQUEST",
        category=Task.Category.APPROVAL,
        assigned_to=user,
        data={"document_type": "sales.saleorder", "document_total": "250000"},
    )
    ApprovalPolicy.objects.create(
        document_type="sales.saleorder",
        min_amount="100000",
        required_permission="workflow.change_task",
    )

    with pytest.raises(PermissionDenied):
        WorkflowService.complete_task(task, user)


@pytest.mark.django_db
def test_direct_pos_approval_respects_self_approval_policy():
    user = User.objects.create_user(username="direct_pos_creator", password="x")
    ApprovalPolicy.objects.create(
        document_type="sales.saleorder",
        forbid_self_approval=True,
    )

    with pytest.raises(PermissionDenied, match="auto-aprobación"):
        WorkflowService.enforce_direct_approval_policy(
            document_type="sales.saleorder",
            amount="1000",
            creator=user,
            user=user,
        )


@pytest.mark.django_db
def test_direct_pos_approval_cannot_bypass_multi_approver_policy():
    approver = User.objects.create_user(username="direct_pos_multi", password="x")
    ApprovalPolicy.objects.create(
        document_type="sales.saleorder",
        approvals_required=2,
    )

    with pytest.raises(PermissionDenied, match="varias personas"):
        WorkflowService.enforce_direct_approval_policy(
            document_type="sales.saleorder",
            amount="1000",
            creator=None,
            user=approver,
        )


@pytest.mark.django_db
def test_multiple_approvals_reject_single_user_assignment():
    user = User.objects.create_superuser(username="single_approver", password="x")
    document = Task.objects.create(title="Document", task_type="DOC")
    task = Task.objects.create(
        title="Approval",
        task_type="DOC_APPROVAL",
        category=Task.Category.APPROVAL,
        content_object=document,
        assigned_to=user,
    )
    ApprovalPolicy.objects.create(document_type="Task", approvals_required=2)

    with pytest.raises(ValueError, match="asigna la tarea a un grupo"):
        WorkflowService.complete_task(task, user)


@pytest.mark.django_db
def test_rejection_is_authorized_and_appended_to_task_history():
    assigned = User.objects.create_user(username="reject_assignee", password="x")
    outsider = User.objects.create_user(username="reject_outsider", password="x")
    task = Task.objects.create(
        title="Credit request",
        task_type="CREDIT_POS_REQUEST",
        category=Task.Category.APPROVAL,
        assigned_to=assigned,
    )

    with pytest.raises(PermissionDenied):
        WorkflowService.reject_task(task=task, user=outsider, notes="No autorizado")

    rejected = WorkflowService.reject_task(
        task=Task.objects.get(pk=task.pk), user=assigned, notes="Antecedentes insuficientes"
    )
    assert rejected.status == Task.Status.REJECTED
    event = TaskEvent.objects.get(task=task)
    assert event.action == TaskEvent.Action.REJECTED
    assert event.user == assigned
    assert event.notes == "Antecedentes insuficientes"


@pytest.mark.django_db
def test_reject_endpoint_requires_assignment_and_records_rejection():
    assigned = _change_task(User.objects.create_user(username="api_reject_assignee", password="x"))
    task = Task.objects.create(
        title="Credit request",
        task_type="CREDIT_POS_REQUEST",
        category=Task.Category.APPROVAL,
        assigned_to=assigned,
    )
    client = APIClient()
    client.force_authenticate(user=assigned)

    response = client.post(
        f"/api/workflow/tasks/{task.pk}/reject/",
        {"notes": "Rechazo de prueba"},
        format="json",
    )

    task.refresh_from_db()
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    assert task.status == Task.Status.REJECTED
    assert TaskEvent.objects.get(task=task).action == TaskEvent.Action.REJECTED