import pytest
from django.core.exceptions import ValidationError

from production.models import WorkOrder
from production.services import WorkOrderService
from workflow.models import Task

Stage = WorkOrder.Stage


def _approve_pending(wo):
    Task.objects.filter(
        object_id=wo.pk, category=Task.Category.APPROVAL, status=Task.Status.PENDING
    ).update(status=Task.Status.COMPLETED)


def _approval_tasks(wo, task_type):
    return Task.objects.filter(object_id=wo.pk, task_type=task_type)


@pytest.mark.django_db
def test_invalid_transition_rejected(work_order_factory):
    """Direct jump from MATERIAL_ASSIGNMENT to FINISHED must be rejected."""
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT)
    with pytest.raises(ValidationError, match="Transición inválida"):
        WorkOrderService.transition_to(wo, Stage.FINISHED)


@pytest.mark.django_db
def test_invalid_transition_skipping_middle_stages(work_order_factory):
    """Jump from MATERIAL_ASSIGNMENT to RECTIFICATION must be rejected when a stage in
    between applies to the OT (here, the press phase it requires)."""
    wo = work_order_factory(
        current_stage=Stage.MATERIAL_ASSIGNMENT, stage_data={"phases": {"press": True}}
    )
    with pytest.raises(ValidationError, match="Transición inválida"):
        WorkOrderService.transition_to(wo, Stage.RECTIFICATION)


@pytest.mark.django_db
def test_valid_forward_transition(work_order_factory):
    """MATERIAL_ASSIGNMENT → MATERIAL_APPROVAL is valid."""
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT)
    WorkOrderService.transition_to(wo, Stage.MATERIAL_APPROVAL)
    wo.refresh_from_db()
    assert wo.current_stage == Stage.MATERIAL_APPROVAL


@pytest.mark.django_db
def test_valid_skip_optional_stage(work_order_factory):
    """MATERIAL_ASSIGNMENT → PRESS is valid (skipping optional outsourcing+prepress)."""
    wo = work_order_factory(
        current_stage=Stage.MATERIAL_ASSIGNMENT, stage_data={"phases": {"press": True}}
    )
    WorkOrderService.transition_to(wo, Stage.PRESS)
    wo.refresh_from_db()
    assert wo.current_stage == Stage.PRESS


@pytest.mark.django_db
def test_valid_backward_transition(work_order_factory):
    """Backward move (PRESS → MATERIAL_APPROVAL) is always allowed."""
    wo = work_order_factory(
        current_stage=Stage.PRESS,
        status=WorkOrder.Status.IN_PROGRESS,
    )
    WorkOrderService.transition_to(wo, Stage.MATERIAL_APPROVAL)
    wo.refresh_from_db()
    assert wo.current_stage == Stage.MATERIAL_APPROVAL


@pytest.mark.django_db
def test_terminal_finished_cannot_transition(work_order_factory):
    """No transition allowed out of FINISHED."""
    wo = work_order_factory(
        current_stage=Stage.FINISHED,
        status=WorkOrder.Status.FINISHED,
    )
    with pytest.raises(ValidationError, match="terminal"):
        WorkOrderService.transition_to(wo, Stage.RECTIFICATION)


@pytest.mark.django_db
def test_terminal_cancelled_cannot_transition(work_order_factory):
    """No transition allowed out of CANCELLED."""
    wo = work_order_factory(
        current_stage=Stage.CANCELLED,
        status=WorkOrder.Status.CANCELLED,
    )
    with pytest.raises(ValidationError, match="terminal"):
        WorkOrderService.transition_to(wo, Stage.MATERIAL_ASSIGNMENT)


@pytest.mark.django_db
def test_backward_transition_blocked_by_irreversible_effects(work_order_factory, monkeypatch):
    """The server, not only the UI, refuses a rewind when POs/stock exist."""
    wo = work_order_factory(current_stage=Stage.PRESS, status=WorkOrder.Status.IN_PROGRESS)
    monkeypatch.setattr(
        WorkOrderService, "rewind_blockers", staticmethod(lambda _wo, _target=None: ["Existen movimientos de stock."])
    )
    with pytest.raises(ValidationError, match="Retroceso bloqueado"):
        WorkOrderService.transition_to(wo, Stage.MATERIAL_ASSIGNMENT)
    wo.refresh_from_db()
    assert wo.current_stage == Stage.PRESS


@pytest.mark.django_db
def test_rewind_ignores_completed_tasks_and_returns_to_draft(work_order_factory):
    """Completed approvals are reset by the rewind, so they must not block it."""
    wo = work_order_factory(
        current_stage=Stage.MATERIAL_ASSIGNMENT, stage_data={"phases": {"press": True}}
    )
    WorkOrderService.transition_to(wo, Stage.MATERIAL_APPROVAL)
    _approve_pending(wo)
    WorkOrderService.transition_to(wo, Stage.PRESS)
    wo.refresh_from_db()
    assert wo.status == WorkOrder.Status.IN_PROGRESS
    effects = WorkOrderService.check_side_effects(wo)
    assert effects["completed_tasks_count"] > 0  # what used to block the UI rewind
    assert effects["rewind_blockers"] == []

    WorkOrderService.transition_to(wo, Stage.MATERIAL_ASSIGNMENT)
    wo.refresh_from_db()
    assert wo.current_stage == Stage.MATERIAL_ASSIGNMENT
    assert wo.status == WorkOrder.Status.DRAFT


@pytest.mark.django_db
def test_generic_patch_cannot_edit_stage_data_of_started_stage(work_order_factory):
    wo = work_order_factory(
        current_stage=Stage.PRESS,
        status=WorkOrder.Status.IN_PROGRESS,
        stage_data={"press_specs": "4/0", "contact_name": "A"},
    )
    with pytest.raises(ValidationError, match="Impresión"):
        WorkOrderService.validate_stage_data_edit(wo, {"press_specs": "4/4"})
    # Untouched or non-stage keys stay editable
    WorkOrderService.validate_stage_data_edit(wo, {"press_specs": "4/0", "contact_name": "B"})


@pytest.mark.django_db
def test_forward_blocked_by_pending_approval_on_server(work_order_factory):
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT)
    WorkOrderService.transition_to(wo, Stage.MATERIAL_APPROVAL)
    with pytest.raises(ValidationError, match="aprobaciones pendientes"):
        WorkOrderService.transition_to(wo, Stage.OUTSOURCING_ASSIGNMENT)
    wo.refresh_from_db()
    assert wo.current_stage == Stage.MATERIAL_APPROVAL
    _approve_pending(wo)
    WorkOrderService.transition_to(wo, Stage.OUTSOURCING_ASSIGNMENT)


@pytest.mark.django_db
def test_reopening_a_stage_reuses_its_approval_task(work_order_factory):
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT)
    WorkOrderService.transition_to(wo, Stage.MATERIAL_APPROVAL)
    _approve_pending(wo)
    WorkOrderService.transition_to(wo, Stage.OUTSOURCING_ASSIGNMENT)
    WorkOrderService.transition_to(wo, Stage.MATERIAL_APPROVAL)  # reopen
    tasks = _approval_tasks(wo, "OT_MATERIAL_APPROVAL")
    assert tasks.count() == 1
    assert tasks.first().status == Task.Status.PENDING


@pytest.mark.django_db
def test_cancelled_purchase_order_does_not_block_rewind(work_order_factory):
    from purchasing.models import PurchaseOrder

    wo = work_order_factory(current_stage=Stage.PRESS, status=WorkOrder.Status.IN_PROGRESS)
    po = PurchaseOrder.objects.create(
        number="OC-T1", supplier=_supplier(), work_order=wo, status=PurchaseOrder.Status.CONFIRMED
    )
    assert WorkOrderService.rewind_blockers(wo)
    po.status = PurchaseOrder.Status.CANCELLED
    po.save()
    assert WorkOrderService.rewind_blockers(wo) == []


def _supplier():
    from contacts.models import Contact

    return Contact.objects.create(name="Proveedor Test", tax_id="76.000.000-0")


def _make_consumption(work_order, product, warehouse):
    from decimal import Decimal
    from production.models import ProductionConsumption

    ProductionConsumption.objects.create(work_order=work_order, product=product, warehouse=warehouse, quantity=Decimal("1"))


@pytest.mark.django_db
def test_stock_movements_do_not_block_reopening_press(work_order_factory, manufacturable_product, warehouse_factory):
    """Stock movements (material consumptions) should only block reopening the material-
    assignment stages.  Process stages like PRESS / PREPRESS / POSTPRESS have nothing to do
    with stock records and must remain reopenable even after a consumption exists."""
    wo = work_order_factory(current_stage=Stage.PRESS, status=WorkOrder.Status.IN_PROGRESS)
    _make_consumption(wo, manufacturable_product, warehouse_factory())

    blockers_for_press = WorkOrderService.rewind_blockers(wo, target_stage="PRESS")
    assert blockers_for_press == [], (
        "Stock movements must NOT block reopening PRESS; they only block material stages."
    )


@pytest.mark.django_db
def test_stock_movements_block_reopening_material_assignment(work_order_factory, manufacturable_product, warehouse_factory):
    """When material consumptions exist, reopening MATERIAL_ASSIGNMENT must be blocked
    because you can't 'unassign' materials that were already recorded as consumed."""
    wo = work_order_factory(current_stage=Stage.PRESS, status=WorkOrder.Status.IN_PROGRESS)
    _make_consumption(wo, manufacturable_product, warehouse_factory())

    blockers_for_material = WorkOrderService.rewind_blockers(wo, target_stage="MATERIAL_ASSIGNMENT")
    assert blockers_for_material, (
        "Stock movements must block reopening MATERIAL_ASSIGNMENT."
    )


@pytest.mark.django_db
def test_rewind_from_rectification_restores_planned_quantities(
    work_order_factory, manufacturable_product
):
    wo = work_order_factory(
        current_stage=Stage.RECTIFICATION,
        status=WorkOrder.Status.IN_PROGRESS,
        stage_data={"phases": {"press": True}},
    )
    uom = manufacturable_product.uom
    product = _product("Papel T", manufacturable_product)
    mat = wo.materials.create(component=product, quantity_planned=10, uom=uom)

    WorkOrderService.rectify_production(
        wo, material_adjustments=[{"material_id": mat.pk, "actual_quantity": 7}], produced_quantity=5
    )
    mat.refresh_from_db()
    assert mat.quantity_planned == 7 and wo.is_rectified

    WorkOrderService.transition_to(wo, Stage.PRESS)
    mat.refresh_from_db()
    wo.refresh_from_db()
    assert mat.quantity_planned == 10
    assert wo.is_rectified is False and wo.actual_quantity_produced is None
    assert "rectification_snapshot" not in wo.stage_data


def _product(name, manufacturable_product):
    from inventory.models import Product

    return Product.objects.create(
        name=name,
        internal_code=name.upper().replace(" ", "-"),
        uom=manufacturable_product.uom,
        category=manufacturable_product.category,
    )


@pytest.mark.django_db
def test_ordered_outsourced_service_is_read_only(work_order_factory, manufacturable_product):
    from purchasing.models import PurchaseLine, PurchaseOrder

    wo = work_order_factory(current_stage=Stage.PRESS, status=WorkOrder.Status.IN_PROGRESS)
    uom = manufacturable_product.uom
    service = _product("Servicio T", manufacturable_product)
    po = PurchaseOrder.objects.create(
        number="OC-T2", supplier=_supplier(), work_order=wo, status=PurchaseOrder.Status.CONFIRMED
    )
    line = PurchaseLine.objects.create(order=po, product=service, quantity=1, unit_cost=100, uom=uom)
    mat = wo.materials.create(
        component=service, quantity_planned=1, uom=uom, is_outsourced=True, purchase_line=line
    )
    with pytest.raises(ValidationError, match="OC-OC-T2|Orden de Compra"):
        WorkOrderService.update_material(work_order=wo, material_id=mat.pk, quantity=2)
    with pytest.raises(ValidationError):
        WorkOrderService.remove_material(wo, mat.pk)


@pytest.mark.django_db
def test_backward_transition_records_reopened_event(work_order_factory):
    """A backward transition must create a WorkOrderHistory entry with event=REOPENED."""
    from production.models import WorkOrderHistory
    wo = work_order_factory(current_stage=Stage.PRESS, status=WorkOrder.Status.IN_PROGRESS)
    WorkOrderService.transition_to(wo, Stage.MATERIAL_APPROVAL, notes="ajuste de diseño")
    entry = WorkOrderHistory.objects.filter(work_order=wo, stage=Stage.MATERIAL_APPROVAL).order_by("-created_at").first()
    assert entry is not None
    assert entry.event == WorkOrderHistory.Event.REOPENED


@pytest.mark.django_db
def test_forward_transition_records_entered_event(work_order_factory):
    """A forward transition must create a WorkOrderHistory entry with event=ENTERED."""
    from production.models import WorkOrderHistory
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT)
    WorkOrderService.transition_to(wo, Stage.MATERIAL_APPROVAL)
    entry = WorkOrderHistory.objects.filter(work_order=wo, stage=Stage.MATERIAL_APPROVAL).order_by("-created_at").first()
    assert entry is not None
    assert entry.event == WorkOrderHistory.Event.ENTERED
