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
