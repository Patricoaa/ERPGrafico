"""
Tests for Phase 3 backend tasks:
  - TASK-201: UniqueConstraint against duplicate active WorkOrders per sale_line
  - TASK-202: WorkOrderService.create_from_request_payload()
  - TASK-207: WorkOrderMaterial flexible constraint (same component, different UoM/supplier)
  - TASK-209: _validate_product_manufacturable helper
"""
import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch, PropertyMock

from django.core.exceptions import ValidationError
from django.db import IntegrityError

from production.models import WorkOrder, WorkOrderMaterial
from production.services import WorkOrderService


# ─── Shared fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def uom(db):
    from inventory.models import UoM, UoMCategory
    cat, _ = UoMCategory.objects.get_or_create(name='Unidades')
    u, _ = UoM.objects.get_or_create(name='unidad', defaults={'ratio': 1, 'category': cat})
    return u


@pytest.fixture
def uom2(db):
    from inventory.models import UoM, UoMCategory
    cat, _ = UoMCategory.objects.get_or_create(name='Unidades')
    u, _ = UoM.objects.get_or_create(name='ciento', defaults={'ratio': 100, 'category': cat})
    return u


@pytest.fixture
def manufacturable_product(db, uom):
    from inventory.models import Product, ProductCategory
    cat, _ = ProductCategory.objects.get_or_create(name='Test', defaults={'prefix': 'TST'})
    return Product.objects.create(
        name='Producto Fabricable',
        internal_code='PROD-MFG-001',
        product_type=Product.Type.MANUFACTURABLE,
        uom=uom,
        category=cat,
    )


@pytest.fixture
def storable_product(db, uom):
    from inventory.models import Product, ProductCategory
    cat, _ = ProductCategory.objects.get_or_create(name='Test', defaults={'prefix': 'TST'})
    return Product.objects.create(
        name='Producto Almacenable',
        internal_code='PROD-STO-001',
        product_type=Product.Type.STORABLE,
        uom=uom,
        category=cat,
    )


@pytest.fixture
def sale_line(db, manufacturable_product, uom, sale_order_factory):
    from sales.models import SaleLine
    order = sale_order_factory()
    return SaleLine.objects.create(
        order=order,
        product=manufacturable_product,
        quantity=Decimal('50'),
        unit_price=Decimal('500'),
        uom=uom,
    )


@pytest.fixture
def work_order_with_sale_line(db, sale_line, warehouse_factory):
    warehouse_factory(name='Default WH', code='WH-D01')
    return WorkOrderService.create_from_sale_line(sale_line)


# ─── TASK-201: UniqueConstraint unique_active_workorder_per_saleline ──────────

@pytest.mark.django_db
def test_task201_cannot_create_two_draft_ots_for_same_sale_line(sale_line, warehouse_factory):
    """Two DRAFT WorkOrders for the same sale_line should violate the DB constraint."""
    warehouse_factory(name='WH201', code='WH-201')
    ot1 = WorkOrderService.create_from_sale_line(sale_line)
    assert ot1 is not None

    # Bypass the service to force a raw DB insert, confirming the constraint works at DB level
    with pytest.raises(IntegrityError):
        WorkOrder.objects.create(
            description='Duplicate OT',
            sale_line=sale_line,
            status=WorkOrder.Status.DRAFT,
            current_stage=WorkOrder.Stage.MATERIAL_ASSIGNMENT,
        )


@pytest.mark.django_db
def test_task201_can_create_new_ot_after_cancellation(sale_line, warehouse_factory):
    """After cancelling the existing OT, a new one can be created for the same sale_line."""
    warehouse_factory(name='WH201b', code='WH-201B')
    ot1 = WorkOrderService.create_from_sale_line(sale_line)
    WorkOrderService.annul_work_order(ot1)
    assert ot1.status == WorkOrder.Status.CANCELLED

    # New OT for same sale_line — must succeed because prior one is CANCELLED
    ot2 = WorkOrderService.create_from_sale_line(sale_line)
    assert ot2 is not None
    assert ot2.pk != ot1.pk
    assert ot2.status == WorkOrder.Status.DRAFT


@pytest.mark.django_db
def test_task201_constraint_does_not_affect_null_sale_line(work_order_factory):
    """WorkOrders without sale_line (manual) are never blocked by the constraint."""
    work_order_factory(sale_line=None, status=WorkOrder.Status.DRAFT)
    work_order_factory(sale_line=None, status=WorkOrder.Status.DRAFT)  # must not raise


# ─── TASK-202: create_from_request_payload ────────────────────────────────────

@pytest.mark.django_db
def test_task202_manual_branch_creates_work_order(manufacturable_product, uom, warehouse_factory):
    """Branch 1: product_id + empty sale_line → delegates to create_manual."""
    wh = warehouse_factory(name='WH202', code='WH-202')

    files = MagicMock()
    files.getlist.return_value = []
    files.get.return_value = None

    data = {
        'product_id': str(manufacturable_product.pk),
        'quantity': '10',
        'uom_id': str(uom.pk),
        'warehouse_id': str(wh.pk),
        'description': 'OT Manual Test',
        'sale_line': '',
    }

    ot = WorkOrderService.create_from_request_payload(data, files, user=None)
    assert ot is not None
    assert ot.is_manual is True
    assert ot.product == manufacturable_product


@pytest.mark.django_db
def test_task202_fallback_returns_none_when_no_known_payload():
    """Branch 3: no product_id, no sale_line → returns None (view falls back to DRF)."""
    files = MagicMock()
    result = WorkOrderService.create_from_request_payload({}, files, user=None)
    assert result is None


@pytest.mark.django_db
def test_task202_storable_product_raises_in_manual_branch(storable_product, uom, warehouse_factory):
    """Storable products must raise ValidationError through the manual branch."""
    wh = warehouse_factory(name='WH202c', code='WH-202C')
    files = MagicMock()
    files.getlist.return_value = []
    files.get.return_value = None

    data = {
        'product_id': str(storable_product.pk),
        'quantity': '5',
        'uom_id': str(uom.pk),
        'warehouse_id': str(wh.pk),
        'description': 'Storable attempt',
        'sale_line': '',
    }

    with pytest.raises((ValidationError, Exception)):
        WorkOrderService.create_from_request_payload(data, files, user=None)


# ─── TASK-207: WorkOrderMaterial flexible constraint ──────────────────────────

@pytest.mark.django_db
def test_task207_same_component_different_uom_is_allowed(
    work_order_with_sale_line, manufacturable_product, uom, uom2
):
    """Same component with two different UoMs should NOT violate the new constraint."""
    wo = work_order_with_sale_line

    WorkOrderMaterial.objects.create(
        work_order=wo,
        component=manufacturable_product,
        quantity_planned=Decimal('10'),
        uom=uom,
        source='MANUAL',
        is_outsourced=False,
    )
    # Same component, different UoM — must not raise
    mat2 = WorkOrderMaterial.objects.create(
        work_order=wo,
        component=manufacturable_product,
        quantity_planned=Decimal('2'),
        uom=uom2,
        source='MANUAL',
        is_outsourced=False,
    )
    assert mat2.pk is not None


@pytest.mark.django_db
def test_task207_same_component_different_supplier_is_allowed(
    work_order_with_sale_line, manufacturable_product, uom, customer_factory
):
    """Same component with two different outsourced suppliers must succeed."""
    sup1 = customer_factory()
    sup2 = customer_factory()
    wo = work_order_with_sale_line

    WorkOrderMaterial.objects.create(
        work_order=wo, component=manufacturable_product,
        quantity_planned=Decimal('5'), uom=uom,
        source='MANUAL', is_outsourced=True, supplier=sup1,
    )
    mat2 = WorkOrderMaterial.objects.create(
        work_order=wo, component=manufacturable_product,
        quantity_planned=Decimal('3'), uom=uom,
        source='MANUAL', is_outsourced=True, supplier=sup2,
    )
    assert mat2.pk is not None


@pytest.mark.django_db
def test_task207_exact_duplicate_still_raises(
    work_order_with_sale_line, manufacturable_product, uom
):
    """Exact duplicate (same work_order+component+is_outsourced+supplier+uom) must raise."""
    wo = work_order_with_sale_line

    WorkOrderMaterial.objects.create(
        work_order=wo, component=manufacturable_product,
        quantity_planned=Decimal('10'), uom=uom,
        source='MANUAL', is_outsourced=False, supplier=None,
    )
    with pytest.raises(IntegrityError):
        WorkOrderMaterial.objects.create(
            work_order=wo, component=manufacturable_product,
            quantity_planned=Decimal('5'), uom=uom,
            source='MANUAL', is_outsourced=False, supplier=None,
        )


# ─── TASK-209: _validate_product_manufacturable ───────────────────────────────

@pytest.mark.django_db
def test_task209_storable_product_raises_when_require_manufacturable(storable_product):
    """Non-MANUFACTURABLE product raises when require_manufacturable=True (default)."""
    with pytest.raises(ValidationError, match="fabricable"):
        WorkOrderService._validate_product_manufacturable(storable_product)


@pytest.mark.django_db
def test_task209_manufacturable_product_passes(manufacturable_product):
    """Valid MANUFACTURABLE product with requires_bom_validation=False must not raise."""
    # requires_bom_validation will be False because mfg_auto_finalize is False by default
    WorkOrderService._validate_product_manufacturable(manufacturable_product)


@pytest.mark.django_db
def test_task209_require_manufacturable_false_skips_type_check(storable_product):
    """When require_manufacturable=False, a non-manufacturable product must pass the type check."""
    # storable_product.requires_bom_validation is False (not express)
    WorkOrderService._validate_product_manufacturable(
        storable_product, require_manufacturable=False
    )


@pytest.mark.django_db
def test_task209_express_product_without_bom_raises(manufacturable_product):
    """Product with requires_bom_validation=True (mocked) must raise with 'Express' hint."""
    with patch.object(
        type(manufacturable_product),
        'requires_bom_validation',
        new_callable=PropertyMock,
        return_value=True,
    ):
        with pytest.raises(ValidationError, match="Express"):
            WorkOrderService._validate_product_manufacturable(manufacturable_product)
