"""ADR-0132 fase 5: errores de negocio → 400 sin filtrar 500, POST de transacciones separado, sin N+1."""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from accounting.models import Account, AccountingSettings, AccountType
from contacts.models import Contact
from contacts.partner_models import (
    PartnerTransaction,
    ProfitDistributionLine,
    ProfitDistributionLineDestination,
    ProfitDistributionResolution,
)

pytestmark = pytest.mark.django_db
User = get_user_model()


@pytest.fixture
def client():
    api_client = APIClient()
    api_client.force_authenticate(user=User.objects.create_superuser(username="admin", password="x"))
    return api_client


def _key():
    return {"Idempotency-Key": str(uuid.uuid4())}


def _configure_capital():
    settings = AccountingSettings.get_solo()
    settings.partner_capital_social_account = Account.objects.create(
        name="Capital Social", code="3.1.01.900", account_type=AccountType.EQUITY
    )
    settings.partner_capital_receivable_account = Account.objects.create(
        name="Aportes por cobrar", code="1.1.09.900", account_type=AccountType.ASSET
    )
    settings.save()


def _partner(name, n):
    return Contact.objects.create(name=name, tax_id=f"{n}1111111-1", is_partner=True)


def test_invalid_amount_is_a_400_with_the_standard_error_shape(client):
    partner = _partner("Ana", 1)
    response = client.post(
        f"/api/contacts/{partner.pk}/partner_transactions/",
        {"transaction_type": "CAPITAL_CASH", "amount": "abc", "date": "2026-01-01"},
        format="json",
        headers=_key(),
    )
    assert response.status_code == 400
    assert response.json()["error"]["message"] == "Monto inválido."


def test_transfer_with_non_numeric_amount_is_a_400(client):
    a, b = _partner("A", 1), _partner("B", 2)
    response = client.post(
        "/api/contacts/equity_transfer/",
        {"from_contact_id": a.pk, "to_contact_id": b.pk, "amount": "x", "date": "2026-01-01"},
        format="json",
        headers=_key(),
    )
    assert response.status_code == 400


def test_dividend_payment_with_unknown_account_is_a_400_not_a_500(client):
    partner = _partner("Ana", 1)
    response = client.post(
        f"/api/contacts/{partner.pk}/individual_dividend_payment/",
        {"amount": "10", "treasury_account_id": 99999},
        format="json",
        headers=_key(),
    )
    assert response.status_code == 400


def test_unexpected_errors_do_not_leak_their_message(client, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("secreto-interno")

    monkeypatch.setattr("contacts.partner_service.PartnerService.get_global_summary_payload", boom)
    client.raise_request_exception = False
    response = client.get("/api/contacts/partners_summary/")
    assert response.status_code == 500
    assert "secreto-interno" not in response.content.decode()


def test_get_partner_transactions_lists_and_post_is_a_separate_action(client):
    partner = _partner("Ana", 1)
    assert client.get(f"/api/contacts/{partner.pk}/partner_transactions/").status_code == 200
    # método no permitido en otra ruta
    assert client.delete(f"/api/contacts/{partner.pk}/partner_transactions/").status_code == 405


def _distribution_with(n_partners, year, offset=0):
    resolution = ProfitDistributionResolution.objects.create(
        fiscal_year=year, resolution_date=date(2026, 4, 30), net_result=Decimal("1000"), status="EXECUTED"
    )
    for i in range(n_partners):
        partner = _partner(f"P{i + offset}", i + offset)
        line = ProfitDistributionLine.objects.create(
            resolution=resolution, partner=partner, percentage_at_date=Decimal("10"),
            gross_amount=Decimal("100"), net_amount=Decimal("100"),
        )
        ProfitDistributionLineDestination.objects.create(
            line=line, destination=ProfitDistributionLineDestination.Destination.DIVIDEND_PAYABLE, amount=Decimal("100"),
        )
    return resolution


def _count(client, url):
    with CaptureQueriesContext(connection) as ctx:
        assert client.get(url).status_code == 200
    return len(ctx)


@pytest.mark.parametrize("url", [
    "/api/contacts/profit-distributions/",
    "/api/contacts/partners/",
    "/api/contacts/partners_summary/",
])
def test_partner_list_endpoints_have_constant_query_count(client, url):
    _distribution_with(2, 2024)
    small = _count(client, url)
    _distribution_with(6, 2025, offset=10)
    assert _count(client, url) <= small


@pytest.mark.parametrize("path", [
    "/api/contacts/equity_subscription/",
    "/api/contacts/equity_transfer/",
    "/api/contacts/mass_mobilize_retained_earnings/",
    "/api/contacts/1/partner_transactions/",
    "/api/contacts/1/individual_dividend_payment/",
    "/api/contacts/profit-distributions/1/approve/",
    "/api/contacts/profit-distributions/1/execute/",
])
def test_monetary_writes_require_an_idempotency_key(client, path):
    response = client.post(path, {}, format="json")
    assert response.status_code == 400
    assert "Idempotency-Key" in response.json()["detail"]


def test_same_key_replays_the_subscription_once(client):
    _configure_capital()
    partner = _partner("Ana", 1)
    key = _key()
    payload = {"contact_id": partner.pk, "amount": "1000", "type": "SUBSCRIPTION", "date": "2026-01-01"}

    first = client.post("/api/contacts/equity_subscription/", payload, format="json", headers=key)
    second = client.post("/api/contacts/equity_subscription/", payload, format="json", headers=key)

    assert first.status_code == 200 and second.status_code == 200
    assert second.json() == first.json()
    assert PartnerTransaction.objects.filter(partner=partner).count() == 1
