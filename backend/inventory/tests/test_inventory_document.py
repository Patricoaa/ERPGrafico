import pytest
from decimal import Decimal
from inventory.models import InventoryDocument, InventoryDocumentDetail, Stock, StockMove, Product, Warehouse, ProductCategory, Location
from inventory.services import InventoryService

@pytest.fixture
def base_inventory_setup():
    category = ProductCategory.objects.create(name='Test Category')
    product = Product.objects.create(name='Test Product', category=category)
    warehouse = Warehouse.objects.create(name='Test Warehouse', code='TW02')
    return product, warehouse

@pytest.mark.django_db
def test_document_confirmation_and_cancellation(base_inventory_setup):
    product, warehouse = base_inventory_setup
    
    # Create DRAFT document
    doc = InventoryDocument.objects.create(
        document_type=InventoryDocument.Type.RECEIPT,
        status=InventoryDocument.Status.DRAFT,
        reference='REC-001'
    )
    vendor_loc, _ = Location.objects.get_or_create(location_type='VENDOR', defaults={'name': 'Proveedor'})
    internal_loc, _ = Location.objects.get_or_create(location_type='INTERNAL', warehouse=warehouse, defaults={'name': 'Interno'})

    InventoryDocumentDetail.objects.create(
        document=doc,
        product=product,
        source_location=vendor_loc,
        destination_location=internal_loc,
        quantity=Decimal('50.0')
    )
    
    stock = Stock.objects.filter(product=product, warehouse=warehouse).first()
    assert stock is None or stock.quantity == Decimal('0')
    
    # Confirm
    doc, generated_moves = InventoryService.confirmar_documento(doc)
    
    stock = Stock.objects.get(product=product, warehouse=warehouse)
    assert stock.quantity == Decimal('50.0')
    assert doc.status == InventoryDocument.Status.CONFIRMED
    assert StockMove.objects.filter(description__contains='REC-001').count() == 1
    
    # Cancel
    InventoryService.anular_documento(doc)
    
    stock.refresh_from_db()
    assert stock.quantity == Decimal('0.0')
    assert doc.status == InventoryDocument.Status.CANCELLED
    assert StockMove.objects.filter(description__contains='REC-001').count() == 2

@pytest.mark.django_db
def test_transfer_document(base_inventory_setup):
    product, warehouse_src = base_inventory_setup
    warehouse_dest = Warehouse.objects.create(name='Dest Warehouse', code='TW03')
    
    vendor_loc, _ = Location.objects.get_or_create(location_type='VENDOR', defaults={'name': 'Proveedor'})
    src_internal_loc, _ = Location.objects.get_or_create(location_type='INTERNAL', warehouse=warehouse_src, defaults={'name': 'Interno Origen'})
    dest_internal_loc, _ = Location.objects.get_or_create(location_type='INTERNAL', warehouse=warehouse_dest, defaults={'name': 'Interno Destino'})

    # Give some initial stock
    StockMove.objects.create(
        product=product,
        source_location=vendor_loc,
        destination_location=src_internal_loc,
        quantity=Decimal('100.0')
    )
    
    doc = InventoryDocument.objects.create(
        document_type=InventoryDocument.Type.TRANSFER,
        status=InventoryDocument.Status.DRAFT,
        reference='TRF-001'
    )
    InventoryDocumentDetail.objects.create(
        document=doc,
        product=product,
        source_location=src_internal_loc,
        destination_location=dest_internal_loc,
        quantity=Decimal('20.0')
    )
    
    doc, generated_moves = InventoryService.confirmar_documento(doc)
    
    stock_src = Stock.objects.get(product=product, warehouse=warehouse_src)
    stock_dest = Stock.objects.get(product=product, warehouse=warehouse_dest)
    
    assert stock_src.quantity == Decimal('80.0')
    assert stock_dest.quantity == Decimal('20.0')
