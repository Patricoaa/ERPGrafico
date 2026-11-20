# ruff: noqa: F811  (the env fixture is imported from test_sales_impact_selector)
"""sales-impact: devoluciones netas del descuento promedio y cobertura de procedencia (ADR-0145)."""
from datetime import date
from decimal import Decimal

import pytest

from inventory.sales_impact_selector import SalesImpactParams, SalesImpactSelector
from inventory.tests.test_sales_impact_selector import _sale, env  # noqa: F401  (fixture reuse)
from sales.models import SaleOrder, SaleReturn, SaleReturnLine


def _return_one(env, unit_price="10000"):
    order = SaleOrder.objects.first()
    sale_return = SaleReturn.objects.create(
        sale_order=order, warehouse=env["warehouse"], date=date(2026, 4, 1), status="CONFIRMED", number="R-5",
    )
    SaleReturnLine.objects.create(
        return_doc=sale_return, product=env["product"], uom=env["uom"], quantity=Decimal("1"),
        unit_price=Decimal(unit_price), unit_cost=Decimal("400"),
    )


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
