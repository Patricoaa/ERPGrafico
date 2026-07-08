import pytest
from decimal import Decimal
from inventory.models import Stock, StockMove, Product, Warehouse, ProductCategory
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

    # Create a StockMove manually (simulate legacy behavior)
    move = StockMove.objects.create(
        product=product,
        warehouse=warehouse,
        quantity=Decimal('10.5'),
        move_type=StockMove.Type.IN,
        description='Test move IN'
    )
    
    # Check if stock was updated via signal
    stock = Stock.objects.get(product=product, warehouse=warehouse)
    assert stock.quantity == Decimal('10.5')
    
    # Create an OUT move
    StockMove.objects.create(
        product=product,
        warehouse=warehouse,
        quantity=Decimal('3.0'),
        move_type=StockMove.Type.OUT,
        description='Test move OUT'
    )
    
    stock.refresh_from_db()
    assert stock.quantity == Decimal('7.5')
    
    # Test recalcular_stock directly
    InventoryService.recalcular_stock(product.id, warehouse.id)
    stock.refresh_from_db()
    assert stock.quantity == Decimal('7.5')
    
    # Test delete
    move.delete()
    stock.refresh_from_db()
    assert stock.quantity == Decimal('-3.0')
