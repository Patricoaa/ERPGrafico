import pytest
from decimal import Decimal
from inventory.models import Stock, StockMove, Product, ProductCategory, Warehouse, Location
from inventory.services import InventoryService

@pytest.mark.django_db
def test_stock_recalculation_and_update():
    """
    Test that Stock table is created and updated when StockMoves are made.
    """
    category = ProductCategory.objects.create(name='Test Category')
    product = Product.objects.create(name='Test Product', category=category)
    warehouse = Warehouse.objects.create(name='Test Warehouse', code='TW01')

    # Initial stock should be 0 because we just created it
    stock = Stock.objects.filter(product=product, warehouse=warehouse).first()
    assert stock is None or stock.quantity == Decimal('0')

    internal_loc = Location.objects.get_or_create(location_type='INTERNAL', warehouse=warehouse, defaults={'name': 'Interno'})[0]
    vendor_loc = Location.objects.get_or_create(location_type='VENDOR', defaults={'name': 'Proveedor'})[0]
    customer_loc = Location.objects.get_or_create(location_type='CUSTOMER', defaults={'name': 'Cliente'})[0]

    # Create a StockMove manually
    move = StockMove.objects.create(
        product=product,
        source_location=vendor_loc,
        destination_location=internal_loc,
        quantity=Decimal('10.5'),
        description='Test move IN'
    )
    
    # Check if stock was updated via signal
    stock = Stock.objects.get(product=product, warehouse=warehouse)
    assert stock.quantity == Decimal('10.5')
    
    # Create an OUT move
    StockMove.objects.create(
        product=product,
        source_location=internal_loc,
        destination_location=customer_loc,
        quantity=Decimal('3.0'),
        description='Test move OUT'
    )
    
    stock.refresh_from_db()
    assert stock.quantity == Decimal('7.5')
    
    # Test recalcular_stock directly
    InventoryService.recalcular_stock(product.id, warehouse.id)
    stock.refresh_from_db()
    assert stock.quantity == Decimal('7.5')
    
    # Test delete
    from django.core.exceptions import ValidationError
    with pytest.raises(ValidationError):
        move.delete()
