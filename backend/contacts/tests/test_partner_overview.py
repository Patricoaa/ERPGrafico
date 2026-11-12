"""ADR-0133: endpoint partner_overview (alertas, KPIs, composición) de la ficha del socio."""

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from contacts.models import Contact
from contacts.tests.test_partner_endpoints_hardening import _configure_capital, _partner

pytestmark = pytest.mark.django_db
User = get_user_model()


@pytest.fixture
def client():
    api_client = APIClient()
    api_client.force_authenticate(user=User.objects.create_superuser(username="admin", password="x"))
    return api_client


def _url(partner):
    return f"/api/contacts/{partner.pk}/partner_overview/"


def _subscribe(client, partner, amount="1000"):
    r = client.post(
        "/api/contacts/equity_subscription/",
        {"contact_id": partner.pk, "amount": amount, "type": "SUBSCRIPTION", "date": "2026-01-01"},
        format="json",
        headers={"Idempotency-Key": __import__("uuid").uuid4().hex},
    )
    assert r.status_code in (200, 201), r.content


def test_overview_empty_partner_has_zeros_and_no_alerts(client):
    partner = _partner("Ana", 1)
    data = client.get(_url(partner)).json()
    assert data["alerts"] == []
    assert data["kpis"]["pending_capital"] == "0"
    assert data["info"]["contact_id"] == partner.pk
    assert set(data["composition"]) == {"capital", "earnings_balance", "dividends_payable", "provisional_withdrawals"}


def test_overview_alerts_follow_balances(client):
    _configure_capital()
    partner = _partner("Ana", 1)
    _subscribe(client, partner)
    alerts = client.get(_url(partner)).json()["alerts"]
    alert = next(a for a in alerts if a["code"] == "pending_capital")
    assert alert["amount"] == "1000"
    assert alert["action"] == "contribution"
    assert alert["target_tab"] == "capital"


def test_overview_non_partner_returns_400_standard_error(client):
    contact = Contact.objects.create(name="Cliente", tax_id="9999999-9")
    response = client.get(_url(contact))
    assert response.status_code == 400
    assert "message" in response.json()["error"]


def test_overview_requires_permission():
    partner = _partner("Ana", 1)
    anon = APIClient()
    assert anon.get(_url(partner)).status_code in (401, 403)
    user = User.objects.create_user(username="nobody", password="x")
    anon.force_authenticate(user=user)
    assert anon.get(_url(partner)).status_code == 403


def test_overview_query_count_is_fixed(client):
    _configure_capital()

    def count(partner):
        with CaptureQueriesContext(connection) as ctx:
            assert client.get(_url(partner)).status_code == 200
        return len(ctx)

    first = _partner("P1", 1)
    _subscribe(client, first)
    one = count(first)
    for n in range(2, 7):
        p = _partner(f"P{n}", n)
        _subscribe(client, p, "500")
    assert count(first) == one


def test_overview_alert_amounts_match_partner_list_payload(client):
    _configure_capital()
    partner = _partner("Ana", 1)
    _subscribe(client, partner)
    listing = client.get("/api/contacts/partners/").json()
    rows = listing["results"] if isinstance(listing, dict) else listing
    row = next(r for r in rows if r["id"] == partner.pk)
    field = {
        "excess_capital": "partner_excess_capital",
        "pending_capital": "partner_pending_capital",
        "dividends_payable": "partner_dividends_payable_balance",
        "retained_earnings": "partner_earnings_balance",
    }
    alerts = client.get(_url(partner)).json()["alerts"]
    assert alerts
    for a in alerts:
        assert a["amount"] == row[field[a["code"]]]
