"""Regressions found auditing the OT creation / stage flow (POS, OV, wizard).

Each test pins one defect of the audit so the fix can't silently regress.
"""

import uuid
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile

from contacts.models import Contact
from core.models import Attachment, User
from inventory.models import (
    Location,
    Product,
    ProductCategory,
    ProductManufacturingProfile,
    UoM,
    UoMCategory,
)
from production.models import (
    BillOfMaterials,
    BillOfMaterialsLine,
    ProductionConsumption,
    WorkOrder,
    WorkOrderMaterial,
)
from production.services import WorkOrderService
from purchasing.models import PurchaseOrder
from workflow.models import Task
from workflow.services import WorkflowService

Stage = WorkOrder.Stage


# ── fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def accounts(db):
    from accounting.models import Account, AccountingSettings, AccountType

    with patch("core.cache.invalidate_singleton"):
        settings = AccountingSettings.objects.create(
            asset_prefix="1", liability_prefix="2", equity_prefix="3", income_prefix="4", expense_prefix="5"
        )
    with patch("core.cache.cached_singleton", return_value=settings):
        asset = Account.objects.create(name="Inventario", account_type=AccountType.ASSET)
        income = Account.objects.create(name="Ingreso", account_type=AccountType.INCOME)
        expense = Account.objects.create(name="Gasto", account_type=AccountType.EXPENSE)
    for field in (
        "storable_inventory_account",
        "manufacturable_inventory_account",
    ):
        setattr(settings, field, asset)
    for field in (
        "default_consumable_account",
        "default_expense_account",
        "default_service_expense_account",
        "default_subscription_expense_account",
        "merchandise_cogs_account",
        "manufactured_cogs_account",
    ):
        setattr(settings, field, expense)
    for field in ("default_revenue_account", "default_service_revenue_account", "default_subscription_revenue_account"):
        setattr(settings, field, income)
    with patch("core.cache.invalidate_singleton"):
        settings.save()
    return {"asset": asset, "income": income, "expense": expense}


@pytest.fixture
def unit(db):
    category, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="unidad", defaults={"ratio": 1, "category": category})
    return uom


@pytest.fixture
def category(db, accounts):
    return ProductCategory.objects.create(
        name="Audit",
        prefix="AUD",
        asset_account=accounts["asset"],
        income_account=accounts["income"],
        expense_account=accounts["expense"],
    )


@pytest.fixture
def warehouse(db, warehouse_factory):
    wh = warehouse_factory()
    Location.objects.get_or_create(location_type="INTERNAL", warehouse=wh, defaults={"name": "Interno"})
    Location.objects.get_or_create(location_type="VIRTUAL", name="Producción")
    return wh


@pytest.fixture
def make_product(db, unit, category):
    counter = {"n": 0}

    def make(product_type=Product.Type.STORABLE, **kwargs):
        counter["n"] += 1
        defaults = {
            "name": f"Producto audit {counter['n']}",
            "internal_code": f"AUD-{counter['n']:03d}",
            "product_type": product_type,
            "uom": unit,
            "category": category,
            "track_inventory": False,
            "cost_price": Decimal("10"),
        }
        defaults.update(kwargs)
        return Product.objects.create(**defaults)

    return make


@pytest.fixture
def supplier(db):
    return Contact.objects.create(name="Proveedor audit", tax_id="76111111-1")


def _approve_pending(wo):
    Task.objects.filter(
        object_id=wo.pk, category=Task.Category.APPROVAL, status=Task.Status.PENDING
    ).update(status=Task.Status.COMPLETED)


def _advance(wo, *stages):
    for stage in stages:
        _approve_pending(wo)
        WorkOrderService.transition_to(wo, stage)
        wo.refresh_from_db()


def _material(wo, component, qty="2", **kwargs):
    return WorkOrderMaterial.objects.create(
        work_order=wo,
        component=component,
        quantity_planned=Decimal(qty),
        uom=component.uom,
        source="MANUAL",
        **kwargs,
    )


# ── 1. Express auto-finalization ────────────────────────────────────────────


@pytest.mark.django_db
def test_express_ot_is_finalized_and_consumes_its_bom(
    sale_line_factory, manufacturable_product, make_product, category, warehouse
):
    """mfg_auto_finalize used to call MATERIAL_ASSIGNMENT → FINISHED, which the stage
    allowlist rejects; the error was swallowed and the OT stayed in draft."""
    manufacturable_product.category = category
    manufacturable_product.mfg_auto_finalize = True  # legacy field: no profile exists in real data
    manufacturable_product.save()
    component = make_product()
    bom = BillOfMaterials.objects.create(product=manufacturable_product, name="BOM", active=True, yield_quantity=1)
    BillOfMaterialsLine.objects.create(bom=bom, component=component, quantity=Decimal("1"), uom=component.uom)
    line = sale_line_factory()

    wo = WorkOrderService.create_from_sale_line(line)
    wo.refresh_from_db()

    assert wo.current_stage == Stage.FINISHED
    assert wo.status == WorkOrder.Status.FINISHED
    assert ProductionConsumption.objects.filter(work_order=wo, product=component).exists()


@pytest.mark.django_db
def test_express_flag_is_read_from_the_profile_or_the_legacy_field(manufacturable_product):
    assert manufacturable_product.is_express is False
    manufacturable_product.mfg_auto_finalize = True
    manufacturable_product.save()
    assert manufacturable_product.is_express is True

    profile = ProductManufacturingProfile.objects.create(product=manufacturable_product, mfg_auto_finalize=False)
    manufacturable_product.refresh_from_db()
    assert manufacturable_product.is_express is False
    profile.mfg_auto_finalize = True
    profile.save()
    manufacturable_product.refresh_from_db()
    manufacturable_product.save()  # used to raise AttributeError (profile has no requires_advanced_manufacturing)
    assert manufacturable_product.is_express is True


# ── 2. finalize_production ──────────────────────────────────────────────────


@pytest.mark.django_db
def test_finalize_does_not_consume_or_double_count_services(
    work_order_factory, make_product, warehouse, supplier
):
    """Services were added to the cost twice and also stock-moved / consumed."""
    finished = make_product(Product.Type.MANUFACTURABLE)
    paper = make_product(cost_price=Decimal("10"))
    lamination = make_product(Product.Type.SERVICE, cost_price=Decimal("0"))
    wo = work_order_factory(
        current_stage=Stage.RECTIFICATION,
        status=WorkOrder.Status.IN_PROGRESS,
        is_manual=True,
        product=finished,
        warehouse=warehouse,
        stage_data={"quantity": 1},
    )
    _material(wo, paper, qty="3")
    _material(wo, lamination, qty="2", is_outsourced=True, supplier=supplier, unit_price=Decimal("100"))

    WorkOrderService.finalize_production(wo)

    assert not ProductionConsumption.objects.filter(work_order=wo, product=lamination).exists()
    consumption = ProductionConsumption.objects.get(work_order=wo, product=paper)
    assert consumption.stock_move.product_id == paper.id

    from accounting.models import JournalEntry

    entry = JournalEntry.objects.get(source_object_id=wo.id, description__startswith="Consumo Producción")
    debit = sum(item.debit for item in entry.items.all())
    credit = sum(item.credit for item in entry.items.all())
    # 3 × 10 (paper) + 2 × 100 (outsourced service) = 230, counted once and balanced
    assert debit == Decimal("230")
    assert credit == Decimal("230")


@pytest.mark.django_db
def test_finalize_links_each_consumption_to_its_own_move(work_order_factory, make_product, warehouse):
    finished = make_product(Product.Type.MANUFACTURABLE)
    paper = make_product()
    ink = make_product()
    wo = work_order_factory(
        current_stage=Stage.RECTIFICATION,
        status=WorkOrder.Status.IN_PROGRESS,
        is_manual=True,
        product=finished,
        warehouse=warehouse,
        stage_data={"quantity": 1},
    )
    _material(wo, paper)
    _material(wo, ink)

    WorkOrderService.finalize_production(wo)

    for consumption in ProductionConsumption.objects.filter(work_order=wo):
        assert consumption.stock_move.product_id == consumption.product_id


# ── 3/4. Cancellation goes through the annulment rules ─────────────────────


@pytest.mark.django_db
def test_annul_is_rejected_in_rectification(work_order_factory):
    wo = work_order_factory(
        current_stage=Stage.RECTIFICATION,
        status=WorkOrder.Status.IN_PROGRESS,
        stage_data={"phases": {"press": True}},
    )
    with pytest.raises(ValidationError, match="No se puede anular"):
        WorkOrderService.annul_work_order(wo)


@pytest.mark.django_db
def test_transition_to_cancelled_applies_annulment_rules(work_order_factory):
    """`transition`/`bulk_transition` to CANCELLED skipped the limit stage, the
    consumption check and the purchase-order cancellation of `annul_work_order`."""
    wo = work_order_factory(
        current_stage=Stage.POSTPRESS,
        status=WorkOrder.Status.IN_PROGRESS,
        stage_data={"phases": {"press": True, "postpress": True}},
    )
    with pytest.raises(ValidationError, match="No se puede anular"):
        WorkOrderService.transition_to(wo, Stage.CANCELLED)
    wo.refresh_from_db()
    assert wo.current_stage == Stage.POSTPRESS


@pytest.mark.django_db
def test_transition_to_cancelled_cancels_the_linked_purchase_orders(work_order_factory, supplier):
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT)
    po = PurchaseOrder.objects.create(number="9001", supplier=supplier, work_order=wo, status="DRAFT")

    WorkOrderService.transition_to(wo, Stage.CANCELLED)

    po.refresh_from_db()
    assert po.status == PurchaseOrder.Status.CANCELLED


@pytest.mark.django_db
def test_annul_closes_pending_stage_approvals(work_order_factory):
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT)
    WorkOrderService.transition_to(wo, Stage.MATERIAL_APPROVAL)
    assert Task.objects.filter(object_id=wo.pk, task_type="OT_MATERIAL_APPROVAL", status=Task.Status.PENDING).exists()

    WorkOrderService.annul_work_order(wo)

    assert not Task.objects.filter(
        object_id=wo.pk,
        category=Task.Category.APPROVAL,
        status__in=[Task.Status.PENDING, Task.Status.IN_PROGRESS],
    ).exists()


# ── 6. Stage graph: no dead ends, no skipping required stages ──────────────


@pytest.mark.django_db
def test_ot_without_print_phases_can_reach_rectification(work_order_factory):
    """Outsourcing assignment only allowed PREPRESS/PRESS: an OT without print
    phases had no way forward."""
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT, stage_data={"phases": {}})
    _advance(wo, Stage.OUTSOURCING_ASSIGNMENT, Stage.RECTIFICATION)
    assert wo.current_stage == Stage.RECTIFICATION


@pytest.mark.django_db
def test_prepress_only_job_can_reach_rectification(work_order_factory):
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT, stage_data={"phases": {"prepress": True}})
    _advance(wo, Stage.PREPRESS, Stage.RECTIFICATION)
    assert wo.current_stage == Stage.RECTIFICATION


@pytest.mark.django_db
def test_postpress_only_job_can_be_reached_from_assignment(work_order_factory):
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT, stage_data={"phases": {"postpress": True}})
    _advance(wo, Stage.POSTPRESS)
    assert wo.current_stage == Stage.POSTPRESS


@pytest.mark.django_db
def test_required_phase_cannot_be_skipped(work_order_factory):
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT, stage_data={"phases": {"press": True}})
    with pytest.raises(ValidationError, match="Transición inválida"):
        WorkOrderService.transition_to(wo, Stage.RECTIFICATION)


@pytest.mark.django_db
def test_material_approval_cannot_be_skipped_when_there_are_materials(work_order_factory, make_product):
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT, stage_data={"phases": {"press": True}})
    _material(wo, make_product())
    with pytest.raises(ValidationError, match="Transición inválida"):
        WorkOrderService.transition_to(wo, Stage.PRESS)


@pytest.mark.django_db
def test_transition_to_the_current_stage_is_rejected(work_order_factory):
    wo = work_order_factory(current_stage=Stage.PRESS, status=WorkOrder.Status.IN_PROGRESS,
                            stage_data={"phases": {"press": True}})
    with pytest.raises(ValidationError, match="ya está en la etapa"):
        WorkOrderService.transition_to(wo, Stage.PRESS)


@pytest.mark.django_db
def test_allowed_next_stages_are_exposed_for_the_ui(work_order_factory):
    wo = work_order_factory(current_stage=Stage.PREPRESS, status=WorkOrder.Status.IN_PROGRESS,
                            stage_data={"phases": {"prepress": True}})
    assert WorkOrderService.next_stage(wo) == Stage.RECTIFICATION


# ── Rewind blockers depend on how far back the OT goes ─────────────────────


@pytest.mark.django_db
def test_confirmed_po_only_blocks_rewinds_that_reopen_outsourcing(work_order_factory, supplier):
    wo = work_order_factory(
        current_stage=Stage.POSTPRESS,
        status=WorkOrder.Status.IN_PROGRESS,
        stage_data={"phases": {"press": True, "postpress": True}},
    )
    PurchaseOrder.objects.create(number="9002", supplier=supplier, work_order=wo, status="CONFIRMED")

    WorkOrderService.transition_to(wo, Stage.PRESS, notes="ajuste de tiraje")
    wo.refresh_from_db()
    assert wo.current_stage == Stage.PRESS

    with pytest.raises(ValidationError, match="Retroceso bloqueado"):
        WorkOrderService.transition_to(wo, Stage.OUTSOURCING_ASSIGNMENT)


@pytest.mark.django_db
def test_bulk_transition_cannot_rewind(work_order_factory):
    """Bulk moves carry no reason nor user; a rewind must go through the wizard."""
    wo = work_order_factory(current_stage=Stage.PRESS, status=WorkOrder.Status.IN_PROGRESS,
                            stage_data={"phases": {"press": True}})
    results = WorkOrderService.bulk_transition([wo.pk], Stage.MATERIAL_ASSIGNMENT)
    assert results["ok"] == []
    wo.refresh_from_db()
    assert wo.current_stage == Stage.PRESS


# ── 5. Creation endpoint ───────────────────────────────────────────────────


@pytest.fixture
def media_root(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    settings.STORAGES = {
        **settings.STORAGES,
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    }
    return tmp_path


def _design_file(name="arte.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 test", content_type="application/pdf")


@pytest.mark.django_db
def test_create_manual_ot_keeps_its_design_files(api_client, manufacturable_product, warehouse, media_root):
    response = api_client.post(
        "/api/production/orders/",
        {
            "product_id": manufacturable_product.id,
            "quantity": "10",
            "uom_id": manufacturable_product.uom_id,
            "warehouse_id": warehouse.id,
            "stage_data": "{}",
            "design_file_0": _design_file(),
        },
        format="multipart",
        HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
    )
    assert response.status_code == 201, response.data
    assert Attachment.objects.filter(object_id=response.data["id"], original_filename="arte.pdf").exists()


@pytest.mark.django_db
def test_create_linked_ot_keeps_its_design_files(api_client, sale_line_factory, warehouse, media_root):
    line = sale_line_factory()
    response = api_client.post(
        "/api/production/orders/",
        {"sale_order": line.order_id, "sale_line": line.id, "design_file_0": _design_file()},
        format="multipart",
        HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
    )
    assert response.status_code == 201, response.data
    assert Attachment.objects.filter(object_id=response.data["id"], original_filename="arte.pdf").exists()


@pytest.mark.django_db
def test_a_sale_line_cannot_get_a_second_active_ot(api_client, sale_line_factory):
    line = sale_line_factory()
    first = api_client.post("/api/production/orders/", {"sale_order": line.order_id, "sale_line": line.id}, HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()))
    assert first.status_code == 201, first.data
    second = api_client.post("/api/production/orders/", {"sale_order": line.order_id, "sale_line": line.id}, HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()))
    assert second.status_code == 400
    assert WorkOrder.objects.filter(sale_line=line).count() == 1


@pytest.mark.django_db
def test_create_linked_ot_rejects_invalid_fields_instead_of_dropping_them(api_client, sale_line_factory):
    line = sale_line_factory()
    response = api_client.post(
        "/api/production/orders/",
        {"sale_order": line.order_id, "sale_line": line.id, "estimated_completion_date": "no-es-fecha"},
        HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
    )
    assert response.status_code == 400
    assert not WorkOrder.objects.filter(sale_line=line).exists()


@pytest.mark.django_db
def test_create_linked_ot_for_a_non_manufacturable_line_is_rejected(
    api_client, sale_line_factory, make_product
):
    """The view fell back to a bare DRF create, bypassing the service."""
    line = sale_line_factory()
    line.product = make_product()
    line.save()
    response = api_client.post("/api/production/orders/", {"sale_order": line.order_id, "sale_line": line.id}, HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()))
    assert response.status_code == 400
    assert not WorkOrder.objects.filter(sale_line=line).exists()


# ── Approvals ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_group_pool_approval_requires_membership(work_order_factory):
    from workflow.models import TaskAssignmentRule

    Group.objects.create(name="Supervisores")
    TaskAssignmentRule.objects.create(task_type="OT_MATERIAL_APPROVAL", assigned_group="Supervisores")
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT)
    WorkOrderService.transition_to(wo, Stage.MATERIAL_APPROVAL)
    task = Task.objects.get(object_id=wo.pk, task_type="OT_MATERIAL_APPROVAL")
    outsider = User.objects.create_user("operario", "o@test.com", "pass")

    from rest_framework.exceptions import PermissionDenied

    with pytest.raises(PermissionDenied):
        WorkflowService.complete_task(task, outsider)


# ── Misc data integrity ────────────────────────────────────────────────────


@pytest.mark.django_db
def test_update_volume_converts_between_uoms(work_order_factory, make_product, manufacturable_product, unit):
    hundred = UoM.objects.create(name="ciento", ratio=100, category=unit.category, uom_type="BIGGER")
    wo = work_order_factory(
        is_manual=True,
        product=manufacturable_product,
        stage_data={"quantity": 1000, "uom_id": unit.id},
    )
    mat = _material(wo, make_product(), qty="10")
    mat.source = "BOM"
    mat.save()

    WorkOrderService.update_volume(wo, 10, hundred.id)  # 10 cientos == 1000 unidades

    mat.refresh_from_db()
    assert mat.quantity_planned == Decimal("10")


@pytest.mark.django_db
def test_duplicate_of_a_linked_ot_keeps_quantity_and_drops_run_state(sale_line_factory, make_product):
    line = sale_line_factory()
    wo = WorkOrderService.create_from_sale_line(line)
    wo.stage_data = {**(wo.stage_data or {}), "rectification_snapshot": {"materials": {}}, "final_photo": "x.jpg"}
    wo.save()

    copy = WorkOrderService.duplicate(wo)

    assert copy.stage_data["quantity"] == float(line.quantity)
    assert copy.stage_data["uom_id"] == line.uom_id
    assert "rectification_snapshot" not in copy.stage_data
    assert "final_photo" not in copy.stage_data


@pytest.mark.django_db
def test_patching_an_ot_works(api_client, work_order_factory):
    """WorkOrderWriteSerializer listed fields the model doesn't have (end_date, notes,
    rectified_from): every PATCH/PUT of an OT failed with ImproperlyConfigured."""
    wo = work_order_factory(stage_data={"phases": {"press": True}})
    response = api_client.patch(
        f"/api/production/orders/{wo.id}/",
        {"stage_data": '{"phases": {"press": true}, "internal_notes": "urgente"}'},
        format="multipart",
    )
    assert response.status_code == 200, response.data
    wo.refresh_from_db()
    assert wo.stage_data["internal_notes"] == "urgente"


@pytest.mark.django_db
def test_failed_ot_creation_at_sale_confirmation_leaves_a_task(
    sale_order_factory, sale_line_factory, manufacturable_product, accounts
):
    """The failure used to be print()-ed only: the sale confirmed without OT and the
    line could never be dispatched, with nobody told."""
    from sales.models import SaleOrder
    from sales.services import SalesService

    manufacturable_product.requires_advanced_manufacturing = True
    manufacturable_product.save()
    order = sale_order_factory(status=SaleOrder.Status.DRAFT)
    sale_line_factory(order=order)

    with patch.object(WorkOrderService, "create_from_sale_line", side_effect=ValidationError("BOM inválido")):
        SalesService.confirm_sale(order)

    order.refresh_from_db()
    assert order.status == SaleOrder.Status.CONFIRMED
    task = Task.objects.get(task_type="OT_CREATION_FAILED", object_id=order.pk)
    assert "BOM inválido" in task.description


@pytest.mark.django_db
def test_patch_merges_stage_data_instead_of_replacing_it(api_client, work_order_factory):
    """A stale client copy must not wipe keys the server wrote meanwhile."""
    wo = work_order_factory(stage_data={"phases": {"press": True}, "approval_attachment": "ok.pdf"})
    response = api_client.patch(
        f"/api/production/orders/{wo.id}/",
        {"stage_data": '{"contact_name": "Ana"}'},
        format="multipart",
    )
    assert response.status_code == 200, response.data
    wo.refresh_from_db()
    assert wo.stage_data["approval_attachment"] == "ok.pdf"
    assert wo.stage_data["contact_name"] == "Ana"


# ── Pending items: POS drafts, existing-order checkout, deletion ───────────


@pytest.mark.django_db
def test_outsourced_draft_does_not_take_over_an_own_bom_material(work_order_factory, make_product, supplier):
    """The draft used to land on the BOM row of the same component: the whole planned
    quantity became outsourced, with the draft's supplier and price."""
    paper = make_product()
    wo = work_order_factory()
    bom_row = _material(wo, paper, qty="10")
    bom_row.source = "BOM"
    bom_row.save()

    WorkOrderService._apply_planning_drafts(wo, {
        "outsourced_draft": [
            {"product_id": paper.id, "supplier_id": supplier.id, "quantity": 3, "unit_price": 500},
        ],
    })

    bom_row.refresh_from_db()
    assert bom_row.is_outsourced is False and bom_row.supplier is None
    assert bom_row.quantity_planned == Decimal("10")
    outsourced = wo.materials.get(is_outsourced=True)
    assert outsourced.quantity_planned == Decimal("3") and outsourced.supplier == supplier


@pytest.mark.django_db
def test_outsourced_service_from_another_supplier_is_its_own_line(work_order_factory, make_product, supplier):
    service = make_product(product_type=Product.Type.SERVICE)
    other = Contact.objects.create(name="Otro proveedor", tax_id="76222222-2")
    wo = work_order_factory()
    WorkOrderService.add_material(wo, service, 1, is_outsourced=True, supplier=supplier, unit_price=100)

    WorkOrderService.add_material(wo, service, 2, is_outsourced=True, supplier=other, unit_price=80)

    rows = {m.supplier_id: m for m in wo.materials.all()}
    assert rows[supplier.id].quantity_planned == Decimal("1") and rows[supplier.id].unit_price == Decimal("100")
    assert rows[other.id].quantity_planned == Decimal("2")


@pytest.mark.django_db
def test_material_in_another_uom_does_not_add_raw_quantities(work_order_factory, make_product, unit):
    """Summing 2 'cientos' onto 10 units gave 12: rows in different UoMs stay apart."""
    hundred = UoM.objects.create(name="ciento", ratio=100, category=unit.category, uom_type="BIGGER")
    paper = make_product()
    wo = work_order_factory()
    _material(wo, paper, qty="10")

    WorkOrderService.add_material(wo, paper, 2, uom=hundred)

    assert sorted((m.uom_id, m.quantity_planned) for m in wo.materials.all()) == sorted(
        [(unit.id, Decimal("10")), (hundred.id, Decimal("2"))]
    )


@pytest.mark.django_db
def test_sale_line_mapping_does_not_store_an_empty_approval(sale_line_factory):
    """The POS never captures the customer's approval (the prepress approval does):
    the OT used to get ``approval_attachment: None`` from a key nobody sends."""
    line = sale_line_factory(manufacturing_data={"phases": {"press": True}})
    wo = WorkOrderService.create_from_sale_line(line)
    assert "approval_attachment" not in wo.stage_data


@pytest.mark.django_db
def test_checkout_of_a_draft_order_keeps_the_edited_manufacturing_data(
    sale_order_factory, sale_line_factory
):
    """Paying an existing OV sent only ``{id}``: what the user configured in the
    checkout's manufacturing step never reached the line, nor the OT."""
    from sales.models import SaleOrder
    from sales.services import SalesService

    order = sale_order_factory(status=SaleOrder.Status.DRAFT)
    first = sale_line_factory(order=order)
    second = sale_line_factory(order=order, manufacturing_data={"phases": {"press": True}})
    design = _design_file()

    # The checkout lists the lines in its own order: files are keyed by that position
    files = SalesService.apply_checkout_line_edits(
        order,
        [
            {"line_id": second.id, "manufacturing_data": {"phases": {"prepress": True}, "description": "urgente"}},
            {"line_id": first.id, "manufacturing_data": None},
        ],
        {0: {"design": [design], "approval": None}},
    )

    second.refresh_from_db()
    assert second.manufacturing_data == {"phases": {"prepress": True}, "description": "urgente"}
    # confirm() walks the lines by pk: the file follows its line
    assert files == {1: {"design": [design], "approval": None}}


@pytest.mark.django_db
def test_checkout_edits_rejected_once_the_order_has_its_ots(sale_order_factory, sale_line_factory):
    from sales.services import SalesService

    order = sale_order_factory()  # CONFIRMED
    line = sale_line_factory(order=order)
    with pytest.raises(ValidationError, match="OT"):
        SalesService.apply_checkout_line_edits(
            order, [{"line_id": line.id, "manufacturing_data": {"phases": {"press": True}}}]
        )


@pytest.mark.django_db
def test_checkout_edits_must_belong_to_the_order(sale_order_factory, sale_line_factory):
    from sales.models import SaleOrder
    from sales.services import SalesService

    order = sale_order_factory(status=SaleOrder.Status.DRAFT)
    foreign = sale_line_factory()
    with pytest.raises(ValidationError, match="no pertenece"):
        SalesService.apply_checkout_line_edits(order, [{"line_id": foreign.id, "manufacturing_data": {}}])


@pytest.mark.django_db
def test_work_orders_are_annulled_not_deleted(api_client, work_order_factory):
    """deletion-policy: WorkOrder = Anulación. The hard DELETE erased the OT, its
    history and its number."""
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT)
    response = api_client.delete(f"/api/production/orders/{wo.id}/")
    assert response.status_code == 405
    assert WorkOrder.objects.filter(pk=wo.pk).exists()

    response = api_client.post(
        f"/api/production/orders/{wo.id}/annul/", {}, HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4())
    )
    assert response.status_code == 200, response.data
    wo.refresh_from_db()
    assert wo.status == WorkOrder.Status.CANCELLED
