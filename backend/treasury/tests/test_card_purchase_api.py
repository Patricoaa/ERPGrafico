"""
Tests de la API de compras en tarjeta en cuotas (Onda 2,
ADR-0043). Cubre el endpoint `POST /api/treasury/movements/card-purchase/`.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import Account, AccountType
from contacts.models import Contact
from treasury.models import (
    Bank,
    TreasuryAccount,
)

User = get_user_model()


@pytest.fixture
def user(db):
    u = User.objects.create_user(username="cp_api_user", password="x")
    u.is_superuser = True
    u.is_active = True
    u.save()
    return u


@pytest.fixture
def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def bank(db):
    return Bank.objects.create(name="Banco CP API")


@pytest.fixture
def card_account(db, bank):
    liability = Account.objects.create(
        name="Visa API",
        code="2.1.09.500",
        account_type=AccountType.LIABILITY,
    )
    return TreasuryAccount.objects.create(
        name="Visa Cuotas API",
        account=liability,
        bank=bank,
        account_type=TreasuryAccount.Type.CREDIT_CARD,
    )


@pytest.fixture
def supplier(db):
    Account.objects.create(
        name="Prov Cuotas",
        code="2.1.01.050",
        account_type=AccountType.LIABILITY,
    )
    return Contact.objects.create(
        name="Proveedor CP",
        tax_id="76.444.444-4",
    )


def _url():
    return "/api/treasury/movements/card-purchase/"


@pytest.mark.django_db
def test_card_purchase_action_creates_group(auth_client, card_account, supplier):
    """POST /card-purchase/ con 3 cuotas sin interés crea el grupo con
    1 movimiento de uso + un cronograma de 3 cuotas (ADR-0046)."""
    resp = auth_client.post(
        _url(),
        {
            "amount": "90000.00",
            "from_account": card_account.id,
            "installments": 3,
            "monthly_rate": "0",
            "date": "2026-06-15",
            "partner": supplier.id,
            "client_reference": "API-CP-001",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.json()
    data = resp.json()
    assert data["group"]["installments"] == 3
    assert data["group"]["total_amount"] == "90000.00"
    assert data["group"]["client_reference"] == "API-CP-001"
    # `movement` es el uso (1 OUTBOUND por el total).
    assert data["movement"] is not None
    assert Decimal(data["movement"]["amount"]) == Decimal("90000.00")
    # `installments` es ahora el cronograma (filas planas).
    assert len(data["installments"]) == 3
    amounts = [Decimal(i["principal_amount"]) for i in data["installments"]]
    assert sum(amounts) == Decimal("90000.00")
    assert [i["due_date"] for i in data["installments"]] == [
        "2026-06-15",
        "2026-07-15",
        "2026-08-15",
    ]


@pytest.mark.django_db
def test_card_purchase_action_rejects_interest(auth_client, card_account, supplier):
    """POST /card-purchase/ con `monthly_rate > 0` → 400 (diferido)."""
    resp = auth_client.post(
        _url(),
        {
            "amount": "60000.00",
            "from_account": card_account.id,
            "installments": 3,
            "monthly_rate": "0.015",
            "date": "2026-06-15",
            "partner": supplier.id,
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "soportad" in resp.json()["error"]


@pytest.mark.django_db
def test_card_purchase_action_rejects_non_card_account(
    auth_client,
    card_account,
    bank,
):
    """POST con `from_account` que no es CREDIT_CARD → 400."""
    asset = Account.objects.create(
        name="Cta",
        code="1.1.01.900",
        account_type=AccountType.ASSET,
    )
    bank_ta = TreasuryAccount.objects.create(
        name="Banco",
        account=asset,
        bank=bank,
        account_type=TreasuryAccount.Type.CHECKING,
        account_number="1",
    )
    resp = auth_client.post(
        _url(),
        {
            "amount": "10000.00",
            "from_account": bank_ta.id,
            "installments": 1,
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "CREDIT_CARD" in resp.json()["error"]


@pytest.mark.django_db
def test_card_purchase_action_validates_amount(
    auth_client,
    card_account,
):
    """amount <= 0 → 400."""
    resp = auth_client.post(
        _url(),
        {
            "amount": "0",
            "from_account": card_account.id,
            "installments": 1,
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "monto" in resp.json()["error"]


@pytest.mark.django_db
def test_card_purchase_action_idempotent(
    auth_client,
    card_account,
    supplier,
):
    """Dos POSTs con misma `client_reference` no duplican."""
    payload = {
        "amount": "30000.00",
        "from_account": card_account.id,
        "installments": 2,
        "client_reference": "API-IDEM-001",
        "partner": supplier.id,
    }
    r1 = auth_client.post(_url(), payload, format="json")
    r2 = auth_client.post(_url(), payload, format="json")
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["group"]["uuid"] == r2.json()["group"]["uuid"]
    # Sólo 2 movimientos, no 4.
    assert len(r1.json()["installments"]) == 2
    assert len(r2.json()["installments"]) == 2
