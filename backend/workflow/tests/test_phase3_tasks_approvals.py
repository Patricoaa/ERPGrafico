"""
Phase 3 — Tasks & Approvals tests.
TaskAssignmentRule.assigned_group FK migration, candidate_group cleanup,
Task.required_permission, ApprovalPolicy model.
"""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group


User = get_user_model()


# ---------------------------------------------------------------------------
# Task 1 — TaskAssignmentRule.assigned_group is a FK
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_task_assignment_rule_assigned_group_is_fk():
    group = Group.objects.create(name="Aprobadores")
    from workflow.models import TaskAssignmentRule
    rule = TaskAssignmentRule.objects.create(
        task_type="TEST_APPROVAL",
        assigned_group=group,
    )
    rule.refresh_from_db()
    assert rule.assigned_group_id == group.pk
    assert rule.assigned_group.name == "Aprobadores"


# ---------------------------------------------------------------------------
# Task 2 — candidate_group JSON → Task.assigned_group FK
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_create_task_uses_assigned_group_fk_not_data():
    """create_task stores pool group in Task.assigned_group FK, not task.data."""
    from workflow.models import Task, TaskAssignmentRule
    from workflow.services import WorkflowService

    group = Group.objects.create(name="Pool Group")
    TaskAssignmentRule.objects.create(task_type="POOL_TASK", assigned_group=group)

    task = WorkflowService.create_task(
        task_type="POOL_TASK",
        title="Test pool task",
        description="",
    )
    assert task.assigned_group == group
    assert "candidate_group" not in (task.data or {})


@pytest.mark.django_db
def test_pool_task_visible_to_group_member():
    from workflow.models import Task, TaskAssignmentRule
    from workflow.services import WorkflowService
    from workflow.selectors import TaskSelectorExt

    group = Group.objects.create(name="Pool Selectors")
    user = User.objects.create_user(username="pool_member", password="x")
    user.groups.add(group)

    TaskAssignmentRule.objects.create(task_type="POOL_SEL_TASK", assigned_group=group)
    task = WorkflowService.create_task(task_type="POOL_SEL_TASK", title="Pool task", description="")

    qs = TaskSelectorExt.get_queryset_for_user(user)
    assert task in qs


# ---------------------------------------------------------------------------
# Task 3 — Task.required_permission + ApprovalPolicy model + SoD warn
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_complete_task_requires_permission():
    from rest_framework.exceptions import PermissionDenied
    from workflow.models import Task
    from workflow.services import WorkflowService

    user = User.objects.create_user(username="low_perm_user", password="x")
    task = Task.objects.create(
        title="Perm task",
        task_type="PERM_TASK",
        required_permission="sales.confirm_salesorder",
    )
    with pytest.raises(PermissionDenied):
        WorkflowService.complete_task(task, user)


@pytest.mark.django_db
def test_complete_task_self_approval_warns_not_blocks():
    from workflow.models import Task
    from workflow.services import WorkflowService

    user = User.objects.create_user(username="creator_user", password="x", is_superuser=True)
    task = Task.objects.create(
        title="Self approval task",
        task_type="SELF_TASK",
        created_by=user,
    )
    completed = WorkflowService.complete_task(task, user)
    assert completed.status == Task.Status.COMPLETED
    assert "self_approval" in getattr(completed, "_sod_warnings", [])


@pytest.mark.django_db
def test_approval_policy_model_creates():
    from workflow.models import ApprovalPolicy

    policy = ApprovalPolicy.objects.create(
        document_type="PURCHASE_ORDER",
        min_amount="50000.00",
        required_permission="purchasing.approve_purchaseorder",
        forbid_self_approval=True,
        approvals_required=2,
    )
    assert policy.pk is not None
    assert policy.document_type == "PURCHASE_ORDER"
    assert policy.forbid_self_approval is True
