# ruff: noqa: F811  (the env fixture is imported from test_sales_impact_selector)
"""GET /api/inventory/products/{id}/sales-impact/"""
import pytest
from rest_framework.test import APIClient

from inventory.tests.test_sales_impact_selector import _sale, env  # noqa: F401


@pytest.fixture
def client(db):
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_superuser(username="impactuser", password="password")
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _url(env):
    return f"/api/inventory/products/{env['product'].id}/sales-impact/"


def test_returns_series_table_totals_coverage(env, client):
    _sale(env, qty="10", price="1000", gross="1190", discount="1190")
    response = client.get(_url(env), {"date_from": "2026-01-01", "date_to": "2026-12-31"})
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"series", "segments", "table", "totals", "returns", "coverage", "rule_windows"}
    assert body["totals"]["net_revenue"] == pytest.approx(9000.0)
    assert body["series"][0]["period"] == "2026-03"


def test_defaults_applied(env, client):
    response = client.get(_url(env))
    assert response.status_code == 200
    assert response.json()["totals"]["units"] == 0.0


def test_filters_are_passed_through(env, client):
    _sale(env, qty="4", channel="POS")
    _sale(env, qty="6", channel="SYSTEM")
    response = client.get(_url(env), {"date_from": "2026-01-01", "date_to": "2026-12-31", "channel": "POS"})
    assert response.json()["totals"]["units"] == pytest.approx(4.0)


@pytest.mark.parametrize(
    "query",
    [{"metric": "bogus"}, {"group_by": "bogus"}, {"granularity": "week"},
     {"date_from": "2026-12-31", "date_to": "2026-01-01"}, {"date_from": "not-a-date"}],
)
def test_invalid_params_return_400(env, client, query):
    assert client.get(_url(env), query).status_code == 400


def test_requires_authentication(env):
    assert APIClient().get(_url(env)).status_code in (401, 403)


def test_unknown_product_returns_404(env, client):
    assert client.get("/api/inventory/products/999999/sales-impact/").status_code == 404
