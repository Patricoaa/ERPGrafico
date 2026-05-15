import pytest
from rest_framework.test import APIClient
from production.models import WorkOrder, WorkOrderMaterial
from production.serializers import WorkOrderMaterialSerializer

from inventory.models import Product, UoM, ProductCategory, UoMCategory

@pytest.mark.django_db
def test_task208_material_cost_snapshot(work_order_factory):
    # Create product with initial cost
    uom_cat = UoMCategory.objects.create(name='Test UOM Cat')
    uom = UoM.objects.create(name='Unit', category=uom_cat)
    prod_cat = ProductCategory.objects.create(name='Test Cat')
    product = Product.objects.create(
        name='Test Component', 
        cost_price=150.0, 
        uom=uom, 
        category=prod_cat,
        track_inventory=True,
        product_type='MANUFACTURABLE'
    )
    
    # Create WorkOrderMaterial
    wo = work_order_factory()
    material = WorkOrderMaterial.objects.create(
        work_order=wo,
        component=product,
        quantity_planned=10,
        uom=uom,
        source='MANUAL'
    )
    
    # Assert snapshot is captured at creation
    assert material.unit_cost_snapshot == 150.0
    
    # Change product cost price
    product.cost_price = 200.0
    product.save()
    
    # Validate serializers output
    serializer = WorkOrderMaterialSerializer(material)
    data = serializer.data
    
    # Planned cost = 10 * 150.0 = 1500.0
    assert data['planned_cost'] == 1500.0
    
    # Actual cost = 10 * 200.0 = 2000.0
    assert data['actual_cost'] == 2000.0
