from decimal import Decimal

import pytest
from django.contrib.contenttypes.models import ContentType

from inventory.models import (
    InventoryDocument,
    Location,
    Product,
    ProductCategory,
    Stock,
    StockMove,
    Warehouse,
)
from inventory.services import StockService


@pytest.fixture
def stock_setup():
    category = ProductCategory.objects.create(name='SD Category')
    product = Product.objects.create(name='SD Product', category=category)
    warehouse = Warehouse.objects.create(name='SD Warehouse', code='SD01')
    vendor_loc, _ = Location.objects.get_or_create(
        location_type='VENDOR', defaults={'name': 'Proveedor'}
    )
    internal_loc, _ = Location.objects.get_or_create(
        location_type='INTERNAL', warehouse=warehouse, defaults={'name': 'Interno'}
    )
    return product, warehouse, vendor_loc, internal_loc


@pytest.mark.django_db
def test_create_move_links_source_document(stock_setup):
    """create_move (the single writer) links a business document via the GFK."""
    product, _warehouse, vendor_loc, internal_loc = stock_setup
    document = InventoryDocument.objects.create(
        document_type=InventoryDocument.Type.RECEIPT,
        status=InventoryDocument.Status.CONFIRMED,
        reference='SRC-001',
    )

    move = StockService.create_move(
        product=product,
        quantity=Decimal('7.0'),
        source_location=vendor_loc,
        destination_location=internal_loc,
        unit_cost=Decimal('12.50'),
        description='Recepción SRC-001',
        source_document=document,
    )

    move.refresh_from_db()
    assert move.source_document == document
    assert move.source_object_id == document.id
    assert move.source_content_type == ContentType.objects.get_for_model(InventoryDocument)
    assert move.quantity == Decimal('7.0000')
    assert move.unit_cost == Decimal('12.50')


@pytest.mark.django_db
def test_create_move_without_source_document(stock_setup):
    """Standalone moves (adjustment, transfer) carry no source document."""
    product, _warehouse, vendor_loc, internal_loc = stock_setup

    move = StockService.create_move(
        product=product,
        quantity=Decimal('3.0'),
        source_location=vendor_loc,
        destination_location=internal_loc,
        description='Movimiento suelto',
    )

    move.refresh_from_db()
    assert move.source_document is None
    assert move.source_content_type is None
    assert move.source_object_id is None
    # A None unit_cost is stored as 0, never NULL (field is non-null).
    assert move.unit_cost == Decimal('0')


@pytest.mark.django_db
def test_create_move_defaults_unit_cost_to_zero(stock_setup):
    product, _warehouse, vendor_loc, internal_loc = stock_setup

    move = StockService.create_move(
        product=product,
        quantity=Decimal('1.0'),
        source_location=vendor_loc,
        destination_location=internal_loc,
        description='Sin costo',
    )

    move.refresh_from_db()
    assert move.unit_cost == Decimal('0')


@pytest.mark.django_db
def test_confirmar_documento_still_creates_move(stock_setup):
    """The refactor keeps confirmar_documento as the InventoryDocument path."""
    from inventory.models import InventoryDocumentDetail
    from inventory.services import InventoryService

    product, warehouse, vendor_loc, internal_loc = stock_setup
    document = InventoryDocument.objects.create(
        document_type=InventoryDocument.Type.RECEIPT,
        status=InventoryDocument.Status.DRAFT,
        reference='SRC-002',
    )
    InventoryDocumentDetail.objects.create(
        document=document,
        product=product,
        source_location=vendor_loc,
        destination_location=internal_loc,
        quantity=Decimal('50.0'),
        unit_cost=Decimal('2.00'),
    )

    document, moves = InventoryService.confirmar_documento(document)

    assert len(moves) == 1
    assert StockMove.objects.filter(description__contains='SRC-002').count() == 1
    assert Stock.objects.get(product=product, warehouse=warehouse).quantity == Decimal('50.0')
