# ruff: noqa: F811  (the env fixture is imported from test_product_stock_flow)
"""OperationsSelector: rotación, cobertura, stock inmóvil y suscripciones de un producto."""
from datetime import date
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from contacts.models import Contact
from inventory.models import Product, Subscription
from inventory.operations_selector import OperationsSelector
from inventory.tests.test_product_stock_flow import _move, env  # noqa: F401
from purchasing.models import PurchaseLine, PurchaseOrder

RANGE = {"date_from": date(2026, 1, 1), "date_to": date(2026, 12, 31)}


def _ops(env, product=None, **kw):
    return OperationsSelector.get_operations(product or env["product"], **{**RANGE, **kw})


def _rot(env, **kw):
    return _ops(env, **kw)["rotation"]


# ── Rotación ─────────────────────────────────────────────────────────────────

def test_rotation_only_for_stock_tracking_products(env):
    assert _rot(env) is not None
    env["product"].track_inventory = False
    env["product"].save()
    assert _ops(env)["rotation"] is None


def test_turnover_and_days_of_inventory(env):
    _move(env, "vendor", "internal", "10", on=date(2026, 1, 1))
    _move(env, "internal", "customer", "5", on=date(2026, 7, 1))
    rot = _rot(env)
    avg = (10 * 181 + 5 * 184) / 365
    assert rot["avg_stock"] == pytest.approx(avg)
    assert rot["out_qty"] == pytest.approx(5.0) and rot["in_qty"] == pytest.approx(10.0)
    assert rot["turnover"] == pytest.approx(5 / avg)
    assert rot["days_of_inventory"] == pytest.approx(365 / (5 / avg))
    assert rot["stock_now"] == pytest.approx(5.0)


def test_avg_stock_is_time_weighted_with_stock_before_the_window(env):
    _move(env, "vendor", "internal", "10", on=date(2025, 6, 1))  # before the window
    assert _rot(env)["avg_stock"] == pytest.approx(10.0)


def test_no_outflow_gives_null_turnover_and_coverage(env):
    _move(env, "vendor", "internal", "10", on=date(2026, 1, 1))
    rot = _rot(env)
    assert rot["out_qty"] == 0.0
    assert rot["turnover"] == 0.0
    assert rot["days_of_inventory"] is None
    assert rot["coverage_days"] is None


def test_zero_avg_stock_gives_null_turnover(env):
    rot = _rot(env)
    assert rot["avg_stock"] == 0.0
    assert rot["turnover"] is None and rot["days_of_inventory"] is None


def test_coverage_uses_the_last_90_days_before_date_to(env):
    _move(env, "vendor", "internal", "100", on=date(2026, 1, 1))
    _move(env, "internal", "customer", "9", on=date(2026, 12, 1))  # inside the last 90 days: 0.1 / day
    _move(env, "internal", "customer", "50", on=date(2026, 2, 1))  # outside
    rot = _rot(env)
    assert rot["stock_now"] == pytest.approx(41.0)
    assert rot["coverage_days"] == pytest.approx(41.0 / (9 / 90))


def test_transfers_and_adjustments_do_not_count_as_flow(env):
    _move(env, "vendor", "internal", "10", on=date(2026, 1, 1))
    _move(env, "internal", "internal2", "4", on=date(2026, 2, 1))
    _move(env, "internal", "adjust", "3", on=date(2026, 3, 1))
    rot = _rot(env)
    assert rot["out_qty"] == 0.0 and rot["in_qty"] == pytest.approx(10.0)
    assert rot["stock_now"] == pytest.approx(7.0)  # the adjustment leaves the internal locations


def test_idle_true_without_recent_outflow(env):
    _move(env, "vendor", "internal", "10", on=date(2026, 1, 1))
    _move(env, "internal", "customer", "1", on=date(2026, 2, 1))
    rot = _rot(env)
    assert rot["idle"] is True
    assert rot["last_out_date"] == "2026-02-01" and rot["last_in_date"] == "2026-01-01"


def test_not_idle_with_recent_outflow(env):
    _move(env, "vendor", "internal", "10", on=date(2026, 1, 1))
    _move(env, "internal", "customer", "1", on=date(2026, 12, 20))
    assert _rot(env)["idle"] is False


def test_zero_stock_is_never_idle(env):
    assert _rot(env)["idle"] is False


def test_idle_days_parameter_changes_the_threshold(env):
    _move(env, "vendor", "internal", "10", on=date(2026, 1, 1))
    _move(env, "internal", "customer", "1", on=date(2026, 12, 1))  # 30 days before date_to
    assert _rot(env, idle_days=90)["idle"] is False
    assert _rot(env, idle_days=20)["idle"] is True


def test_variants_count(env):
    template = env["product"]
    template.has_variants = True
    template.save()
    variant = Product.objects.create(
        name="Resma Roja", category=env["category"], uom=env["uom"], sale_uom=env["uom"],
        purchase_uom=env["uom"], product_type="STORABLE", sale_price=Decimal("1000"), parent_template=template,
    )
    _move(env, "vendor", "internal", "7", on=date(2026, 1, 1), product=variant)
    assert _rot(env)["stock_now"] == pytest.approx(7.0)


def test_series_has_monthly_out_and_closing_stock(env):
    _move(env, "vendor", "internal", "10", on=date(2026, 1, 15))
    _move(env, "internal", "customer", "4", on=date(2026, 2, 10))
    series = {s["month"]: s for s in _rot(env)["series"]}
    assert list(series)[:3] == ["2026-01", "2026-02", "2026-03"]
    assert series["2026-01"]["out"] == 0.0 and series["2026-01"]["stock_end"] == pytest.approx(10.0)
    assert series["2026-02"]["out"] == pytest.approx(4.0) and series["2026-02"]["stock_end"] == pytest.approx(6.0)
    assert series["2026-03"]["stock_end"] == pytest.approx(6.0)  # month without movements keeps the stock


def test_stock_value(env):
    _move(env, "vendor", "internal", "10", on=date(2026, 1, 1))
    Product.objects.filter(pk=env["product"].pk).update(cost_price=Decimal("30"))
    env["product"].refresh_from_db()
    assert _rot(env)["stock_value"] == pytest.approx(300.0)


# ── Suscripciones ────────────────────────────────────────────────────────────

def _sub_product(env):
    return Product.objects.create(
        name="Hosting", category=env["category"], uom=env["uom"], sale_uom=env["uom"], purchase_uom=env["uom"],
        product_type="SUBSCRIPTION", sale_price=Decimal("0"), track_inventory=False, can_be_sold=False,
    )


def _supplier(name="Proveedor"):
    n = Contact.objects.count() + 1
    return Contact.objects.create(name=name, tax_id=f"{10_000_000 + n}-1")


def _subscription(product, amount, period="MONTHLY", status="ACTIVE", next_payment=date(2027, 1, 15), supplier=None):
    return Subscription.objects.create(
        product=product, supplier=supplier or _supplier(), start_date=date(2025, 1, 1), amount=Decimal(amount),
        recurrence_period=period, status=status, next_payment_date=next_payment,
    )


def _payment(env, product, cost, on, status="CONFIRMED", supplier=None):
    order = PurchaseOrder.objects.create(
        number=f"PO-S{PurchaseOrder.objects.count() + 1}", supplier=supplier or _supplier("Pagos"), status=status, date=on,
    )
    return PurchaseLine.objects.create(order=order, product=product, quantity=Decimal("1"), uom=env["uom"], unit_cost=Decimal(cost))


def test_subscriptions_only_for_recurring_products(env):
    assert _ops(env)["subscriptions"] is None
    assert _ops(env, product=_sub_product(env))["subscriptions"] is not None


def test_annualized_by_frequency(env):
    product = _sub_product(env)
    for period, factor in (("WEEKLY", 52), ("MONTHLY", 12), ("QUARTERLY", 4), ("SEMIANNUAL", 2), ("ANNUAL", 1)):
        _subscription(product, "100", period=period)
        items = _ops(env, product=product)["subscriptions"]["items"]
        assert next(i for i in items if i["frequency"] == period)["annualized"] == pytest.approx(100.0 * factor)


def test_totals_only_count_active(env):
    product = _sub_product(env)
    _subscription(product, "100", period="MONTHLY")
    _subscription(product, "500", period="ANNUAL", status="PAUSED")
    _subscription(product, "900", period="ANNUAL", status="CANCELLED")
    subs = _ops(env, product=product)["subscriptions"]
    assert subs["count"] == 1
    assert subs["annualized_total"] == pytest.approx(1200.0)
    assert subs["monthly_equivalent_total"] == pytest.approx(100.0)
    assert len(subs["items"]) == 3


def test_due_90d_total_and_overdue_days(env):
    product = _sub_product(env)
    _subscription(product, "100", next_payment=date(2027, 2, 1))   # 32 days after date_to → due
    _subscription(product, "200", next_payment=date(2027, 6, 1))   # far
    _subscription(product, "50", next_payment=date(2026, 12, 21))  # 10 days overdue
    subs = _ops(env, product=product)["subscriptions"]
    assert subs["due_90d_total"] == pytest.approx(150.0)
    days = sorted(i["days_to_payment"] for i in subs["items"])
    assert days[0] == -10 and days[1] == 32


def test_payments_exclude_draft_and_cancelled(env):
    product = _sub_product(env)
    _payment(env, product, "100", date(2026, 1, 5))
    _payment(env, product, "100", date(2026, 2, 5), status="DRAFT")
    _payment(env, product, "100", date(2026, 3, 5), status="CANCELLED")
    assert len(_ops(env, product=product)["subscriptions"]["payments"]) == 1


def test_payment_change_pct_and_first_to_last(env):
    product = _sub_product(env)
    _payment(env, product, "100", date(2026, 1, 5))
    _payment(env, product, "110", date(2026, 2, 5))
    _payment(env, product, "132", date(2026, 3, 5))
    subs = _ops(env, product=product)["subscriptions"]
    changes = [p["change_pct"] for p in subs["payments"]]
    assert changes[0] is None and changes[1] == pytest.approx(10.0) and changes[2] == pytest.approx(20.0)
    assert subs["first_to_last_pct"] == pytest.approx(32.0)


def test_single_payment_has_no_variation(env):
    product = _sub_product(env)
    _payment(env, product, "100", date(2026, 1, 5))
    subs = _ops(env, product=product)["subscriptions"]
    assert subs["payments"][0]["change_pct"] is None and subs["first_to_last_pct"] is None


def test_query_count_constant(env):
    product = _sub_product(env)
    supplier = _supplier("Fijo")
    _subscription(product, "100", supplier=supplier)
    _payment(env, product, "100", date(2026, 1, 5), supplier=supplier)
    _move(env, "vendor", "internal", "10", on=date(2026, 1, 1))
    with CaptureQueriesContext(connection) as few:
        _ops(env, product=product)
        _ops(env)
    for i in range(6):
        _subscription(product, "100", supplier=supplier)
        _payment(env, product, str(100 + i), date(2026, 2, 5 + i), supplier=supplier)
        _move(env, "internal", "customer", "1", on=date(2026, 3, 1 + i))
    with CaptureQueriesContext(connection) as many:
        _ops(env, product=product)
        _ops(env)
    assert len(many) == len(few)
