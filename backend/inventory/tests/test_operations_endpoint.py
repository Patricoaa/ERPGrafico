# ruff: noqa: F811  (the env fixture is imported from test_product_stock_flow)
"""GET /api/inventory/products/{id}/operations/"""
import pytest
from rest_framework.test import APIClient

from inventory.tests.test_product_stock_flow import env  # noqa: F401


@pytest.fixture
def client(db):
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_superuser(username="operationsuser", password="password")
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _url(env):
    return f"/api/inventory/products/{env['product'].id}/operations/"


def test_returns_both_sections(env, client):
    response = client.get(_url(env), {"date_from": "2026-01-01", "date_to": "2026-12-31", "idle_days": "30"})
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"rotation", "subscriptions"}
    assert body["rotation"]["idle_days"] == 30 and body["subscriptions"] is None


def test_defaults_applied(env, client):
    assert client.get(_url(env)).status_code == 200


@pytest.mark.parametrize(
    "query",
    [{"idle_days": "0"}, {"idle_days": "366"}, {"idle_days": "abc"}, {"idle_days": "nan"}, {"idle_days": "inf"},
     {"idle_days": "1.5"}, {"date_from": "2026-12-31", "date_to": "2026-01-01"}, {"date_from": "not-a-date"}],
)
def test_invalid_params_return_400(env, client, query):
    assert client.get(_url(env), query).status_code == 400


def test_requires_authentication(env):
    assert APIClient().get(_url(env)).status_code in (401, 403)


def test_unknown_product_returns_404(env, client):
    assert client.get("/api/inventory/products/999999/operations/").status_code == 404
