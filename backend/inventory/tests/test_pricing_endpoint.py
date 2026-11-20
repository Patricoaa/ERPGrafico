# ruff: noqa: F811  (the env fixture is imported from test_sales_impact_selector)
"""GET /api/inventory/products/{id}/pricing/"""
import pytest
from rest_framework.test import APIClient

from inventory.tests.test_sales_impact_selector import _sale, env  # noqa: F401


@pytest.fixture
def client(db):
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_superuser(username="pricinguser", password="password")
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _url(env):
    return f"/api/inventory/products/{env['product'].id}/pricing/"


def test_returns_expected_keys(env, client):
    _sale(env)
    response = client.get(_url(env), {"date_from": "2026-01-01", "date_to": "2026-12-31"})
    assert response.status_code == 200
    assert set(response.json()) == {
        "has_cost", "today", "kpis", "series", "list_price_changes", "rule_windows", "effects",
    }


def test_rejects_unknown_granularity(env, client):
    assert client.get(_url(env), {"granularity": "quarter"}).status_code == 400


def test_rejects_inverted_range(env, client):
    assert client.get(_url(env), {"date_from": "2026-05-01", "date_to": "2026-01-01"}).status_code == 400


def test_unknown_product_is_404(env, client):
    assert client.get("/api/inventory/products/999999/pricing/").status_code == 404
