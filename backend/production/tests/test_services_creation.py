import pytest
from decimal import Decimal
from production.models import WorkOrder
from production.services import WorkOrderService



@pytest.fixture
def manufacturable_product(db):
    from inventory.models import Product, UoM, UoMCategory, ProductCategory
    uom_cat, _ = UoMCategory.objects.get_or_create(name='Unidades')
    uom, _ = UoM.objects.get_or_create(name='unidad', defaults={'ratio': 1, 'category': uom_cat})
    prod_cat, _ = ProductCategory.objects.get_or_create(name='Test', defaults={'prefix': 'TST'})
    return Product.objects.create(
        name='Tarjeta Test',
        internal_code='TARJ-TEST-001',
        product_type=Product.Type.MANUFACTURABLE,
        uom=uom,
        category=prod_cat,
    )


@pytest.fixture
def sale_line_factory(db, manufacturable_product, sale_order_factory):
    def make(order=None, **kwargs):
        from sales.models import SaleLine
        from inventory.models import UoM
        uom = UoM.objects.get(name='unidad')
        order = order or sale_order_factory()
        return SaleLine.objects.create(
            order=order,
            product=manufacturable_product,
            quantity=Decimal('100'),
            unit_price=Decimal('1000'),
            uom=uom,
            **kwargs,
        )
    return make


@pytest.fixture
def delivery_factory(db):
    def make(order, warehouse, **kwargs):
        from sales.models import SaleDelivery
        from datetime import date
        return SaleDelivery.objects.create(
            sale_order=order,
            warehouse=warehouse,
            delivery_date=kwargs.pop('delivery_date', date.today()),
            **kwargs,
        )
    return make


@pytest.mark.django_db
def test_create_from_sale_line_uses_delivery_warehouse(
    sale_line_factory, warehouse_factory, delivery_factory
):
    """When a delivery with warehouse exists, uses that warehouse."""
    wh = warehouse_factory(name='Bodega Principal', code='WH-MAIN')
    sale_line = sale_line_factory()
    delivery_factory(order=sale_line.order, warehouse=wh)

    ot = WorkOrderService.create_from_sale_line(sale_line)

    assert ot.warehouse == wh


@pytest.mark.django_db
def test_create_from_sale_line_no_deliveries_does_not_crash(
    sale_line_factory, warehouse_factory
):
    """When sale order has no deliveries at all, must not raise AttributeError."""
    warehouse_factory(name='Default', code='WH-DEF2')
    sale_line = sale_line_factory()

    # Before fix: sale_line.order.deliveries.first().warehouse → AttributeError
    ot = WorkOrderService.create_from_sale_line(sale_line)

    assert isinstance(ot, WorkOrder)
    assert ot.pk is not None
