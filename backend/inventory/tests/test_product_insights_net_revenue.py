# ruff: noqa: F811  (the env fixture is imported from test_sales_impact_selector)
"""Los ingresos de ProductSelector.get_insights son netos de descuentos (ADR-0145)."""
from datetime import date
from decimal import Decimal

import pytest

from inventory.sales_impact_selector import SalesImpactParams, SalesImpactSelector
from inventory.selectors import ProductSelector
from inventory.tests.test_sales_impact_selector import _sale, env  # noqa: F401  (fixture reuse)
from sales.models import SaleOrder, SaleReturn, SaleReturnLine


def _insights(env):
    return ProductSelector.get_insights(env["product"])


def test_sales_analysis_revenue_is_net_of_discount(env):
    _sale(env, qty="10", price="1000", gross="1190", discount="1190")
    assert _insights(env)["sales_analysis"]["total_revenue"] == pytest.approx(9000.0)


def test_top_customers_revenue_is_net_of_discount(env):
    _sale(env, qty="10", price="1000", gross="1190", discount="1190")
    assert _insights(env)["top_customers"][0]["total_revenue"] == pytest.approx(9000.0)


def test_sales_history_revenue_is_net_of_discount(env):
    _sale(env, qty="10", price="1000", gross="1190", discount="1190", on=date(2026, 3, 10))
    history = _insights(env)["sales_analysis"]["history"]
    assert history[0]["revenue"] == pytest.approx(9000.0)


def test_insights_revenue_matches_sales_impact_totals(env):
    _sale(env, qty="10", price="1000", gross="1190", discount="1190")
    order = SaleOrder.objects.first()
    sale_return = SaleReturn.objects.create(
        sale_order=order, warehouse=env["warehouse"], date=date(2026, 4, 1), status="CONFIRMED", number="R-9",
    )
    SaleReturnLine.objects.create(
        return_doc=sale_return, product=env["product"], uom=env["uom"], quantity=Decimal("2"),
        unit_price=Decimal("1000"), unit_cost=Decimal("400"),
    )
    impact = SalesImpactSelector.get_sales_impact(
        env["product"], SalesImpactParams(date_from=date(2020, 1, 1), date_to=date(2030, 1, 1))
    )
    expected = impact["totals"]["net_revenue"] - impact["returns"]["revenue"]
    assert _insights(env)["sales_analysis"]["total_revenue"] == pytest.approx(expected)


def _return_one(env, unit_price="10000"):
    order = SaleOrder.objects.first()
    sale_return = SaleReturn.objects.create(
        sale_order=order, warehouse=env["warehouse"], date=date(2026, 4, 1), status="CONFIRMED", number="R-5",
    )
    SaleReturnLine.objects.create(
        return_doc=sale_return, product=env["product"], uom=env["uom"], quantity=Decimal("1"),
        unit_price=Decimal(unit_price), unit_cost=Decimal("400"),
    )


def test_returning_a_discounted_sale_nets_to_zero_not_negative(env):
    # 1 unit, 50 % line discount: earned 5000; the return line carries the undiscounted 10000.
    _sale(env, qty="1", price="10000", gross="11900", discount="5950")
    _return_one(env)
    assert _insights(env)["sales_analysis"]["total_revenue"] == pytest.approx(0.0)


def test_sales_impact_returns_revenue_uses_average_discount(env):
    _sale(env, qty="1", price="10000", gross="11900", discount="5950")
    _return_one(env)
    impact = SalesImpactSelector.get_sales_impact(
        env["product"], SalesImpactParams(date_from=date(2020, 1, 1), date_to=date(2030, 1, 1))
    )
    assert impact["returns"]["revenue"] == pytest.approx(5000.0)


def test_coverage_is_exactly_100_when_everything_has_provenance(env):
    for i in range(7):
        _sale(env, qty="3", price="1000", gross="1190", discount=str(100 + 37 * i), source="LIST", on=date(2026, 3, 1 + i))
    impact = SalesImpactSelector.get_sales_impact(
        env["product"], SalesImpactParams(date_from=date(2026, 1, 1), date_to=date(2026, 12, 31))
    )
    assert impact["coverage"]["revenue_with_provenance_pct"] == 100.0
