# ruff: noqa: F811  (the env fixture is imported from test_product_stock_flow)
"""SubscriptionAnalysisSelector: costo recurrente, pagos del período, subidas de precio y vencimientos."""
from datetime import date, timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from inventory.operations_selector import OperationsSelector
from inventory.subscription_analysis_selector import (
    SubscriptionAnalysisParams,
    SubscriptionAnalysisSelector,
)
from inventory.tests.test_operations_selector import (
    _payment,
    _sub_product,
    _subscription,
    _supplier,
)
from inventory.tests.test_product_stock_flow import env  # noqa: F401

RANGE = {"date_from": date(2026, 1, 1), "date_to": date(2026, 12, 31)}


def _analysis(product, **overrides):
    return SubscriptionAnalysisSelector.get_analysis(product, SubscriptionAnalysisParams(**{**RANGE, **overrides}))


def test_today_matches_operations(env):
    product = _sub_product(env)
    _subscription(product, "100", period="MONTHLY")
    _subscription(product, "1200", period="ANNUAL", next_payment=date(2028, 1, 1))
    _subscription(product, "50", status="PAUSED")
    today = _analysis(product)["today"]
    expected = OperationsSelector._subscriptions([product.id])
    assert today["annualized_total"] == pytest.approx(expected["annualized_total"])
    assert today["monthly_equivalent"] == pytest.approx(expected["monthly_equivalent_total"])
    assert today["active_count"] == expected["count"] == 2
    assert today["due_90d_total"] == pytest.approx(expected["due_90d_total"])


def test_kpis_paid_and_payments_in_range(env):
    product = _sub_product(env)
    supplier = _supplier("Hosting SA")
    _payment(env, product, "100", date(2026, 2, 1), supplier=supplier)
    _payment(env, product, "110", date(2026, 3, 1), supplier=supplier)
    _payment(env, product, "999", date(2025, 3, 1), supplier=supplier)
    kpis = _analysis(product)["kpis"]
    assert (kpis["paid"], kpis["payments"]) == (210.0, 2)


def test_draft_and_cancelled_orders_are_not_payments(env):
    product = _sub_product(env)
    _payment(env, product, "100", date(2026, 2, 1), status="DRAFT")
    _payment(env, product, "100", date(2026, 3, 1), status="CANCELLED")
    assert _analysis(product)["kpis"]["payments"] == 0


def test_previous_and_aligned_points(env):
    product = _sub_product(env)
    _payment(env, product, "70", date(2026, 1, 15))
    _payment(env, product, "30", date(2026, 4, 20))
    result = _analysis(product, date_from=date(2026, 4, 1), date_to=date(2026, 6, 30))
    assert result["kpis"]["previous"] == {"paid": 70.0, "payments": 1}
    assert [(p["period"], p["paid"]) for p in result["series"]["points"]] == [("2026-04", 30.0)]
    assert [(p["period"], p["paid"]) for p in result["series"]["previous_points"]] == [("2026-04", 70.0)]


def test_previous_none_without_date_from(env):
    product = _sub_product(env)
    _payment(env, product, "70", date(2026, 1, 15))
    result = _analysis(product, date_from=None)
    assert result["kpis"]["previous"] is None
    assert result["series"]["previous_points"] == []


def test_last_payment_and_change_by_supplier(env):
    product = _sub_product(env)
    a, b = _supplier("Hosting A"), _supplier("Hosting B")
    _subscription(product, "100", supplier=a)
    _subscription(product, "50", supplier=b)
    _payment(env, product, "100", date(2026, 1, 1), supplier=a)
    _payment(env, product, "50", date(2026, 2, 1), supplier=b)
    _payment(env, product, "110", date(2026, 3, 1), supplier=a)
    rows = {s["supplier"]: s for s in _analysis(product)["subscriptions"]}
    assert rows["Hosting A"]["last_payment"] == {"date": "2026-03-01", "amount": 110.0}
    assert rows["Hosting A"]["change_pct"] == pytest.approx(10.0)
    assert rows["Hosting B"]["change_pct"] is None


def test_differs_from_amount(env):
    product = _sub_product(env)
    a, b = _supplier("A"), _supplier("B")
    _subscription(product, "100", supplier=a)
    _subscription(product, "100", supplier=b)
    _payment(env, product, "120", date(2026, 3, 1), supplier=a)
    _payment(env, product, "100.5", date(2026, 3, 1), supplier=b)
    rows = {s["supplier"]: s for s in _analysis(product)["subscriptions"]}
    assert rows["A"]["differs_from_amount"] is True
    assert rows["B"]["differs_from_amount"] is False


def test_subscription_without_payments(env):
    product = _sub_product(env)
    _subscription(product, "100")
    row = _analysis(product)["subscriptions"][0]
    assert (row["last_payment"], row["change_pct"], row["differs_from_amount"]) == (None, None, False)


def test_days_to_end_and_payment(env):
    product = _sub_product(env)
    sub = _subscription(product, "100", next_payment=timezone.localdate() - timedelta(days=3))
    sub.end_date = timezone.localdate() + timedelta(days=20)
    sub.save()
    row = _analysis(product)["subscriptions"][0]
    assert row["days_to_payment"] == -3
    assert row["days_to_end"] == 20
    assert row["frequency"] == "MONTHLY"
    assert row["annualized"] == pytest.approx(1200.0)


def test_payments_list_with_change(env):
    product = _sub_product(env)
    supplier = _supplier("Hosting SA")
    _payment(env, product, "100", date(2026, 2, 1), supplier=supplier)
    _payment(env, product, "120", date(2026, 3, 1), supplier=supplier)
    payments = _analysis(product)["payments"]
    assert [(p["date"], p["amount"], p["change_pct"]) for p in payments] == [
        ("2026-02-01", 100.0, None), ("2026-03-01", 120.0, pytest.approx(20.0)),
    ]


def test_query_count_constant(env):
    product = _sub_product(env)
    _subscription(product, "100")
    _payment(env, product, "100", date(2026, 1, 3))
    with CaptureQueriesContext(connection) as few:
        _analysis(product)
    for i in range(8):
        supplier = _supplier(f"S{i}")
        _subscription(product, "10", supplier=supplier)
        _payment(env, product, "10", date(2026, 2 + i, 3), supplier=supplier)
    with CaptureQueriesContext(connection) as many:
        _analysis(product)
    assert len(many) == len(few)
