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


@pytest.mark.django_db
def test_stock_move_direction_classification():
    """direction property classifies moves as IN/OUT/TRANSFER/ADJUSTMENT/OTHER."""
    category = ProductCategory.objects.create(name='Dir Category')
    product = Product.objects.create(name='Dir Product', category=category)
    warehouse_a = Warehouse.objects.create(name='Dir WH A', code='DWA1')
    warehouse_b = Warehouse.objects.create(name='Dir WH B', code='DWB1')

    internal_a, _ = Location.objects.get_or_create(
        location_type='INTERNAL', warehouse=warehouse_a, defaults={'name': 'Interno A'}
    )
    internal_b, _ = Location.objects.get_or_create(
        location_type='INTERNAL', warehouse=warehouse_b, defaults={'name': 'Interno B'}
    )
    vendor, _ = Location.objects.get_or_create(location_type='VENDOR', defaults={'name': 'Proveedor'})
    customer, _ = Location.objects.get_or_create(location_type='CUSTOMER', defaults={'name': 'Cliente'})
    adjustment, _ = Location.objects.get_or_create(
        location_type='VIRTUAL', name='Ajuste por Merma/Pérdida', defaults={'location_type': 'VIRTUAL'}
    )

    def move(src, dst):
        return StockMove.objects.create(
            product=product,
            source_location=src,
            destination_location=dst,
            quantity=Decimal('5'),
        )

    assert move(vendor, internal_a).direction == 'IN'
    assert move(internal_a, customer).direction == 'OUT'
    assert move(internal_a, internal_b).direction == 'TRANSFER'
    assert move(adjustment, internal_a).direction == 'ADJUSTMENT'
    assert move(vendor, customer).direction == 'OTHER'
