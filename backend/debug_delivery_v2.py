import os
import django
import sys
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from sales.models import SaleOrder, SaleLine, SaleDelivery, SaleDeliveryLine
from inventory.models import Product, Warehouse, UoM
from sales.services import SalesService

def test():
    f = open('full_error.txt', 'w')
    try:
        # Get data from the POS error
        product = Product.objects.get(id=100)
        uom = UoM.objects.get(id=85)
        warehouse = Warehouse.objects.first()
        from contacts.models import Contact
        customer = Contact.objects.get(id=72)

        print(f"Mocking order for {customer.name}, product {product.name}")
        
        order = SaleOrder.objects.create(
            customer=customer,
            payment_method='CASH',
            total_net=24000,
            total_tax=4560,
            total=28560
        )
        
        line = SaleLine.objects.create(
            order=order,
            product=product,
            description="Tinta Offset Cyan 1kg",
            quantity=2,
            unit_price=12000,
            uom=uom,
            tax_rate=19,
            subtotal=24000
        )
        
        print("Dispatching order...")
        delivery = SalesService.dispatch_order(order, warehouse)
        print(f"Delivery {delivery.number} confirmed!")
        
    except Exception:
        traceback.print_exc(file=f)
        traceback.print_exc()
    finally:
        f.close()

if __name__ == "__main__":
    test()
