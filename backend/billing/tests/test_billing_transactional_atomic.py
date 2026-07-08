from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model

from billing.services import BillingService
from contacts.models import Contact
from workflow.models import Task
from workflow.services import WorkflowService

User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username="credit", password="x")
    return {"user": user}


@pytest.mark.django_db(transaction=True)
def test_request_credit_approval_rollback(env):
    """
    Si WorkflowService.create_task falla, el @transaction.atomic en
    request_credit_approval revierte cualquier cambio previo.
    """
    customer = Contact.objects.create(name="Cliente Crédito", tax_id="22222222-2")
    task_count_before = Task.objects.count()

    order_data = {
        "customer": customer.id,
        "lines": [{"product": 1, "quantity": 1, "unit_price_gross": 10000}],
    }

    with patch.object(
        WorkflowService, "create_task", side_effect=RuntimeError("Creación de tarea falló")
    ):
        with pytest.raises(RuntimeError):
            BillingService.request_credit_approval(
                order_data=order_data,
                amount=0,
                payment_method="CREDIT",
                full_request_data={},
                requesting_user=env["user"],
            )

    assert Task.objects.count() == task_count_before, (
        "No debe quedar Task huérfano si create_task falla en request_credit_approval"
    )


@pytest.mark.django_db(transaction=True)
def test_request_credit_approval_happy_path(env):
    """
    Flujo feliz: request_credit_approval crea un Task correctamente.
    """
    customer = Contact.objects.create(name="Cliente Crédito 2", tax_id="33333333-3")

    order_data = {
        "customer": customer.id,
        "lines": [{"product": 1, "quantity": 1, "unit_price_gross": 10000}],
    }

    task = BillingService.request_credit_approval(
        order_data=order_data,
        amount=0,
        payment_method="CREDIT",
        full_request_data={},
        requesting_user=env["user"],
    )

    assert task is not None
    assert task.category == Task.Category.APPROVAL
    assert task.task_type == "CREDIT_POS_REQUEST"
