"""Tests for durable POS credit approval — Task 2 (idempotency, draft flag, snapshot hash)."""

import pytest
from django.contrib.auth import get_user_model

from billing.services import BillingService
from contacts.models import Contact
from sales.models import DraftCart
from treasury.models import POSSession, POSTerminal, TreasuryAccount
from workflow.models import Task

User = get_user_model()

ORDER_DATA = {
    "customer": None,  # filled in fixture
    "lines": [{"product": 10, "quantity": 2, "unit_price_gross": "500.00"}],
}


@pytest.fixture
def env(db):
    user = User.objects.create_user(username="credit_durable", password="x")
    customer = Contact.objects.create(name="Cliente Durable", tax_id="11111111-1")
    account = TreasuryAccount.objects.create(name="Caja Durable Test", code="1.1.91")
    terminal = POSTerminal.objects.create(
        name="Terminal Durable", default_treasury_account=account
    )
    session = POSSession.objects.create(
        terminal=terminal, treasury_account=account, user=user, opening_balance=0
    )
    draft = DraftCart.objects.create(
        pos_session=session, created_by=user, items=[], session_local_id=1
    )
    return {
        "user": user,
        "customer": customer,
        "session": session,
        "draft": draft,
    }


def _order_data(customer_id):
    return {
        "customer": customer_id,
        "lines": [{"product": 10, "quantity": 2, "unit_price_gross": "500.00"}],
    }


# ─── Idempotency ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_idempotency_returns_existing_task_same_draft_id(env):
    """Two calls with the same draft_id return the same task (no duplicate created)."""
    od = _order_data(env["customer"].id)
    req = {"draft_id": env["draft"].id, "order_data": od}

    task1 = BillingService.request_credit_approval(
        order_data=od, amount=0, payment_method="CREDIT",
        full_request_data=req, requesting_user=env["user"],
    )
    task2 = BillingService.request_credit_approval(
        order_data=od, amount=0, payment_method="CREDIT",
        full_request_data=req, requesting_user=env["user"],
    )

    assert task1.id == task2.id
    assert Task.objects.filter(
        task_type="CREDIT_POS_REQUEST",
        status__in=[Task.Status.PENDING, Task.Status.IN_PROGRESS],
    ).count() == 1


@pytest.mark.django_db
def test_idempotency_creates_new_task_if_existing_completed(env):
    """A COMPLETED task with same draft_id is NOT reused — creates a fresh one."""
    od = _order_data(env["customer"].id)
    req = {"draft_id": env["draft"].id, "order_data": od}

    task1 = BillingService.request_credit_approval(
        order_data=od, amount=0, payment_method="CREDIT",
        full_request_data=req, requesting_user=env["user"],
    )
    task1.status = Task.Status.COMPLETED
    task1.save(update_fields=["status"])

    # Clear protection so we can request again
    env["draft"].has_pending_approval = False
    env["draft"].save(update_fields=["has_pending_approval"])

    task2 = BillingService.request_credit_approval(
        order_data=od, amount=0, payment_method="CREDIT",
        full_request_data=req, requesting_user=env["user"],
    )
    assert task1.id != task2.id


# ─── Draft protection ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_marks_draft_has_pending_approval(env):
    """request_credit_approval sets has_pending_approval=True on the linked draft."""
    od = _order_data(env["customer"].id)
    req = {"draft_id": env["draft"].id, "order_data": od}

    BillingService.request_credit_approval(
        order_data=od, amount=0, payment_method="CREDIT",
        full_request_data=req, requesting_user=env["user"],
    )

    env["draft"].refresh_from_db()
    assert env["draft"].has_pending_approval is True


@pytest.mark.django_db
def test_no_draft_id_does_not_crash(env):
    """request_credit_approval without draft_id still works (no draft to mark)."""
    od = _order_data(env["customer"].id)

    task = BillingService.request_credit_approval(
        order_data=od, amount=0, payment_method="CREDIT",
        full_request_data={}, requesting_user=env["user"],
    )
    assert task is not None
    assert task.task_type == "CREDIT_POS_REQUEST"


# ─── Snapshot hash ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_stores_cart_snapshot_hash(env):
    """task.data must contain cart_snapshot_hash after creation."""
    od = _order_data(env["customer"].id)
    req = {"draft_id": env["draft"].id, "order_data": od}

    task = BillingService.request_credit_approval(
        order_data=od, amount=0, payment_method="CREDIT",
        full_request_data=req, requesting_user=env["user"],
    )

    assert "cart_snapshot_hash" in task.data
    assert len(task.data["cart_snapshot_hash"]) == 64  # sha256 hex


@pytest.mark.django_db
def test_snapshot_hash_is_deterministic(env):
    """Same cart data always produces the same hash."""
    from billing.services import _compute_cart_snapshot_hash

    lines = [{"product": 10, "quantity": 2, "unit_price_gross": "500.00"}]
    h1 = _compute_cart_snapshot_hash(env["customer"].id, lines)
    h2 = _compute_cart_snapshot_hash(env["customer"].id, lines)
    assert h1 == h2


@pytest.mark.django_db
def test_snapshot_hash_differs_for_different_quantities(env):
    """Different quantities → different hash."""
    from billing.services import _compute_cart_snapshot_hash

    h1 = _compute_cart_snapshot_hash(
        env["customer"].id,
        [{"product": 10, "quantity": 2, "unit_price_gross": "500.00"}],
    )
    h2 = _compute_cart_snapshot_hash(
        env["customer"].id,
        [{"product": 10, "quantity": 3, "unit_price_gross": "500.00"}],
    )
    assert h1 != h2


@pytest.mark.django_db
def test_stores_draft_id_in_task_data(env):
    """task.data['draft_id'] matches the draft used in the request."""
    od = _order_data(env["customer"].id)
    req = {"draft_id": env["draft"].id, "order_data": od}

    task = BillingService.request_credit_approval(
        order_data=od, amount=0, payment_method="CREDIT",
        full_request_data=req, requesting_user=env["user"],
    )
    assert task.data["draft_id"] == env["draft"].id
