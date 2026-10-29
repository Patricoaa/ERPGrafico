from datetime import date

import pytest

from production.models import WorkOrder
from production.serializers import WorkOrderSerializer


@pytest.fixture
def minimal_work_order(db):
    return WorkOrder.objects.create(
        description="Test OT",
        status=WorkOrder.Status.DRAFT,
        current_stage=WorkOrder.Stage.MATERIAL_ASSIGNMENT,
        estimated_completion_date=date(2026, 6, 1),
    )


@pytest.mark.django_db
def test_workorder_serializer_exposes_due_date_alias(minimal_work_order):
    data = WorkOrderSerializer(minimal_work_order).data
    assert "due_date" in data, "due_date alias must be present in serializer output"
    assert "estimated_completion_date" in data, "estimated_completion_date must remain present"
    assert data["due_date"] == data["estimated_completion_date"] == "2026-06-01"


@pytest.mark.django_db
def test_workorder_serializer_due_date_null_when_not_set(db):
    wo = WorkOrder.objects.create(
        description="Sin fecha",
        status=WorkOrder.Status.DRAFT,
        current_stage=WorkOrder.Stage.MATERIAL_ASSIGNMENT,
    )
    data = WorkOrderSerializer(wo).data
    assert data["due_date"] is None
    assert data["estimated_completion_date"] is None


@pytest.mark.django_db
def test_production_outcome_null_until_finished(work_order_factory):
    data = WorkOrderSerializer(work_order_factory()).data
    assert data["production_outcome"] is None


@pytest.mark.django_db
def test_production_outcome_for_sale_order_reports_delivery(work_order_factory, sale_line_factory, warehouse_factory):
    from decimal import Decimal

    line = sale_line_factory(quantity_delivered=Decimal("40"))
    wo = work_order_factory(
        status=WorkOrder.Status.FINISHED,
        current_stage=WorkOrder.Stage.FINISHED,
        sale_order=line.order,
        sale_line=line,
        warehouse=warehouse_factory(name="Bodega Central"),
    )
    outcome = WorkOrderSerializer(wo).data["production_outcome"]
    assert outcome["kind"] == "SALE_ORDER"
    assert outcome["sale_order"] == {"id": line.order.id, "number": line.order.number}
    assert outcome["delivery"] == {"status": "PARTIAL", "ordered": 100.0, "delivered": 40.0}
    assert outcome["warehouse_name"] == "Bodega Central"
    assert outcome["quantity"] == 100.0


@pytest.mark.django_db
def test_production_outcome_for_stock_reports_warehouse(work_order_factory, manufacturable_product, warehouse_factory):
    manufacturable_product.track_inventory = True
    manufacturable_product.save()
    wo = work_order_factory(
        status=WorkOrder.Status.FINISHED,
        current_stage=WorkOrder.Stage.FINISHED,
        product=manufacturable_product,
        warehouse=warehouse_factory(name="Bodega Norte"),
        stage_data={"quantity": 250},
    )
    outcome = WorkOrderSerializer(wo).data["production_outcome"]
    assert outcome["kind"] == "STOCK"
    assert outcome["stocked"] is True
    assert outcome["warehouse_name"] == "Bodega Norte"
    assert outcome["quantity"] == 250.0
    assert outcome["delivery"] is None


@pytest.mark.django_db
def test_editing_a_closed_material_stage_is_logged_under_it(work_order_factory, manufacturable_product):
    from decimal import Decimal

    from production.models import WorkOrderHistory
    from production.services import WorkOrderService

    wo = work_order_factory(status=WorkOrder.Status.IN_PROGRESS, current_stage=WorkOrder.Stage.PRESS)
    WorkOrderService.add_material(work_order=wo, component=manufacturable_product, quantity=Decimal("2"))
    material = wo.materials.get()
    WorkOrderService.update_material(work_order=wo, material_id=material.id, quantity=Decimal("3"))

    entry = WorkOrderHistory.objects.get(work_order=wo, event=WorkOrderHistory.Event.EDITED)
    assert entry.stage == "MATERIAL_ASSIGNMENT"
    assert "modificado" in entry.notes


@pytest.mark.django_db
def test_config_edit_is_logged_under_mfg_config(work_order_factory):
    from production.models import WorkOrderHistory
    from production.services import WorkOrderService

    wo = work_order_factory(status=WorkOrder.Status.IN_PROGRESS, current_stage=WorkOrder.Stage.MATERIAL_APPROVAL,
                            stage_data={"phases": {"press": False}, "press_specs": ""})
    before = dict(wo.stage_data)
    wo.stage_data = {"phases": {"press": True}, "press_specs": "4/0 couché"}
    wo.save()
    WorkOrderService.record_config_edit(wo, before)

    entry = WorkOrderHistory.objects.get(work_order=wo, event=WorkOrderHistory.Event.EDITED)
    assert entry.stage == "MFG_CONFIG"
    assert "Impresión habilitada" in entry.notes
