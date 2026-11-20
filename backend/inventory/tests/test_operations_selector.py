# ruff: noqa: F811  (the env fixture is imported from test_product_stock_flow)
"""OperationsSelector: rotación, cobertura, stock inmóvil y suscripciones de un producto."""
from datetime import date
from decimal import Decimal

import pytest

from contacts.models import Contact
from inventory.models import Product, Subscription
from inventory.operations_selector import OperationsSelector
from inventory.tests.test_product_stock_flow import _move, env  # noqa: F401
from purchasing.models import PurchaseLine, PurchaseOrder

RANGE = {"date_from": date(2026, 1, 1), "date_to": date(2026, 12, 31)}


def _ops(env, product=None, idle_days=90, **kw):
    """Rotación del producto (o ``None`` si no controla stock), como la usan Inventario y Abastecimiento."""
    product = product or env["product"]
    window = {**RANGE, **kw}
    ids = [product.id] + (list(product.variants.values_list("id", flat=True)) if product.has_variants else [])
    rotation = (
        OperationsSelector._rotation(product, ids, window["date_from"], window["date_to"], idle_days)
        if product.track_inventory else None
    )
    return {"rotation": rotation}


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
    assert rot["turnover"] is None
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


# ── Helpers de suscripción (los usa test_subscription_analysis_selector) ──────

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
