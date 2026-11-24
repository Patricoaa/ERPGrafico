# ruff: noqa: F811  (the env fixture is imported from test_sales_impact_selector)
"""PricingSelector: margen realizado, serie de precios y efectos de cambios de precio."""
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from inventory.models import Product
from inventory.pricing_selector import PricingParams, PricingSelector
from inventory.sales_impact_selector import SalesImpactParams, SalesImpactSelector
from inventory.tests.test_sales_impact_selector import _rule, _sale, env  # noqa: F401

RANGE = {"date_from": date(2026, 1, 1), "date_to": date(2026, 12, 31)}


def _pricing(env, **overrides):
    return PricingSelector.get_pricing(env["product"], PricingParams(**{**RANGE, **overrides}))


def test_kpis_margin_uses_discounted_revenue(env):
    _sale(env, qty="10", price="1000", gross="1190", discount="1190", cost="400")
    _sale(env, qty="10", price="1000", gross="1190", discount="0", cost="400", on=date(2026, 4, 10))
    kpis = _pricing(env)["kpis"]
    assert kpis["units"] == pytest.approx(20.0)
    assert kpis["net_revenue"] == pytest.approx(19000.0)
    assert kpis["margin_pct"] == pytest.approx(11000 / 19000 * 100)
    assert kpis["avg_discount_pct"] == pytest.approx(5.0)
    assert kpis["avg_price"] == pytest.approx(950.0)


def test_series_points_by_month(env):
    _sale(env, qty="10", on=date(2026, 3, 10))
    _sale(env, qty="5", cost="500", on=date(2026, 4, 10))
    points = _pricing(env)["series"]["points"]
    assert [p["period"] for p in points] == ["2026-03", "2026-04"]
    assert points[0]["avg_cost"] == pytest.approx(400.0)
    assert points[1]["avg_cost"] == pytest.approx(500.0)
    assert points[1]["margin_pct"] == pytest.approx(50.0)


def test_previous_period_is_equal_length_window_before_date_from(env):
    _sale(env, qty="7", on=date(2025, 12, 20))
    _sale(env, qty="3", on=date(2026, 6, 1))
    result = _pricing(env, date_from=date(2026, 1, 1), date_to=date(2026, 12, 31))
    assert result["kpis"]["units"] == pytest.approx(3.0)
    assert result["kpis"]["previous"] is not None
    short = _pricing(env, date_from=date(2026, 1, 1), date_to=date(2026, 1, 20))
    assert short["kpis"]["previous"]["units"] == pytest.approx(7.0)


def test_previous_is_none_without_date_from(env):
    _sale(env)
    assert _pricing(env, date_from=None)["kpis"]["previous"] is None


def test_no_cost_product_has_null_margins(env):
    product = env["product"]
    Product.objects.filter(pk=product.pk).update(cost_price=Decimal("0"))
    product.refresh_from_db()
    _sale(env, cost="0")
    result = _pricing(env)
    assert result["has_cost"] is False
    assert result["kpis"]["margin_pct"] is None
    assert result["today"]["list_margin_pct"] is None
    assert result["series"]["points"][0]["margin_pct"] is None


def test_no_sales_returns_zeroed_kpis(env):
    result = _pricing(env)
    assert result["kpis"]["units"] == 0.0
    assert result["kpis"]["margin_pct"] is None
    assert result["series"]["points"] == []


def test_today_reports_list_price_and_cost(env):
    Product.objects.filter(pk=env["product"].pk).update(cost_price=Decimal("400"))
    env["product"].refresh_from_db()
    today = _pricing(env)["today"]
    assert today["list_price_net"] == pytest.approx(float(env["product"].sale_price))
    assert today["cost"] == pytest.approx(400.0)
    assert today["list_margin_pct"] == pytest.approx((float(env["product"].sale_price) - 400) / float(env["product"].sale_price) * 100)


def test_includes_variant_sales(env):
    parent = env["product"]
    variant = Product.objects.create(
        name="Tarjeta v2", category=env["category"], uom=env["uom"], sale_uom=env["uom"], purchase_uom=env["uom"],
        product_type="STORABLE", sale_price=Decimal("1000"), parent_template=parent,
    )
    Product.objects.filter(pk=parent.pk).update(has_variants=True)
    parent.refresh_from_db()
    _sale(env, qty="4", product=variant)
    assert PricingSelector.get_pricing(parent, PricingParams(**RANGE))["kpis"]["units"] == pytest.approx(4.0)


def test_query_count_constant_with_more_rows(env):
    _sale(env)
    with CaptureQueriesContext(connection) as few:
        _pricing(env)
    for i in range(15):
        _sale(env, on=date(2026, 1 + i % 11, 5))
    with CaptureQueriesContext(connection) as many:
        _pricing(env)
    assert len(many) == len(few)


def _at(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, 12, tzinfo=timezone.utc)


def _price_history(env, *changes):
    """Fija el historial de ``sale_price``: creación el 2025-12-01 y luego ``(fecha, precio)`` por cambio."""
    product = env["product"]
    product.history.update(history_date=_at(date(2025, 12, 1)))
    for day, price in changes:
        product.sale_price = Decimal(price)
        product.save()
        product.history.order_by("-history_id").filter(pk=product.history.latest("history_id").pk).update(history_date=_at(day))
    product.refresh_from_db()


def test_list_price_changes_from_history(env):
    _price_history(env, (date(2026, 3, 1), "1200"), (date(2026, 6, 1), "1500"))
    changes = _pricing(env)["list_price_changes"]
    assert changes["baseline"] == pytest.approx(1000.0)
    assert [(c["date"], c["from"], c["to"], c["period"]) for c in changes["changes"]] == [
        ("2026-03-01", 1000.0, 1200.0, "2026-03"),
        ("2026-06-01", 1200.0, 1500.0, "2026-06"),
    ]


def test_list_price_changes_limited_to_range_with_baseline(env):
    _price_history(env, (date(2026, 3, 1), "1200"), (date(2026, 6, 1), "1500"))
    changes = _pricing(env, date_from=date(2026, 4, 1))["list_price_changes"]
    assert changes["baseline"] == pytest.approx(1200.0)
    assert [c["date"] for c in changes["changes"]] == ["2026-06-01"]


def test_list_price_changes_ignore_cost_only_edits(env):
    _price_history(env)
    product = env["product"]
    product.cost_price = Decimal("777")
    product.save()
    assert _pricing(env)["list_price_changes"]["changes"] == []


def test_rule_windows_match_sales_impact(env):
    _rule(env, name="Promo", start_date=date(2026, 2, 1), end_date=date(2026, 2, 28))
    expected = SalesImpactSelector.get_sales_impact(env["product"], SalesImpactParams(**RANGE))["rule_windows"]
    assert expected
    assert _pricing(env)["rule_windows"] == expected


def test_by_rule_splits_price_per_rule(env):
    rule = _rule(env, name="Mayorista")
    _sale(env, qty="10", price="800", gross="952", rule=rule, source="RULE")
    _sale(env, qty="10", price="1000", gross="1190", source="LIST")
    by_rule = {r["key"]: r for r in _pricing(env)["series"]["by_rule"]}
    assert by_rule[str(rule.pk)]["avg_price"] == pytest.approx(800.0)
    assert by_rule[str(rule.pk)]["label"] == "Mayorista"
    assert by_rule["list"]["avg_price"] == pytest.approx(1000.0)
    assert by_rule["list"]["period"] == "2026-03"
