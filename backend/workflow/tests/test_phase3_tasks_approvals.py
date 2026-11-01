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
        assigned_to=user,
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
        category=Task.Category.APPROVAL,
        created_by=user,
    )
    completed = WorkflowService.complete_task(task, user)
    assert completed.status == Task.Status.COMPLETED
    assert "self_approval" in getattr(completed, "_sod_warnings", [])

    # TASK-category self-completion must NOT trigger SoD warning
    task_task = Task.objects.create(
        title="Regular task",
        task_type="REGULAR_TASK",
        category=Task.Category.TASK,
        created_by=user,
    )
    completed_task = WorkflowService.complete_task(task_task, user)
    assert completed_task.status == Task.Status.COMPLETED
    assert "self_approval" not in getattr(completed_task, "_sod_warnings", [])


@pytest.mark.django_db
def test_approval_policy_model_creates():
    from workflow.models import ApprovalPolicy

    policy = ApprovalPolicy.objects.create(
        document_type="purchasing.purchaseorder",
        min_amount="50000.00",
        required_permission="purchasing.approve_purchaseorder",
        forbid_self_approval=True,
        approvals_required=2,
    )
    assert policy.pk is not None
    assert policy.document_type == "purchasing.purchaseorder"
    assert policy.forbid_self_approval is True


# ---------------------------------------------------------------------------
# Task 4 — ApprovalPolicy API endpoint
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_approval_policy_api_crud():
    from rest_framework.test import APIClient

    superuser = User.objects.create_superuser(username="ap_admin", password="x")
    client = APIClient()
    client.force_authenticate(user=superuser)

    url = "/api/workflow/approval-policies/"
    res = client.post(url, {
        "document_type": "PURCHASE_ORDER",
        "min_amount": "50000.00",
        "required_permission": "purchasing.approve_purchaseorder",
        "forbid_self_approval": True,
        "approvals_required": 2,
    }, format="json")
    assert res.status_code == 201, res.json()
    assert res.json()["document_type"] == "purchasing.purchaseorder"

    list_res = client.get(url)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1


# ---------------------------------------------------------------------------
# Task 5 — ApprovalPolicy enforced in complete_task
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_no_policy_for_document_type_allows_completion():
    """When no ApprovalPolicy exists for the content_object type, task completes freely."""
    from workflow.models import ApprovalPolicy, Task
    from workflow.services import WorkflowService

    superuser = User.objects.create_superuser(username="ap_super_1", password="x")
    document = Task.objects.create(title="Document", task_type="DOC_NO_POLICY")
    task = Task.objects.create(
        title="Approval Task",
        task_type="TEST_APPROVAL",
        category=Task.Category.APPROVAL,
        content_object=document,
    )
    assert ApprovalPolicy.objects.filter(document_type="Task").count() == 0

    completed = WorkflowService.complete_task(task, superuser)
    assert completed.status == Task.Status.COMPLETED


@pytest.mark.django_db
def test_policy_min_amount_not_met_skips_policy():
    """When document has no 'total', min_amount cannot be satisfied so policy does not apply."""
    from workflow.models import ApprovalPolicy, Task
    from workflow.services import WorkflowService

    user = User.objects.create_user(username="ap_noperm_amount", password="x")
    document = Task.objects.create(title="Doc no total", task_type="DOC_NO_TOTAL")
    task = Task.objects.create(
        title="Approval amount",
        task_type="TEST_APPROVAL",
        category=Task.Category.APPROVAL,
        content_object=document,
        assigned_to=user,
    )
    # Policy requires permission only when amount > 50000; document has no total → skipped
    ApprovalPolicy.objects.create(
        document_type="Task",
        min_amount="50000.00",
        required_permission="workflow.change_task",
    )

    completed = WorkflowService.complete_task(task, user)
    assert completed.status == Task.Status.COMPLETED


@pytest.mark.django_db
def test_policy_required_permission_blocks_without_permission():
    """ApprovalPolicy.required_permission raises PermissionDenied if user lacks it."""
    from rest_framework.exceptions import PermissionDenied
    from workflow.models import ApprovalPolicy, Task
    from workflow.services import WorkflowService

    user = User.objects.create_user(username="ap_noperm_perm", password="x")
    document = Task.objects.create(title="Doc perm", task_type="DOC_PERM")
    task = Task.objects.create(
        title="Approval perm",
        task_type="TEST_APPROVAL",
        category=Task.Category.APPROVAL,
        content_object=document,
        assigned_to=user,
    )
    ApprovalPolicy.objects.create(
        document_type="Task",
        required_permission="workflow.change_task",
    )

    with pytest.raises(PermissionDenied):
        WorkflowService.complete_task(task, user)


@pytest.mark.django_db
def test_policy_required_permission_allows_with_permission():
    """User holding the required ApprovalPolicy permission can complete the task."""
    from django.contrib.auth.models import Permission
    from workflow.models import ApprovalPolicy, Task
    from workflow.services import WorkflowService

    user = User.objects.create_user(username="ap_hasperm_perm", password="x")
    perm = Permission.objects.get(codename="change_task", content_type__app_label="workflow")
    user.user_permissions.add(perm)
    user = User.objects.get(pk=user.pk)  # clear permission cache

    document = Task.objects.create(title="Doc perm ok", task_type="DOC_PERM_OK")
    task = Task.objects.create(
        title="Approval perm ok",
        task_type="TEST_APPROVAL",
        category=Task.Category.APPROVAL,
        content_object=document,
        assigned_to=user,
    )
    ApprovalPolicy.objects.create(
        document_type="Task",
        required_permission="workflow.change_task",
    )

    completed = WorkflowService.complete_task(task, user)
    assert completed.status == Task.Status.COMPLETED


@pytest.mark.django_db
def test_policy_forbid_self_approval_blocks():
    """ApprovalPolicy.forbid_self_approval=True raises PermissionDenied for the creator."""
    from rest_framework.exceptions import PermissionDenied
    from workflow.models import ApprovalPolicy, Task
    from workflow.services import WorkflowService

    user = User.objects.create_superuser(username="ap_selfblock", password="x")
    document = Task.objects.create(title="Doc self", task_type="DOC_SELF")
    task = Task.objects.create(
        title="Approval self",
        task_type="TEST_APPROVAL",
        category=Task.Category.APPROVAL,
        content_object=document,
        created_by=user,
    )
    ApprovalPolicy.objects.create(document_type="Task", forbid_self_approval=True)

    with pytest.raises(PermissionDenied):
        WorkflowService.complete_task(task, user)


@pytest.mark.django_db
def test_policy_forbid_self_approval_allows_different_approver():
    """ApprovalPolicy.forbid_self_approval=True does not block a different approver."""
    from workflow.models import ApprovalPolicy, Task
    from workflow.services import WorkflowService

    creator = User.objects.create_user(username="ap_creator_diff", password="x")
    approver = User.objects.create_superuser(username="ap_approver_diff", password="x")
    document = Task.objects.create(title="Doc diff", task_type="DOC_DIFF")
    task = Task.objects.create(
        title="Approval diff",
        task_type="TEST_APPROVAL",
        category=Task.Category.APPROVAL,
        content_object=document,
        created_by=creator,
    )
    ApprovalPolicy.objects.create(document_type="Task", forbid_self_approval=True)

    completed = WorkflowService.complete_task(task, approver)
    assert completed.status == Task.Status.COMPLETED


@pytest.mark.django_db
def test_policy_approvals_required_completes_after_enough():
    """A second, distinct group member completes a two-approval task."""
    from workflow.models import ApprovalPolicy, Task
    from workflow.services import WorkflowService
    from django.contrib.auth.models import Group

    group = Group.objects.create(name="Two approvers")
    first_approver = User.objects.create_user(username="ap_first_ok", password="x")
    second_approver = User.objects.create_user(username="ap_second_ok", password="x")
    first_approver.groups.add(group)
    second_approver.groups.add(group)
    document = Task.objects.create(title="Doc multi ok", task_type="DOC_MULTI_OK")
    task = Task.objects.create(
        title="Approval multi ok",
        task_type="TEST_APPROVAL",
        category=Task.Category.APPROVAL,
        content_object=document,
        assigned_group=group,
    )
    ApprovalPolicy.objects.create(document_type="Task", approvals_required=2)

    partial = WorkflowService.complete_task(task, first_approver)
    assert partial.status == Task.Status.PENDING
    completed = WorkflowService.complete_task(Task.objects.get(pk=task.pk), second_approver)
    assert completed.status == Task.Status.COMPLETED
