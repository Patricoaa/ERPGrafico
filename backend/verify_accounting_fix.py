import os
import django
from decimal import Decimal
from django.utils import timezone

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from inventory.models import Product, ProductCategory, Warehouse, UoM
from production.models import BillOfMaterials, BillOfMaterialsLine
from sales.models import SaleOrder, SaleLine, SaleDelivery, SaleDeliveryLine
from accounting.models import AccountingSettings, JournalEntry
from accounting.services import AccountingMapper, JournalEntryService
from sales.services import SalesService
from django.core.exceptions import ValidationError

try:
    # 1. Setup
    settings = AccountingSettings.objects.first()
    warehouse = Warehouse.objects.first()
    if not warehouse:
        warehouse = Warehouse.objects.create(code="WH-TEST", name="Test Warehouse")

    # 2. Get/Create Test Data
    # Categories
    cat_supplies, _ = ProductCategory.objects.get_or_create(name="Insumos")
    cat_finished, _ = ProductCategory.objects.get_or_create(name="Productos Terminados")

    # Accounts
    acc_raw = cat_supplies.asset_account
    acc_finished = cat_finished.asset_account
    
    print(f"DEBUG: Insumos Account: {acc_raw.code if acc_raw else 'MISSING'}")
    print(f"DEBUG: Finished Account: {acc_finished.code if acc_finished else 'MISSING'}")

    # Component (Paper) - Should belong to Insumos
    comp_paper = Product.objects.filter(code="INS-0001").first()
    if not comp_paper:
        # Create it if missing
        resma = UoM.objects.filter(name__icontains="resma").first()
        comp_paper = Product.objects.create(
            code="INS-0001", 
            name="Resma de papel test", 
            category=cat_supplies, 
            product_type='STORABLE', 
            uom=resma,
            cost_price=Decimal('4000')
        )
    
    # Ensure it's in cat_supplies
    if comp_paper.category != cat_supplies:
        comp_paper.category = cat_supplies
        comp_paper.save()
    
    # Finished Product (Flyer) - Should belong to Productos Terminados
    product_flyer = Product.objects.filter(code="PT-0001").first()
    if not product_flyer:
         un = UoM.objects.filter(name__icontains="unid").first()
         product_flyer = Product.objects.create(
             code="PT-0001",
             name="Impresion a color test",
             category=cat_finished,
             product_type='MANUFACTURABLE',
             uom=un,
             track_inventory=False,
             sale_price=Decimal('150')
         )
    
    # Ensure it doesn't track inventory
    product_flyer.track_inventory = False
    product_flyer.save()

    # BOM setup
    bom = BillOfMaterials.objects.filter(product=product_flyer, active=True).first()
    if not bom:
        bom = BillOfMaterials.objects.create(product=product_flyer, name="Test BOM", active=True)
        BillOfMaterialsLine.objects.create(bom=bom, component=comp_paper, quantity=Decimal('0.01'), uom=comp_paper.uom)

    # 3. Simulate Delivery
    from contacts.models import Contact
    customer = Contact.objects.first()
    if not customer:
         customer = Contact.objects.create(name="Test Customer", tax_id="1-1")

    order = SaleOrder.objects.create(
        customer=customer,
        status=SaleOrder.Status.CONFIRMED,
        payment_method=SaleOrder.PaymentMethod.CASH
    )

    line = SaleLine.objects.create(
        order=order,
        product=product_flyer,
        quantity=Decimal('10'),
        unit_price=Decimal('150'),
        uom=product_flyer.uom
    )
    order.recalculate_totals()
    order.save()

    print(f"DEBUG: Sale Order {order.number} created.")

    # Confirm Delivery via SalesService (Path B for non-tracked manufactured)
    delivery = SalesService.dispatch_order(order, warehouse)
    print(f"DEBUG: Delivery {delivery.number} confirmed with cost {delivery.total_cost}.")

    # 4. Verify Accounting Mapper Output
    desc, ref, items = AccountingMapper.get_entries_for_delivery(delivery, settings)

    print("\n--- GENERATED ACCOUNTING ENTRIES ---")
    credited_accounts = []
    for item in items:
        acc_type = "DEBIT" if item['debit'] > 0 else "CREDIT"
        amount = item['debit'] if item['debit'] > 0 else item['credit']
        print(f"{acc_type}: {item['account'].code} - {item['account'].name} | Amount: {amount}")
        if item['credit'] > 0:
            credited_accounts.append(item['account'].code)

    # Check if component account (raw materials) was credited instead of finished goods
    raw_code = acc_raw.code
    finished_code = acc_finished.code

    print(f"\nExpected Raw Account: {raw_code}")
    print(f"Avoided Finished Account: {finished_code}")

    if raw_code in credited_accounts:
        if finished_code in credited_accounts and raw_code != finished_code:
             print("WARNING: Both accounts were credited. Might be multiple lines or error.")
        else:
             print("VERIFICATION SUCCESS: Component account was correctly credited!")
    else:
        print(f"VERIFICATION FAILURE: Component account {raw_code} was NOT found in credits. Credits: {credited_accounts}")

except Exception as e:
    print(f"ERROR DURING VERIFICATION: {str(e)}")
    import traceback
    traceback.print_exc()
# finally:
#     # Cleanup (optional, but keep it clean)
#     try:
#         if 'delivery' in locals(): delivery.delete()
#         if 'order' in locals(): order.delete()
#     except: pass
