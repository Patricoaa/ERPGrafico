# ruff: noqa: F811  (the env fixture is imported from test_sales_impact_selector)
"""ProcurementSelector: cobertura, compras con período anterior, proveedores y pendiente de recibir."""
import itertools
from datetime import date
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from contacts.models import Contact
from inventory.models import Location, Product, StockMove, UoM
from inventory.operations_selector import OperationsSelector
from inventory.procurement_selector import ProcurementParams, ProcurementSelector
from inventory.tests.test_sales_impact_selector import env  # noqa: F401
from purchasing.models import (
    PurchaseLine,
    PurchaseOrder,
    PurchaseReceipt,
    PurchaseReceiptLine,
    PurchaseReturn,
    PurchaseReturnLine,
)

RANGE = {"date_from": date(2026, 1, 1), "date_to": date(2026, 12, 31)}
_n = itertools.count(1)


def _proc(env, product=None, **overrides):
    return ProcurementSelector.get_procurement(product or env["product"], ProcurementParams(**{**RANGE, **overrides}))


def _supplier(name: str) -> Contact:
    return Contact.objects.create(name=name, tax_id=f"7{next(_n):07d}-1")


def _order(env, supplier=None, status="CONFIRMED", on=date(2026, 3, 1)) -> PurchaseOrder:
    return PurchaseOrder.objects.create(
        number=f"PO-{next(_n)}", supplier=supplier or env["customer"], status=status, date=on,
    )


def _line(env, order, qty, unit_cost="100", product=None, uom=None, received="0") -> PurchaseLine:
    return PurchaseLine.objects.create(
        order=order, product=product or env["product"], quantity=Decimal(qty), uom=uom or env["uom"],
        unit_cost=Decimal(unit_cost), quantity_received=Decimal(received),
    )


def _receive(env, order, qty, unit_cost="100", on=date(2026, 3, 1), product=None, uom=None, status="CONFIRMED"):
    line = _line(env, order, qty, unit_cost, product=product, uom=uom, received=qty)
    receipt = PurchaseReceipt.objects.create(
        purchase_order=order, warehouse=env["warehouse"], receipt_date=on, status=status, number=f"RC-{next(_n)}",
    )
    return PurchaseReceiptLine.objects.create(
        receipt=receipt, purchase_line=line, product=product or env["product"], quantity_received=Decimal(qty),
        uom=uom or env["uom"], unit_cost=Decimal(unit_cost), total_cost=Decimal(qty) * Decimal(unit_cost),
    )


def _return(env, order, qty, on=date(2026, 4, 1)):
    doc = PurchaseReturn.objects.create(
        purchase_order=order, warehouse=env["warehouse"], date=on, status="CONFIRMED", number=f"DV-{next(_n)}",
    )
    PurchaseReturnLine.objects.create(return_doc=doc, product=env["product"], uom=env["uom"], quantity=Decimal(qty))


def _out(env, qty, on):
    internal, _ = Location.objects.get_or_create(name="Interno", location_type="INTERNAL", warehouse=env["warehouse"])
    vendor, _ = Location.objects.get_or_create(name="Proveedor", location_type="VENDOR")
    customer, _ = Location.objects.get_or_create(name="Cliente", location_type="CUSTOMER")
    StockMove.objects.create(
        product=env["product"], source_location=vendor, destination_location=internal,
        quantity=Decimal(qty) * 3, unit_cost=Decimal("10"), date=date(2026, 1, 1), description="in",
    )
    StockMove.objects.create(
        product=env["product"], source_location=internal, destination_location=customer,
        quantity=Decimal(qty), unit_cost=Decimal("10"), date=on, description="out",
    )


# ── Cobertura ────────────────────────────────────────────────────────────────

def test_coverage_matches_operations(env):
    _out(env, "30", date(2026, 12, 1))
    coverage = _proc(env)["coverage"]
    rotation = OperationsSelector.get_operations(env["product"], **RANGE)["rotation"]
    assert coverage["coverage_days"] == pytest.approx(rotation["coverage_days"])
    assert coverage["stock_now"] == pytest.approx(rotation["stock_now"])
    assert coverage["daily_out"] == pytest.approx(30 / 90)


def test_coverage_none_without_stock_tracking(env):
    env["product"].track_inventory = False
    env["product"].save()
    assert _proc(env)["coverage"] is None


# ── Compras ──────────────────────────────────────────────────────────────────

def test_kpis_units_spend_orders_suppliers(env):
    a, b = _supplier("A"), _supplier("B")
    first = _order(env, a)
    _receive(env, first, "10", "100", on=date(2026, 3, 1))
    _receive(env, first, "5", "100", on=date(2026, 3, 15))
    _receive(env, _order(env, b), "5", "120", on=date(2026, 5, 1))
    kpis = _proc(env)["kpis"]
    assert kpis["units"] == pytest.approx(20.0)
    assert kpis["spend"] == pytest.approx(2100.0)
    assert kpis["orders"] == 2
    assert kpis["suppliers"] == 2


def test_units_in_base_uom(env):
    box = UoM.objects.create(name="Caja", category=env["uom"].category, uom_type="BIGGER", ratio=Decimal("10"))
    _receive(env, _order(env), "2", "1000", uom=box)
    assert _proc(env)["kpis"]["units"] == pytest.approx(20.0)


def test_unconfirmed_receipts_ignored(env):
    _receive(env, _order(env), "10", status="DRAFT")
    assert _proc(env)["kpis"]["units"] == 0.0


def test_series_by_month(env):
    order = _order(env)
    _receive(env, order, "10", "100", on=date(2026, 3, 1))
    _receive(env, order, "4", "100", on=date(2026, 5, 1))
    points = _proc(env)["series"]["points"]
    assert [(p["period"], p["units"], p["spend"]) for p in points] == [("2026-03", 10.0, 1000.0), ("2026-05", 4.0, 400.0)]


def test_previous_and_previous_points_aligned(env):
    _receive(env, _order(env), "7", "100", on=date(2026, 1, 15))
    result = _proc(env, date_from=date(2026, 4, 1), date_to=date(2026, 6, 30))
    assert result["kpis"]["previous"] == {"units": 7.0, "spend": 700.0, "orders": 1}
    assert [(p["period"], p["units"]) for p in result["series"]["previous_points"]] == [("2026-04", 7.0)]


def test_previous_none_without_date_from(env):
    _receive(env, _order(env), "7")
    result = _proc(env, date_from=None)
    assert result["kpis"]["previous"] is None
    assert result["series"]["previous_points"] == []


def test_last_purchase_uses_whole_history(env):
    _receive(env, _order(env), "3", on=date(2025, 2, 10))
    kpis = _proc(env)["kpis"]
    assert kpis["units"] == 0.0
    assert kpis["last_purchase_date"] == "2025-02-10"
    assert kpis["days_since_last_purchase"] == (date.today() - date(2025, 2, 10)).days


def test_no_purchases_at_all(env):
    kpis = _proc(env)["kpis"]
    assert kpis["last_purchase_date"] is None
    assert kpis["days_since_last_purchase"] is None


def test_returned_units_in_range(env):
    order = _order(env)
    _receive(env, order, "10")
    _return(env, order, "3")
    _return(env, order, "9", on=date(2025, 1, 1))
    assert _proc(env)["kpis"]["returned_units"] == pytest.approx(3.0)


def test_includes_variant_receipts(env):
    parent = env["product"]
    variant = Product.objects.create(
        name="Resma v2", category=env["category"], uom=env["uom"], sale_uom=env["uom"], purchase_uom=env["uom"],
        product_type="STORABLE", sale_price=Decimal("1000"), parent_template=parent,
    )
    Product.objects.filter(pk=parent.pk).update(has_variants=True)
    parent.refresh_from_db()
    _receive(env, _order(env), "4", product=variant)
    assert _proc(env, product=parent)["kpis"]["units"] == pytest.approx(4.0)


def test_query_count_constant_with_more_rows(env):
    _receive(env, _order(env), "1")
    with CaptureQueriesContext(connection) as few:
        _proc(env)
    for i in range(12):
        _receive(env, _order(env, _supplier(f"S{i}")), "1", on=date(2026, 1 + i % 11, 3))
    with CaptureQueriesContext(connection) as many:
        _proc(env)
    assert len(many) == len(few)


# ── Proveedores ──────────────────────────────────────────────────────────────

def test_suppliers_share_avg_and_receipts(env):
    a, b = _supplier("Papelera A"), _supplier("Papelera B")
    order_a = _order(env, a)
    _receive(env, order_a, "10", "100", on=date(2026, 3, 1))
    _receive(env, order_a, "10", "140", on=date(2026, 4, 1))
    _receive(env, _order(env, b), "6", "100", on=date(2026, 5, 1))
    suppliers = _proc(env)["suppliers"]
    assert [s["name"] for s in suppliers] == ["Papelera A", "Papelera B"]
    first = suppliers[0]
    assert first["id"] == a.id
    assert first["units"] == pytest.approx(20.0)
    assert first["spend"] == pytest.approx(2400.0)
    assert first["share_pct"] == pytest.approx(2400 / 3000 * 100)
    assert first["avg_unit_cost"] == pytest.approx(120.0)
    assert first["receipts"] == 2
    assert first["last_date"] == "2026-04-01"
    assert first["preferred"] is False


def test_preferred_supplier_flagged(env):
    a = _supplier("Papelera A")
    Product.objects.filter(pk=env["product"].pk).update(preferred_supplier=a)
    env["product"].refresh_from_db()
    _receive(env, _order(env, a), "5")
    result = _proc(env)
    assert result["preferred_supplier"] == {"id": a.id, "name": "Papelera A"}
    assert result["suppliers"][0]["preferred"] is True


def test_preferred_supplier_without_purchases_listed_only_in_preferred_supplier(env):
    preferred = _supplier("Preferido")
    Product.objects.filter(pk=env["product"].pk).update(preferred_supplier=preferred)
    env["product"].refresh_from_db()
    _receive(env, _order(env, _supplier("Otro")), "5")
    result = _proc(env)
    assert result["preferred_supplier"]["name"] == "Preferido"
    assert [s["name"] for s in result["suppliers"]] == ["Otro"]


def test_supplier_returned_units(env):
    a = _supplier("A")
    order = _order(env, a)
    _receive(env, order, "10")
    _return(env, order, "2")
    assert _proc(env)["suppliers"][0]["returned_units"] == pytest.approx(2.0)


# ── Pendiente de recibir ─────────────────────────────────────────────────────

def test_pending_partial_order(env):
    order = _order(env, _supplier("A"), on=date(2026, 6, 1))
    _line(env, order, "10", received="4")
    pending = _proc(env)["pending"]
    assert pending == [{
        "order_id": order.id, "number": order.number, "supplier": "A", "date": "2026-06-01",
        "ordered": 10.0, "received": 4.0, "pending": 6.0,
    }]


def test_pending_in_base_uom(env):
    box = UoM.objects.create(name="Caja", category=env["uom"].category, uom_type="BIGGER", ratio=Decimal("10"))
    _line(env, _order(env), "2", uom=box, received="1")
    assert _proc(env)["pending"][0]["pending"] == pytest.approx(10.0)


def test_pending_ignores_draft_and_fully_received(env):
    _line(env, _order(env, status="DRAFT"), "10")
    _line(env, _order(env), "5", received="5")
    assert _proc(env)["pending"] == []


def test_query_count_constant_with_more_suppliers(env):
    _receive(env, _order(env, _supplier("S0")), "1")
    _line(env, _order(env), "3")
    with CaptureQueriesContext(connection) as few:
        _proc(env)
    for i in range(1, 10):
        order = _order(env, _supplier(f"S{i}"))
        _receive(env, order, "1", on=date(2026, 1 + i, 3))
        _return(env, order, "1")
        _line(env, _order(env, _supplier(f"P{i}")), "3")
    with CaptureQueriesContext(connection) as many:
        _proc(env)
    assert len(many) == len(few)
