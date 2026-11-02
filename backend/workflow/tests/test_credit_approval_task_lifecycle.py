"""Tests for CREDIT_POS_REQUEST task lifecycle — Task 3 (clear draft flag on reject/cancel)."""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model

from sales.models import DraftCart
from treasury.models import POSSession, POSTerminal, TreasuryAccount
from workflow.models import Task
from workflow.services import WorkflowService

User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username="wf_lifecycle", password="x")
    account = TreasuryAccount.objects.create(name="Caja WF Lifecycle", code="1.1.92")
    terminal = POSTerminal.objects.create(name="Terminal WF", default_treasury_account=account)
    session = POSSession.objects.create(
        terminal=terminal, treasury_account=account, user=user, opening_balance=0
    )
    draft = DraftCart.objects.create(
        pos_session=session,
        created_by=user,
        items=[],
        session_local_id=1,
        has_pending_approval=True,
    )
    task = Task.objects.create(
        title="Aprobación Test",
        task_type="CREDIT_POS_REQUEST",
        status=Task.Status.PENDING,
        category=Task.Category.APPROVAL,
        created_by=user,
        data={
            "draft_id": draft.id,
            "customer_id": 1,
            "required_credit": "1000.00",
            "cart_snapshot_hash": "abc123",
        },
    )
    return {"user": user, "draft": draft, "task": task}


@pytest.mark.django_db
def test_rejected_task_clears_draft_has_pending_approval(env):
    """When CREDIT_POS_REQUEST is rejected, has_pending_approval on the draft is cleared."""
    task = env["task"]
    old_status = Task.Status.PENDING

    task.status = Task.Status.REJECTED
    task.save(update_fields=["status"])
    with patch.object(WorkflowService, "send_notification"):
        WorkflowService.handle_task_update(task, old_status)

    env["draft"].refresh_from_db()
    assert env["draft"].has_pending_approval is False


@pytest.mark.django_db
def test_cancelled_task_clears_draft_has_pending_approval(env):
    """When CREDIT_POS_REQUEST is cancelled, has_pending_approval on the draft is cleared."""
    task = env["task"]
    old_status = Task.Status.PENDING

    task.status = Task.Status.CANCELLED
    task.save(update_fields=["status"])
    with patch.object(WorkflowService, "send_notification"):
        WorkflowService.handle_task_update(task, old_status)

    env["draft"].refresh_from_db()
    assert env["draft"].has_pending_approval is False


@pytest.mark.django_db
def test_completed_task_does_not_clear_flag_prematurely(env):
    """When CREDIT_POS_REQUEST is COMPLETED, has_pending_approval stays True (checkout clears it)."""
    task = env["task"]
    old_status = Task.Status.PENDING

    task.status = Task.Status.COMPLETED
    task.save(update_fields=["status"])
    with patch.object(WorkflowService, "send_notification"):
        WorkflowService.handle_task_update(task, old_status)

    env["draft"].refresh_from_db()
    # Checkout is responsible for clearing this flag, not handle_task_update on COMPLETED
    assert env["draft"].has_pending_approval is True


@pytest.mark.django_db
def test_other_task_type_rejection_does_not_touch_draft(env):
    """Rejecting a non-CREDIT_POS_REQUEST task doesn't affect any draft."""
    other_task = Task.objects.create(
        title="Otra tarea",
        task_type="SOME_OTHER_TYPE",
        status=Task.Status.PENDING,
        category=Task.Category.APPROVAL,
        created_by=env["user"],
        data={"draft_id": env["draft"].id},
    )
    old_status = Task.Status.PENDING

    other_task.status = Task.Status.REJECTED
    other_task.save(update_fields=["status"])
    WorkflowService.handle_task_update(other_task, old_status)

    env["draft"].refresh_from_db()
    # Should NOT be cleared — wrong task type
    assert env["draft"].has_pending_approval is True


@pytest.mark.django_db
def test_missing_draft_id_in_task_does_not_crash(env):
    """handle_task_update with a task that has no draft_id doesn't crash."""
    task = Task.objects.create(
        title="Sin draft",
        task_type="CREDIT_POS_REQUEST",
        status=Task.Status.PENDING,
        category=Task.Category.APPROVAL,
        created_by=env["user"],
        data={"customer_id": 1},  # no draft_id
    )
    old_status = Task.Status.PENDING
    task.status = Task.Status.REJECTED
    task.save(update_fields=["status"])

    with patch.object(WorkflowService, "send_notification"):
        # Should not raise
        WorkflowService.handle_task_update(task, old_status)


@pytest.mark.django_db
def test_nonexistent_draft_id_does_not_crash(env):
    """handle_task_update with a draft_id that no longer exists doesn't crash."""
    task = Task.objects.create(
        title="Draft inexistente",
        task_type="CREDIT_POS_REQUEST",
        status=Task.Status.PENDING,
        category=Task.Category.APPROVAL,
        created_by=env["user"],
        data={"draft_id": 999999},  # doesn't exist
    )
    old_status = Task.Status.PENDING
    task.status = Task.Status.REJECTED
    task.save(update_fields=["status"])

    with patch.object(WorkflowService, "send_notification"):
        # Should not raise
        WorkflowService.handle_task_update(task, old_status)
