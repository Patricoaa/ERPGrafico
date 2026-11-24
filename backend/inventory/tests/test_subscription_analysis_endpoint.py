# ruff: noqa: F811  (the env fixture is imported from test_product_stock_flow)
"""GET /api/inventory/products/{id}/subscription-analysis/"""
import pytest
from rest_framework.test import APIClient

from inventory.tests.test_operations_selector import _sub_product
from inventory.tests.test_product_stock_flow import env  # noqa: F401


@pytest.fixture
def client(db):
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_superuser(username="subsuser", password="password")
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def test_returns_expected_keys(env, client):
    product = _sub_product(env)
    response = client.get(f"/api/inventory/products/{product.id}/subscription-analysis/", {"date_from": "2026-01-01"})
    assert response.status_code == 200
    assert set(response.json()) == {"today", "kpis", "series", "subscriptions", "payments"}


def test_rejects_unknown_granularity(env, client):
    product = _sub_product(env)
    assert client.get(f"/api/inventory/products/{product.id}/subscription-analysis/", {"granularity": "quarter"}).status_code == 400


def test_rejects_inverted_range(env, client):
    product = _sub_product(env)
    url = f"/api/inventory/products/{product.id}/subscription-analysis/"
    assert client.get(url, {"date_from": "2026-05-01", "date_to": "2026-01-01"}).status_code == 400


def test_unknown_product_is_404(env, client):
    assert client.get("/api/inventory/products/999999/subscription-analysis/").status_code == 404
