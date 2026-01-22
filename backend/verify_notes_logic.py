import os
import django
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.exceptions import ValidationError
from sales.models import SaleOrder, SaleLine
from sales.services import SalesService
from inventory.models import Product, Warehouse, UoM, UoMCategory, ProductCategory
from billing.models import Invoice
from accounting.models import AccountingSettings, Account
from contacts.models import Contact

def verify_logic():
    print("🚀 Starting Logic Verification for Sales Notes...")
    
    # 1. Setup Data
    try:
        # Accounting
        acc_receivable, _ = Account.objects.get_or_create(code='1.1.01', defaults={'name': 'Receivable', 'account_type': 'ASSET'})
        acc_revenue, _ = Account.objects.get_or_create(code='4.1.01', defaults={'name': 'Revenue', 'account_type': 'REVENUE'})
        acc_tax, _ = Account.objects.get_or_create(code='2.1.01', defaults={'name': 'Tax', 'account_type': 'LIABILITY'})
        
        AccountingSettings.objects.get_or_create(defaults={
            'default_receivable_account': acc_receivable,
            'default_revenue_account': acc_revenue,
            'default_tax_payable_account': acc_tax
        })
        
        cat, _ = UoMCategory.objects.get_or_create(name='Unit Category')
        uom, _ = UoM.objects.get_or_create(name='Unit', defaults={'category': cat})
        pcat, _ = ProductCategory.objects.get_or_create(name='Logic Test Category')
        customer, _ = Contact.objects.get_or_create(name='Logic Test Customer', defaults={'tax_id': '199-K'})
        warehouse, _ = Warehouse.objects.get_or_create(name='Logic Test Warehouse')
        
        # 2. Test Cases
        order = SaleOrder.objects.create(customer=customer, number='NV-LOGIC-001')
        
        # Case A: Service Return Block
        service = Product.objects.create(name='Test Service', product_type=Product.Type.SERVICE, uom=uom, category=pcat)
        try:
            SalesService.create_note(order, Invoice.DTEType.NOTA_CREDITO, Decimal('100'), Decimal('19'), 'NC-SERV', return_items=[{'product_id': service.id, 'quantity': 1}])
            print("❌ FAILED: Service return should have been blocked.")
        except ValidationError as e:
            print(f"✅ PASSED: Service return blocked: {e}")

        # Case B: Quantity Delivered Validation
        product = Product.objects.create(name='Storable Prod', product_type=Product.Type.STORABLE, uom=uom, track_inventory=True, category=pcat)
        line = SaleLine.objects.create(order=order, product=product, quantity=10, unit_price=1000, uom=uom, quantity_delivered=5)
        try:
            SalesService.create_note(order, Invoice.DTEType.NOTA_CREDITO, Decimal('600'), Decimal('114'), 'NC-QTY', return_items=[{'product_id': product.id, 'quantity': 6}])
            print("❌ FAILED: Return > Delivered should have been blocked.")
        except ValidationError as e:
            print(f"✅ PASSED: Return > Delivered blocked: {e}")

        # Case C: ND Block for non-storable mfg
        mfg = Product.objects.create(name='Mfg Prod', product_type=Product.Type.MANUFACTURABLE, uom=uom, track_inventory=False, category=pcat)
        try:
            SalesService.create_note(order, Invoice.DTEType.NOTA_DEBITO, Decimal('100'), Decimal('19'), 'ND-MFG', return_items=[{'product_id': mfg.id, 'quantity': 1}])
            print("❌ FAILED: ND for non-storable mfg should have been blocked.")
        except ValidationError as e:
            print(f"✅ PASSED: ND for non-storable mfg blocked: {e}")


    finally:
        # Cleanup
        print("🧹 Cleaning up test data...")
        SaleOrder.objects.filter(number='NV-LOGIC-001').delete()
        Product.objects.filter(name__in=['Test Service', 'Storable Prod', 'Mfg Prod']).delete()

if __name__ == "__main__":
    verify_logic()
