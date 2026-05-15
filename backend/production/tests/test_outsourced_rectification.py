import pytest
from decimal import Decimal
from production.models import WorkOrder, WorkOrderMaterial, WorkOrderHistory
from production.services import WorkOrderService
from purchasing.models import PurchaseOrder, PurchaseLine
from inventory.models import Product, UoM, ProductCategory, UoMCategory
from contacts.models import Contact

@pytest.mark.django_db
def test_task209_outsourced_rectification(work_order_factory):
    # Create work order in RECTIFICATION stage
    wo = work_order_factory(current_stage=WorkOrder.Stage.RECTIFICATION)
    
    # Create outsourced material
    uom_cat = UoMCategory.objects.create(name='Test UOM Cat')
    uom = UoM.objects.create(name='Unit', category=uom_cat)
    prod_cat = ProductCategory.objects.create(name='Test Cat')
    component = Product.objects.create(name='Outsourced Service', uom=uom, category=prod_cat, track_inventory=False)
    material = WorkOrderMaterial.objects.create(
        work_order=wo,
        component=component,
        quantity_planned=Decimal('10'),
        unit_price=Decimal('50'),
        uom=uom,
        source='MANUAL',
        is_outsourced=True
    )
    
    # Create a mock PurchaseOrder and PurchaseLine to link to material
    supplier = Contact.objects.create(name='Test Supplier', tax_id='12345678-9')
    po = PurchaseOrder.objects.create(number="PO-1234", status="DRAFT", supplier=supplier)
    pl = PurchaseLine.objects.create(order=po, product=material.component, quantity=Decimal('10'), unit_cost=Decimal('50'), uom=uom)
    material.purchase_line = pl
    material.save()
    
    # Rectify with different quantity and price
    adjustments = [{
        'material_id': material.id,
        'actual_quantity': '12',
        'actual_unit_price': '55'
    }]
    
    WorkOrderService.rectify_production(
        work_order=wo,
        outsourced_adjustments=adjustments,
        user=None
    )
    
    material.refresh_from_db()
    assert material.quantity_planned == Decimal('12')
    assert material.unit_price == Decimal('55')
    
    # Check discrepancy recorded in history
    history = WorkOrderHistory.objects.filter(work_order=wo).last()
    assert history is not None
    assert f"DISCREPANCIA con OC-{po.number}" in history.notes

