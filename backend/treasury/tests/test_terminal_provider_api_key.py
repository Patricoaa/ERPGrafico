"""API key TUU en proveedores de terminal: escritura cifrada, no exposición y unicidad."""

import json

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from treasury.tests.helpers import make_terminal_provider

URL = "/api/treasury/terminal-providers/"
KEY = "tuu-plain-key-ABC123"


@pytest.fixture
def client(db):
    c = APIClient()
    c.force_authenticate(user=get_user_model().objects.create_superuser(username="pkadmin", password="x"))
    return c


def _tuu(key=None, active=True, name=None):
    p = make_terminal_provider(name=name)
    if key:
        p.set_api_key(key)
    p.is_active = active
    p.save()
    return p


def test_duplicate_tuu_key_rejected(client):
    other = _tuu(KEY, name="TUU Otro")
    mine = _tuu()
    resp = client.patch(f"{URL}{mine.pk}/", {"api_key": KEY}, format="json")
    assert resp.status_code == 400
    assert resp.json()["error"]["details"]["api_key"] == [f"Esta API key ya está asignada al proveedor {other.name}."]


def test_same_key_allowed_when_other_inactive(client):
    _tuu(KEY, active=False)
    mine = _tuu()
    resp = client.patch(f"{URL}{mine.pk}/", {"api_key": KEY}, format="json")
    assert resp.status_code == 200
    mine.refresh_from_db()
    assert mine.get_api_key() == KEY


def test_editing_own_key_allowed(client):
    mine = _tuu(KEY)
    resp = client.patch(f"{URL}{mine.pk}/", {"api_key": KEY, "notes": "x"}, format="json")
    assert resp.status_code == 200


def test_api_key_never_returned(client):
    base = _tuu()
    payload = {
        "name": "TUU Nuevo",
        "provider_type": "TUU",
        "supplier": base.supplier_id,
        "receivable_account": base.receivable_account_id,
        "commission_expense_account": base.commission_expense_account_id,
        "commission_iva_account": base.commission_iva_account_id,
        "api_key": KEY,
    }
    resp = client.post(URL, payload, format="json")
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["has_api_key"] is True
    assert "api_key" not in body
    assert "gateway_config" not in body
    assert "api_key_encrypted" not in json.dumps(body)
    assert KEY not in json.dumps(body)
    listing = client.get(URL)
    assert KEY not in listing.content.decode()
    assert "api_key_encrypted" not in listing.content.decode()


def test_blank_api_key_keeps_existing(client):
    mine = _tuu(KEY)
    for value in ("", "   "):
        resp = client.patch(f"{URL}{mine.pk}/", {"api_key": value}, format="json")
        assert resp.status_code == 200
    resp = client.patch(f"{URL}{mine.pk}/", {"name": "Renombrado"}, format="json")
    assert resp.status_code == 200
    mine.refresh_from_db()
    assert mine.get_api_key() == KEY
    assert resp.json()["has_api_key"] is True
