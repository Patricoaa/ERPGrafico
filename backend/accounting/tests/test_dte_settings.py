import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import AccountingSettings

User = get_user_model()


@pytest.fixture
def settings_client(db):
    client = APIClient()
    client.force_authenticate(
        User.objects.create_superuser("dte-settings", "dte@x.cl", "x")
    )
    return client


@pytest.mark.django_db
def test_accounting_settings_updates_emit_and_receive_dte_lists(settings_client):
    response = settings_client.patch(
        "/api/accounting/settings/current/",
        {
            "allowed_dte_types_emit": ["FACTURA", "BOLETA"],
            "allowed_dte_types_receive": ["FACTURA_EXENTA"],
        },
        format="json",
    )

    assert response.status_code == 200, response.data
    settings = AccountingSettings.objects.get()
    assert settings.allowed_dte_types_emit == ["FACTURA", "BOLETA"]
    assert settings.allowed_dte_types_receive == ["FACTURA_EXENTA"]

    read_response = settings_client.get("/api/accounting/settings/current/")
    assert read_response.status_code == 200
    assert read_response.data["allowed_dte_types_emit"] == ["FACTURA", "BOLETA"]
    assert read_response.data["allowed_dte_types_receive"] == ["FACTURA_EXENTA"]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "field,value",
    [
        ("allowed_dte_types_emit", ["FACTURA", "NOT_A_DTE"]),
        ("allowed_dte_types_receive", [42]),
        ("allowed_dte_types_emit", "FACTURA"),
    ],
)
def test_accounting_settings_rejects_malformed_dte_lists(settings_client, field, value):
    response = settings_client.patch(
        "/api/accounting/settings/current/",
        {field: value},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_accounting_settings_patch_requires_accounting_change_permission(db):
    client = APIClient()
    client.force_authenticate(User.objects.create_user("reader", password="x"))

    response = client.patch(
        "/api/accounting/settings/current/",
        {"allowed_dte_types_emit": ["FACTURA"]},
        format="json",
    )

    assert response.status_code == 403
