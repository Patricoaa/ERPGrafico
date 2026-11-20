# ruff: noqa: F811  (the env fixture is imported from test_sales_impact_selector)
"""ProductionPerformanceSelector: costo real vs BOM, desviación por insumo, etapas y margen por OT."""
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from inventory.models import Location, Product, StockMove, UoM
from inventory.production_performance_selector import ProductionPerformanceSelector
from inventory.tests.test_sales_impact_selector import _sale, env  # noqa: F401
from production.models import (
    BillOfMaterials,
    BillOfMaterialsLine,
    ProductionConsumption,
    WorkOrder,
    WorkOrderHistory,
    WorkOrderMaterial,
)

RANGE = {"date_from": date(2026, 1, 1), "date_to": date(2026, 12, 31)}


def _component(env, name="Papel", cost="50"):
    return Product.objects.create(
        name=name, category=env["category"], uom=env["uom"], sale_uom=env["uom"], purchase_uom=env["uom"],
        product_type="STORABLE", sale_price=Decimal("10"), cost_price=Decimal(cost),
    )


def _history(wo, events):
    for stage, when in events:
        row = WorkOrderHistory.objects.create(work_order=wo, stage=stage, status="IN_PROGRESS", event="ENTERED")
        WorkOrderHistory.objects.filter(pk=row.pk).update(created_at=when)


def _ot(env, qty="10", status="FINISHED", sale_line=None, finished_on=datetime(2026, 3, 10, tzinfo=timezone.utc),
        rectified=False, actual=None, product=None, stages=None):
    wo = WorkOrder.objects.create(
        description="OT", is_manual=sale_line is None, product=None if sale_line else (product or env["product"]),
        sale_line=sale_line, status=status, warehouse=env["warehouse"], is_rectified=rectified,
        stage_data={"_version": 1, "quantity": float(qty)}, actual_quantity_produced=actual,
    )
    if status == "FINISHED":
        events = stages or []
        _history(wo, events + [("FINISHED", finished_on)])
    return wo


def _material(wo, component, planned, snapshot, uom):
    return WorkOrderMaterial.objects.create(
        work_order=wo, component=component, quantity_planned=Decimal(planned), uom=uom, source="MANUAL",
        unit_cost_snapshot=Decimal(snapshot),
    )


def _consume(env, wo, component, qty, cost="50", with_move=True):
    move = None
    if with_move:
        internal, _ = Location.objects.get_or_create(name="Interno", location_type="INTERNAL", warehouse=env["warehouse"])
        virtual, _ = Location.objects.get_or_create(name="Producción", location_type="VIRTUAL")
        move = StockMove.objects.create(
            product=component, source_location=internal, destination_location=virtual,
            quantity=Decimal(qty), unit_cost=Decimal(cost), date=date(2026, 3, 5), description="consumo",
        )
    return ProductionConsumption.objects.create(
        work_order=wo, product=component, warehouse=env["warehouse"], quantity=Decimal(qty), stock_move=move,
    )


def _perf(env, **kw):
    return ProductionPerformanceSelector.get_performance(env["product"], **{**RANGE, **kw})


def _row(env, wo, **kw):
    return next(r for r in _perf(env, **kw)["orders"] if r["id"] == wo.id)


def test_real_cost_from_consumption_moves(env):
    paper = _component(env)
    wo = _ot(env)
    _consume(env, wo, paper, "4", cost="60")
    assert _row(env, wo)["real_cost"] == pytest.approx(240.0)
    assert _row(env, wo)["estimated"] is False


def test_missing_stock_move_marks_estimated(env):
    paper = _component(env, cost="50")
    wo = _ot(env)
    _consume(env, wo, paper, "4", with_move=False)
    row = _row(env, wo)
    assert row["real_cost"] == pytest.approx(200.0)
    assert row["estimated"] is True


def test_planned_cost_from_snapshot_and_deviation(env):
    paper = _component(env)
    wo = _ot(env)
    _material(wo, paper, "4", "50", env["uom"])
    _consume(env, wo, paper, "5", cost="60")
    row = _row(env, wo)
    assert row["planned_cost"] == pytest.approx(200.0)
    assert row["deviation"] == pytest.approx(100.0)
    assert row["deviation_pct"] == pytest.approx(50.0)


def test_zero_planned_has_zero_pct(env):
    paper = _component(env)
    wo = _ot(env)
    _consume(env, wo, paper, "2", cost="60")
    row = _row(env, wo)
    assert row["planned_cost"] == 0.0
    assert row["deviation_pct"] == 0.0


def test_unfinished_orders_excluded(env):
    _ot(env, status="IN_PROGRESS")
    _ot(env, status="CANCELLED")
    assert _perf(env)["orders"] == []
    assert _perf(env)["kpis"]["orders"] == 0


def test_order_without_consumption_listed_but_not_averaged(env):
    paper = _component(env)
    with_cost = _ot(env, qty="10")
    _consume(env, with_cost, paper, "4", cost="50")  # real 200 for 10 units → 20 / unit
    _ot(env, qty="10")  # no consumption
    result = _perf(env)
    assert len(result["orders"]) == 2
    assert result["kpis"]["unit_real_cost"] == pytest.approx(20.0)


def test_unit_real_cost_vs_bom(env):
    paper = _component(env, cost="50")
    bom = BillOfMaterials.objects.create(product=env["product"], name="BOM", active=True)
    BillOfMaterialsLine.objects.create(bom=bom, component=paper, quantity=Decimal("1"), uom=env["uom"])
    wo = _ot(env, qty="10")
    _consume(env, wo, paper, "6", cost="50")  # 300 / 10 = 30 per unit vs BOM 50
    Product.objects.filter(pk=paper.pk).update(cost_price=Decimal("50"))  # stock moves recompute the weighted cost
    kpis = _perf(env)["kpis"]
    assert kpis["bom_cost"] == pytest.approx(50.0)
    assert kpis["unit_real_cost"] == pytest.approx(30.0)
    assert kpis["bom_gap_pct"] == pytest.approx(-40.0)


def test_no_bom_gap_zero(env):
    paper = _component(env)
    wo = _ot(env)
    _consume(env, wo, paper, "6")
    kpis = _perf(env)["kpis"]
    assert kpis["bom_cost"] == 0.0
    assert kpis["bom_gap_pct"] == 0.0


def test_margin_from_sale_line(env):
    paper = _component(env)
    delivery_line = _sale(env, qty="10", price="1000", gross="1190", discount="1190")  # subtotal 10 * 1190 - 1190
    wo = _ot(env, sale_line=delivery_line.sale_line, qty="10")
    _consume(env, wo, paper, "4", cost="50")
    row = _row(env, wo)
    # net of IVA and the 1190 line discount: 10 × 1000 × (1 − 1190 / 11900)
    assert row["revenue"] == pytest.approx(9000.0)
    assert row["margin"] == pytest.approx(9000.0 - 200.0)


def test_manual_order_has_no_revenue(env):
    wo = _ot(env)
    row = _row(env, wo)
    assert row["revenue"] is None and row["margin"] is None


def test_actual_quantity_wins_over_planned(env):
    paper = _component(env)
    wo = _ot(env, qty="10", actual="8")
    _consume(env, wo, paper, "4", cost="50")
    assert _row(env, wo)["qty"] == pytest.approx(8.0)
    assert _perf(env)["kpis"]["unit_real_cost"] == pytest.approx(25.0)


def test_material_uom_converted_to_component_base(env):
    from inventory.models import UoM as UoMModel

    dozen = UoMModel.objects.create(name="Docena", category=env["uom"].category, uom_type="BIGGER", ratio=Decimal("12"))
    paper = _component(env)
    wo = _ot(env)
    _material(wo, paper, "1", "50", dozen)  # 1 dozen = 12 base units
    _consume(env, wo, paper, "12", cost="50")
    row = _row(env, wo)
    assert row["planned_cost"] == pytest.approx(600.0)
    assert row["deviation"] == pytest.approx(0.0)


def test_materials_table_aggregates_per_component(env):
    paper = _component(env)
    for qty in ("4", "6"):
        wo = _ot(env)
        _material(wo, paper, "5", "50", env["uom"])
        _consume(env, wo, paper, qty, cost="50")
    (mat,) = _perf(env)["materials"]
    assert mat["name"] == "Papel"
    assert mat["planned_qty"] == pytest.approx(10.0)
    assert mat["consumed_qty"] == pytest.approx(10.0)
    assert mat["deviation"] == pytest.approx(0.0)


def test_stage_durations_and_lead_time(env):
    wo = _ot(
        env, finished_on=datetime(2026, 3, 10, tzinfo=timezone.utc),
        stages=[("PREPRESS", datetime(2026, 3, 1, tzinfo=timezone.utc)), ("PRESS", datetime(2026, 3, 4, tzinfo=timezone.utc))],
    )
    result = _perf(env)
    stages = {s["stage"]: s for s in result["stages"]}
    assert stages["PREPRESS"]["avg_days"] == pytest.approx(3.0)
    assert stages["PRESS"]["avg_days"] == pytest.approx(6.0)
    assert result["kpis"]["lead_time_days"] == pytest.approx(9.0)
    assert wo.id


def test_express_has_no_stages(env):
    env["product"].product_type = "MANUFACTURABLE"
    env["product"].mfg_auto_finalize = True
    env["product"].save()
    _ot(env, stages=[("PRESS", datetime(2026, 3, 1, tzinfo=timezone.utc))])
    result = _perf(env)
    assert result["stages"] == []
    assert result["kpis"]["lead_time_days"] is None


def test_rectification_rate(env):
    _ot(env, rectified=True)
    _ot(env, rectified=False)
    assert _perf(env)["kpis"]["rectification_rate"] == pytest.approx(50.0)


def test_variant_orders_included(env):
    template = env["product"]
    template.has_variants = True
    template.save()
    variant = Product.objects.create(
        name="Tarjeta Roja", category=env["category"], uom=env["uom"], sale_uom=env["uom"],
        purchase_uom=env["uom"], product_type="STORABLE", sale_price=Decimal("1000"), parent_template=template,
    )
    _ot(env, product=variant)
    assert _perf(env)["kpis"]["orders"] == 1


def test_orders_outside_range_ignored(env):
    _ot(env, finished_on=datetime(2025, 1, 1, tzinfo=timezone.utc))
    assert _perf(env)["kpis"]["orders"] == 0


def test_empty_range_zeroed(env):
    result = _perf(env)
    assert result["orders"] == [] and result["materials"] == [] and result["stages"] == []
    assert result["kpis"]["unit_real_cost"] == 0.0 and result["kpis"]["orders"] == 0


def test_query_count_constant(env):
    paper = _component(env)

    def add():
        wo = _ot(env)
        _material(wo, paper, "4", "50", env["uom"])
        _consume(env, wo, paper, "4")

    add()
    with CaptureQueriesContext(connection) as few:
        _perf(env)
    for _ in range(8):
        add()
    with CaptureQueriesContext(connection) as many:
        _perf(env)
    assert len(many) == len(few)
    assert UoM.objects.exists()



def test_revenue_is_net_of_iva_and_discount(env):
    delivery_line = _sale(env, qty="10", price="1000", gross="1190", discount="1190")  # net 10000 − 10 %
    wo = _ot(env, sale_line=delivery_line.sale_line, qty="10")
    _consume(env, wo, _component(env), "4", cost="50")
    row = _row(env, wo)
    assert row["revenue"] == pytest.approx(9000.0)
    assert row["margin"] == pytest.approx(9000.0 - 200.0)


def test_sale_line_quantity_is_converted_to_product_base_unit(env):
    dozen = UoM.objects.create(name="Docena", category=env["uom"].category, uom_type="BIGGER", ratio=Decimal("12"))
    delivery_line = _sale(env, qty="2", uom=dozen)
    wo = _ot(env, sale_line=delivery_line.sale_line, qty="2")
    _consume(env, wo, _component(env), "4", cost="60")  # real 240 for 24 base units
    assert _row(env, wo)["qty"] == pytest.approx(24.0)
    assert _perf(env)["kpis"]["unit_real_cost"] == pytest.approx(10.0)


def test_service_and_outsourced_cost_counts_in_real_cost_and_materials(env):
    service = Product.objects.create(
        name="Laminado", category=env["category"], uom=env["uom"], sale_uom=env["uom"], purchase_uom=env["uom"],
        product_type="SERVICE", sale_price=Decimal("10"),
    )
    wo = _ot(env)
    mat = _material(wo, service, "1", "0", env["uom"])
    mat.is_outsourced = True
    mat.unit_price = Decimal("30000")
    mat.save()
    result = _perf(env)
    assert _row(env, wo)["real_cost"] == pytest.approx(30000.0)
    assert _row(env, wo)["planned_cost"] == pytest.approx(30000.0)
    assert [m["name"] for m in result["materials"]] == ["Laminado"]


def test_order_without_any_cost_reports_null_cost_fields(env):
    wo = _ot(env)
    row = _row(env, wo)
    assert row["real_cost"] is None and row["deviation"] is None
    assert row["deviation_pct"] is None and row["margin"] is None


def test_stage_average_ignores_same_stage_notes_and_is_per_order(env):
    _ot(
        env, finished_on=datetime(2026, 3, 10, tzinfo=timezone.utc),
        stages=[
            ("PREPRESS", datetime(2026, 3, 1, tzinfo=timezone.utc)),
            ("PREPRESS", datetime(2026, 3, 3, tzinfo=timezone.utc)),  # note logged while still in PREPRESS
            ("PRESS", datetime(2026, 3, 5, tzinfo=timezone.utc)),
        ],
    )
    stages = {s["stage"]: s for s in _perf(env)["stages"]}
    assert stages["PREPRESS"]["avg_days"] == pytest.approx(4.0)


def test_query_count_constant_with_more_bom_components(env):
    """get_bom_cost() reads the active BOM: the selector must not query each component (product not prefetched)."""
    bom = BillOfMaterials.objects.create(product=env["product"], name="BOM", active=True)
    BillOfMaterialsLine.objects.create(bom=bom, component=_component(env, "C0", "10"), quantity=Decimal("1"), uom=env["uom"])
    _ot(env)
    _perf(env)
    with CaptureQueriesContext(connection) as few:
        _perf(env)
    for i in range(1, 8):
        BillOfMaterialsLine.objects.create(bom=bom, component=_component(env, f"C{i}", "10"), quantity=Decimal("1"), uom=env["uom"])
    with CaptureQueriesContext(connection) as many:
        _perf(env)
    assert len(many) == len(few)
