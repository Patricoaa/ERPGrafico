from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import Account, AccountType, AccountingSettings

User = get_user_model()


@pytest.fixture
def settings_client(db):
    client = APIClient()
    client.force_authenticate(User.objects.create_superuser("credit-settings", "credit@x.cl", "x"))
    return client


@pytest.mark.django_db
def test_sales_settings_current_persists_and_returns_credit_policy(settings_client):
    expense_account = Account.objects.create(
        code="5.9.99",
        name="Gasto Incobrable",
        account_type=AccountType.EXPENSE,
    )
    url = "/api/sales/settings/current/"

    response = settings_client.patch(
        url,
        {
            "pos_default_credit_percentage": "25.50",
            "credit_auto_block_days": 45,
            "default_uncollectible_expense_account": expense_account.pk,
        },
        format="json",
    )

    assert response.status_code == 200, response.data
    settings = AccountingSettings.objects.get()
    assert settings.pos_default_credit_percentage == Decimal("25.50")
    assert settings.credit_auto_block_days == 45
    assert settings.default_uncollectible_expense_account_id == expense_account.pk

    read_response = settings_client.get(url)
    assert read_response.status_code == 200
    assert Decimal(read_response.data["pos_default_credit_percentage"]) == Decimal("25.50")
    assert read_response.data["credit_auto_block_days"] == 45
    assert read_response.data["default_uncollectible_expense_account"] == expense_account.pk


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload",
    [
        {"pos_default_credit_percentage": "100.01"},
        {"pos_default_credit_percentage": "-0.01"},
        {"credit_auto_block_days": 0},
        {"credit_auto_block_days": -1},
    ],
)
def test_sales_settings_current_rejects_invalid_credit_policy(settings_client, payload):
    response = settings_client.patch(
        "/api/sales/settings/current/",
        payload,
        format="json",
    )

    assert response.status_code == 400
    settings = AccountingSettings.objects.get()
    assert settings.pos_default_credit_percentage == Decimal("0")
    assert settings.credit_auto_block_days == 60


@pytest.mark.django_db
def test_sales_settings_current_allows_disabling_automatic_block(settings_client):
    response = settings_client.patch(
        "/api/sales/settings/current/",
        {"credit_auto_block_days": None},
        format="json",
    )

    assert response.status_code == 200, response.data
    settings = AccountingSettings.objects.get()
    assert settings.credit_auto_block_days is None