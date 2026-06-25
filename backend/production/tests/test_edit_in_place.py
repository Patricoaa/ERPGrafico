"""Tests for Phase 4 edit-in-place governance.

Covers:
- WorkOrderService.check_side_effects
- WorkOrderService.update_volume (quantity recalculation, guards)
- WorkOrderService.update_mfg_section (section locking, identity guard)
- views: update() identity field guard (HTTP 400)
- views: update_section action routing
- views: restart action
"""

from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from production.models import WorkOrder, WorkOrderMaterial
from production.services import WorkOrderService

# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def uom(db):
    from inventory.models import UoM, UoMCategory

    cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="unidad", defaults={"ratio": 1, "category": cat})
    return uom


@pytest.fixture
def component(db, uom):
    from inventory.models import Product, ProductCategory

    cat, _ = ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})
    return Product.objects.create(
        name="Papel Test",
        internal_code="PAP-TEST-001",
        product_type="CONSUMABLE",
        uom=uom,
        category=cat,
    )


@pytest.fixture
def draft_order(db):
    return WorkOrder.objects.create(
        description="OT Prueba",
        status=WorkOrder.Status.DRAFT,
        current_stage=WorkOrder.Stage.MATERIAL_ASSIGNMENT,
        stage_data={"quantity": 100, "uom_id": 1},
    )


@pytest.fixture
def bom_material(db, draft_order, component, uom):
    return WorkOrderMaterial.objects.create(
        work_order=draft_order,
        component=component,
        quantity_planned=Decimal("50"),
        uom=uom,
        source="BOM",
    )


# ── check_side_effects ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_check_side_effects_clean_order(draft_order):
    effects = WorkOrderService.check_side_effects(draft_order)
    assert effects["has_confirmed_pos"] is False
    assert effects["has_stock_movements"] is False
    assert effects["completed_tasks_count"] == 0
    assert effects["manually_edited_materials_count"] == 0


@pytest.mark.django_db
def test_check_side_effects_manual_material(draft_order, component, uom):
    WorkOrderMaterial.objects.create(
        work_order=draft_order,
        component=component,
        quantity_planned=Decimal("10"),
        uom=uom,
        source="MANUAL",
        is_outsourced=False,
    )
    effects = WorkOrderService.check_side_effects(draft_order)
    assert effects["manually_edited_materials_count"] == 1


@pytest.mark.django_db
def test_check_side_effects_stock_movement(draft_order):
    from inventory.models import UoM, Warehouse
    from production.models import ProductionConsumption

    uom = UoM.objects.get(name="unidad")
    warehouse, _ = Warehouse.objects.get_or_create(name="Bodega Test", defaults={"code": "WH-TST"})
    from inventory.models import Product

    product = Product.objects.first()
    if product:
        ProductionConsumption.objects.create(
            work_order=draft_order,
            product=product,
            quantity=Decimal("5"),
            warehouse=warehouse,
        )
        effects = WorkOrderService.check_side_effects(draft_order)
        assert effects["has_stock_movements"] is True


# ── update_volume ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_update_volume_recalculates_bom_materials(draft_order, bom_material, uom):
    # BOM material starts at 50 units for 100 quantity → should scale to 75 for 150
    WorkOrderService.update_volume(draft_order, quantity=150, uom_id=uom.id)
    bom_material.refresh_from_db()
    assert float(bom_material.quantity_planned) == pytest.approx(75.0)


@pytest.mark.django_db
def test_update_volume_blocked_when_not_draft(draft_order, uom):
    draft_order.status = WorkOrder.Status.IN_PROGRESS
    draft_order.save()
    with pytest.raises(ValidationError, match="Borrador"):
        WorkOrderService.update_volume(draft_order, quantity=200, uom_id=uom.id)


@pytest.mark.django_db
def test_update_volume_blocked_for_linked_ot(draft_order, uom, sale_line_factory):
    sale_line = sale_line_factory()
    draft_order.sale_line = sale_line
    draft_order.sale_order = sale_line.order
    draft_order.save()
    with pytest.raises(ValidationError, match="Nota de Venta"):
        WorkOrderService.update_volume(draft_order, quantity=200, uom_id=uom.id)


@pytest.mark.django_db
def test_update_volume_blocked_with_stock_movements(draft_order, uom, component):
    from inventory.models import Warehouse
    from production.models import ProductionConsumption

    warehouse, _ = Warehouse.objects.get_or_create(name="Bodega Test", defaults={"code": "WH-TST"})
    ProductionConsumption.objects.create(
        work_order=draft_order,
        product=component,
        quantity=Decimal("5"),
        warehouse=warehouse,
    )
    with pytest.raises(ValidationError, match="movimientos de stock"):
        WorkOrderService.update_volume(draft_order, quantity=200, uom_id=uom.id)


@pytest.mark.django_db
def test_update_volume_updates_stage_data(draft_order, uom):
    WorkOrderService.update_volume(draft_order, quantity=250, uom_id=uom.id)
    draft_order.refresh_from_db()
    assert draft_order.stage_data["quantity"] == 250
    assert draft_order.stage_data["uom_id"] == uom.id


@pytest.mark.django_db
def test_update_volume_creates_history(draft_order, uom):
    from production.models import WorkOrderHistory

    before = WorkOrderHistory.objects.filter(work_order=draft_order).count()
    WorkOrderService.update_volume(draft_order, quantity=200, uom_id=uom.id)
    after = WorkOrderHistory.objects.filter(work_order=draft_order).count()
    assert after == before + 1


# ── update_mfg_section ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_update_mfg_section_planning_updates_stage_data(draft_order):
    WorkOrderService.update_mfg_section(draft_order, "planning", {"internal_notes": "Urgente"})
    draft_order.refresh_from_db()
    assert draft_order.stage_data["internal_notes"] == "Urgente"


@pytest.mark.django_db
def test_update_mfg_section_filters_unknown_keys(draft_order):
    WorkOrderService.update_mfg_section(
        draft_order, "planning", {"internal_notes": "ok", "UNKNOWN_KEY": "injected"}
    )
    draft_order.refresh_from_db()
    assert "UNKNOWN_KEY" not in draft_order.stage_data


@pytest.mark.django_db
def test_update_mfg_section_invalid_section_raises(draft_order):
    with pytest.raises(ValidationError, match="no válida"):
        WorkOrderService.update_mfg_section(draft_order, "identity", {"name": "hack"})


@pytest.mark.django_db
def test_update_mfg_section_volume_not_allowed(draft_order):
    with pytest.raises(ValidationError, match="no válida"):
        WorkOrderService.update_mfg_section(draft_order, "volume", {"quantity": 999})


@pytest.mark.django_db
def test_update_mfg_section_prepress_blocked_when_started(draft_order):
    draft_order.current_stage = WorkOrder.Stage.PREPRESS
    draft_order.save()
    with pytest.raises(ValidationError, match="Pre-Impresión"):
        WorkOrderService.update_mfg_section(draft_order, "prepress", {"prepress_specs": "x"})


@pytest.mark.django_db
def test_update_mfg_section_press_blocked_when_started(draft_order):
    draft_order.current_stage = WorkOrder.Stage.PRESS
    draft_order.save()
    with pytest.raises(ValidationError, match="Impresión"):
        WorkOrderService.update_mfg_section(draft_order, "press", {"press_specs": "x"})


@pytest.mark.django_db
def test_update_mfg_section_blocked_when_finished(draft_order):
    draft_order.status = WorkOrder.Status.FINISHED
    draft_order.save()
    with pytest.raises(ValidationError, match="cerrada"):
        WorkOrderService.update_mfg_section(draft_order, "planning", {"internal_notes": "x"})


@pytest.mark.django_db
def test_update_mfg_section_creates_history(draft_order):
    from production.models import WorkOrderHistory

    before = WorkOrderHistory.objects.filter(work_order=draft_order).count()
    WorkOrderService.update_mfg_section(draft_order, "planning", {"internal_notes": "test"})
    after = WorkOrderHistory.objects.filter(work_order=draft_order).count()
    assert after == before + 1


# ── views: update identity guard ──────────────────────────────────────────────


@pytest.mark.django_db
def test_update_rejects_product_field(api_client, draft_order):
    url = f"/api/production/orders/{draft_order.id}/"
    resp = api_client.patch(url, {"product": 999}, format="multipart")
    assert resp.status_code == 400
    assert "corregida" in str(resp.data).lower() or "OT" in str(resp.data)


@pytest.mark.django_db
def test_update_rejects_sale_order_field(api_client, draft_order):
    url = f"/api/production/orders/{draft_order.id}/"
    resp = api_client.patch(url, {"sale_order": 1}, format="multipart")
    assert resp.status_code == 400


# ── views: update_section action ──────────────────────────────────────────────


@pytest.mark.django_db
def test_update_section_planning_via_api(api_client, draft_order):
    url = f"/api/production/orders/{draft_order.id}/update_section/"
    resp = api_client.patch(
        url,
        {"section": "planning", "payload": {"internal_notes": "via API"}},
        format="json",
    )
    assert resp.status_code == 200
    draft_order.refresh_from_db()
    assert draft_order.stage_data.get("internal_notes") == "via API"


@pytest.mark.django_db
def test_update_section_volume_via_api(api_client, draft_order, uom, bom_material):
    url = f"/api/production/orders/{draft_order.id}/update_section/"
    resp = api_client.patch(
        url,
        {"section": "volume", "payload": {"quantity": 200, "uom_id": uom.id}},
        format="json",
    )
    assert resp.status_code == 200
    bom_material.refresh_from_db()
    assert float(bom_material.quantity_planned) == pytest.approx(100.0)


@pytest.mark.django_db
def test_update_section_missing_payload_returns_400(api_client, draft_order):
    url = f"/api/production/orders/{draft_order.id}/update_section/"
    resp = api_client.patch(url, {"section": "planning", "payload": None}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_update_section_invalid_section_returns_400(api_client, draft_order):
    url = f"/api/production/orders/{draft_order.id}/update_section/"
    resp = api_client.patch(
        url, {"section": "identity", "payload": {"name": "hack"}}, format="json"
    )
    assert resp.status_code == 400


# ── views: restart action ─────────────────────────────────────────────────────


@pytest.mark.django_db
def test_restart_clean_draft_deletes_and_returns_initial_data(api_client, draft_order):
    order_id = draft_order.id
    url = f"/api/production/orders/{order_id}/restart/"
    resp = api_client.post(url)
    assert resp.status_code == 200
    assert "initial_data" in resp.data
    assert not WorkOrder.objects.filter(id=order_id).exists()


@pytest.mark.django_db
def test_restart_blocked_when_not_draft(api_client, draft_order):
    draft_order.status = WorkOrder.Status.IN_PROGRESS
    draft_order.save()
    url = f"/api/production/orders/{draft_order.id}/restart/"
    resp = api_client.post(url)
    assert resp.status_code == 400


@pytest.mark.django_db
def test_restart_blocked_with_side_effects_returns_409(api_client, draft_order, component, uom):
    WorkOrderMaterial.objects.create(
        work_order=draft_order,
        component=component,
        quantity_planned=Decimal("10"),
        uom=uom,
        source="MANUAL",
        is_outsourced=False,
    )
    url = f"/api/production/orders/{draft_order.id}/restart/"
    resp = api_client.post(url)
    assert resp.status_code == 409
    assert "side_effects" in resp.data
