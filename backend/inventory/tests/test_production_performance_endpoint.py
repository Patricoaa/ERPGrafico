# ruff: noqa: F811  (the env fixture is imported from test_sales_impact_selector)
"""GET /api/inventory/products/{id}/production-performance/"""
import pytest
from rest_framework.test import APIClient

from inventory.tests.test_sales_impact_selector import env  # noqa: F401


@pytest.fixture
def client(db):
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_superuser(username="perfuser", password="password")
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _url(env):
    return f"/api/inventory/products/{env['product'].id}/production-performance/"


def test_returns_kpis_orders_materials_stages(env, client):
    response = client.get(_url(env), {"date_from": "2026-01-01", "date_to": "2026-12-31"})
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"kpis", "orders", "materials", "stages"}
    assert body["kpis"]["orders"] == 0


def test_defaults_applied(env, client):
    assert client.get(_url(env)).status_code == 200


@pytest.mark.parametrize(
    "query",
    [{"date_from": "2026-12-31", "date_to": "2026-01-01"}, {"date_from": "not-a-date"}, {"date_to": "x"}],
)
def test_invalid_params_return_400(env, client, query):
    assert client.get(_url(env), query).status_code == 400


def test_requires_authentication(env):
    assert APIClient().get(_url(env)).status_code in (401, 403)


def test_unknown_product_returns_404(env, client):
    assert client.get("/api/inventory/products/999999/production-performance/").status_code == 404
