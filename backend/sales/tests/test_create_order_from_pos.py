"""
Tests para SalesService.create_sale_order_from_pos.
Verifica atomicidad transaccional y manejo de errores.
"""

from decimal import Decimal
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework.exceptions import PermissionDenied

from contacts.models import Contact
from sales.models import SaleOrder
from sales.services import SalesService
from treasury.models import POSSession

User = get_user_model()


@pytest.fixture
def env(db):
    cashier = User.objects.create_user(username="cashier", password="x")
    buyer = User.objects.create_user(username="buyer", password="x")
    session = POSSession.objects.create(user=cashier)
    customer = Contact.objects.create(name="Cliente POS", tax_id="33333333-3")
    return {
        "cashier": cashier,
        "buyer": buyer,
        "session": session,
        "customer": customer,
    }


def _build_data(env, **overrides):
    """Construye data mínima para create_sale_order_from_pos."""
    data = {"pos_session_id": env["session"].id, "customer": env["customer"].id}
    data.update(overrides)
    return data


def _make_serializer(order):
    """Crea un mock de serializer que valida y retorna la orden dada."""
    class FakeSerializer:
        def is_valid(self, raise_exception=True):
            return True

        def save(self, **kwargs):
            for key, value in kwargs.items():
                setattr(order, key, value)
            order.save()
            return order

    return FakeSerializer()


@pytest.mark.django_db(transaction=True)
def test_rollback_on_confirm_failure(env):
    """
    Si confirm_sale falla con ValidationError, la transacción completa
    se revierte y no queda ninguna SaleOrder huérfana en la base de datos.
    """
    order_count_before = SaleOrder.objects.count()
    data = _build_data(env)
    serializer = _make_serializer(SaleOrder(customer=env["customer"]))

    with patch.object(SalesService, "confirm_sale", side_effect=ValidationError("Error simulado")):
        with pytest.raises(ValidationError):
            SalesService.create_sale_order_from_pos(
                user=env["buyer"],
                data=data,
                files={},
                serializer=serializer,
            )

    assert SaleOrder.objects.count() == order_count_before, (
        "No debe quedar orden huérfana si confirm_sale falla"
    )


@pytest.mark.django_db(transaction=True)
def test_rollback_on_permission_denied(env):
    """
    Si confirm_sale falla con PermissionDenied, la transacción completa
    se revierte y no queda ninguna SaleOrder huérfana.
    """
    order_count_before = SaleOrder.objects.count()
    data = _build_data(env)
    serializer = _make_serializer(SaleOrder(customer=env["customer"]))

    with patch.object(SalesService, "confirm_sale", side_effect=PermissionDenied("Error simulado")):
        with pytest.raises(PermissionDenied):
            SalesService.create_sale_order_from_pos(
                user=env["buyer"],
                data=data,
                files={},
                serializer=serializer,
            )

    assert SaleOrder.objects.count() == order_count_before, (
        "No debe quedar orden huérfana si confirm_sale falla con PermissionDenied"
    )


@pytest.mark.django_db(transaction=True)
def test_rollback_on_confirm_generic_exception(env):
    """
    Si confirm_sale falla con Exception genérica, la transacción completa
    se revierte (cubre el caso donde no sea ValidationError).
    """
    order_count_before = SaleOrder.objects.count()
    data = _build_data(env)
    serializer = _make_serializer(SaleOrder(customer=env["customer"]))

    with patch.object(SalesService, "confirm_sale", side_effect=RuntimeError("Fallo interno")):
        with pytest.raises(RuntimeError):
            SalesService.create_sale_order_from_pos(
                user=env["buyer"],
                data=data,
                files={},
                serializer=serializer,
            )

    assert SaleOrder.objects.count() == order_count_before, (
        "No debe quedar orden huérfana si confirm_sale falla con excepción genérica"
    )


@pytest.mark.django_db(transaction=True)
def test_happy_path(env):
    """Flujo feliz: crea la orden y llama a confirm_sale."""
    order_count_before = SaleOrder.objects.count()
    data = _build_data(env)
    serializer = _make_serializer(SaleOrder(customer=env["customer"]))

    with patch.object(SalesService, "confirm_sale", return_value=None) as mock_confirm:
        order = SalesService.create_sale_order_from_pos(
            user=env["buyer"],
            data=data,
            files={},
            serializer=serializer,
        )

    assert SaleOrder.objects.count() == order_count_before + 1
    assert order.pk is not None
    assert order.customer == env["customer"]
    assert order.pos_session == env["session"]
    mock_confirm.assert_called_once()


@pytest.mark.django_db(transaction=True)
def test_invalid_session_raises(env):
    """ID de sesión POS inválida → ValidationError, sin orden persistida."""
    order_count_before = SaleOrder.objects.count()
    data = _build_data(env, pos_session_id=99999)
    serializer = _make_serializer(SaleOrder(customer=env["customer"]))

    with pytest.raises(ValidationError, match="no es válida"):
        SalesService.create_sale_order_from_pos(
            user=env["buyer"],
            data=data,
            files={},
            serializer=serializer,
        )

    assert SaleOrder.objects.count() == order_count_before


@pytest.mark.django_db(transaction=True)
def test_same_user_requires_pin(env):
    """Si user == session.user y no hay pos_pin → PermissionDenied."""
    order_count_before = SaleOrder.objects.count()
    data = _build_data(env)
    serializer = _make_serializer(SaleOrder(customer=env["customer"]))

    with pytest.raises(PermissionDenied, match="PIN"):
        SalesService.create_sale_order_from_pos(
            user=env["cashier"],
            data=data,
            files={},
            serializer=serializer,
        )

    assert SaleOrder.objects.count() == order_count_before


@pytest.mark.django_db(transaction=True)
def test_pos_pin_bypasses_same_user_check(env):
    """Si user == session.user pero se provee un PIN → pasa la validación."""
    data = _build_data(env, pos_pin="1234")
    serializer = _make_serializer(SaleOrder(customer=env["customer"]))

    with patch.object(SalesService, "confirm_sale", return_value=None):
        with patch("core.services.PINService.validate_pin", return_value=env["cashier"]):
            order = SalesService.create_sale_order_from_pos(
                user=env["cashier"],
                data=data,
                files={},
                serializer=serializer,
            )

    assert order.pk is not None
    assert order.salesperson == env["cashier"]
