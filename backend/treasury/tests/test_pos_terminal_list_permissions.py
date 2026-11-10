"""ADR-0123: el listado de cajas POS es legible por cualquier usuario autenticado;
el resto del viewset conserva el RBAC estándar."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from rest_framework.test import APIClient

LIST_URL = "/api/treasury/pos-terminals/"


@pytest.fixture
def ventas_client(db):
    call_command("sync_permissions", verbosity=0)
    user = get_user_model().objects.create_user(username="ventas_terminal", password="x")
    user.groups.add(Group.objects.get(name="Ventas"))
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_ventas_can_list_pos_terminals(ventas_client):
    assert ventas_client.get(LIST_URL).status_code == 200


@pytest.mark.django_db
def test_ventas_cannot_retrieve_pos_terminal(ventas_client):
    assert ventas_client.get(f"{LIST_URL}1/").status_code == 403


@pytest.mark.django_db
def test_ventas_cannot_create_pos_terminal(ventas_client):
    assert ventas_client.post(LIST_URL, {"code": "X1", "name": "X"}, format="json").status_code == 403


@pytest.mark.django_db
def test_anonymous_cannot_list_pos_terminals():
    assert APIClient().get(LIST_URL).status_code in (401, 403)


# ── ADR-0124: lecturas del selector de cobro ────────────────────────────────

@pytest.mark.django_db
def test_ventas_can_reach_allowed_payment_methods(ventas_client):
    # Id inexistente: pasar el permiso significa 404 (no 403).
    assert ventas_client.get(f"{LIST_URL}999999/allowed_payment_methods/").status_code == 404


@pytest.mark.django_db
def test_ventas_cannot_reach_available_accounts(ventas_client):
    assert ventas_client.get(f"{LIST_URL}1/available_accounts/").status_code == 403


@pytest.mark.django_db
def test_ventas_bank_list_hides_executives(ventas_client):
    from treasury.models import Bank

    Bank.objects.create(name="Banco Test", code="BT")
    response = ventas_client.get("/api/treasury/banks/")
    assert response.status_code == 200
    rows = response.json()
    assert rows and set(rows[0]) == {"id", "name", "code", "is_active"}


@pytest.mark.django_db
def test_privileged_bank_list_keeps_executives(db):
    from treasury.models import Bank

    Bank.objects.create(name="Banco Test", code="BT")
    admin = get_user_model().objects.create_superuser("adm_bank", "a@b.cl", "x")
    client = APIClient()
    client.force_authenticate(user=admin)
    rows = client.get("/api/treasury/banks/").json()
    assert "account_executives_details" in rows[0]


@pytest.mark.django_db
def test_ventas_cannot_write_banks(ventas_client):
    assert ventas_client.post("/api/treasury/banks/", {"name": "X", "code": "X"}, format="json").status_code == 403
