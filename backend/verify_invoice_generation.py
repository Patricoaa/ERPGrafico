
import os
import django
from decimal import Decimal
from django.utils import timezone

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

print("Imports started")
try:
    from contacts.models import Contact
    print("Imported Contact")
    from treasury.models import PaymentMethod, POSTerminal, TerminalBatch, TreasuryAccount
    print("Imported Treasury models")
    from inventory.models import Product, UoM, ProductCategory
    print("Imported Inventory models")
    from treasury.services import TerminalBatchService
    print("Imported Treasury Service")
    from accounting.models import Account, AccountType
    print("Imported Accounting models")
    from billing.models import Invoice
    print("Imported Billing models")
except Exception as e:
    print(f"IMPORT ERROR: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

def run_verification():
    print("Starting verification...")
    
    # 1. Setup Data
    print("Setting up Accounts...")
    # Accounts
    asset_type, _ = AccountType.objects.get_or_create(name="Activo", code="ASSET")
    expense_type, _ = AccountType.objects.get_or_create(name="Gasto", code="EXPENSE")
    
    bank_acc, _ = Account.objects.get_or_create(code="1-1-001", defaults={"name": "Banco", "account_type": asset_type})
    receivable_acc, _ = Account.objects.get_or_create(code="1-1-004", defaults={"name": "Por Cobrar Transbank", "account_type": asset_type})
    expense_acc, _ = Account.objects.get_or_create(code="5-1-003", defaults={"name": "Comis. Transbank", "account_type": expense_type})
    
    print("Setting up TreasuryAccount...")
    treasury_acc = TreasuryAccount.objects.create(name="Banco Test", account=bank_acc)
    
    # Supplier
    print("Setting up Supplier...")
    supplier = Contact.objects.create(name="Transbank Test", is_supplier=True)
    
    # Product (Service)
    print("Setting up Product...")
    cat, _ = ProductCategory.objects.get_or_create(name="Servicios")
    uom, _ = UoM.objects.get_or_create(name="Unidad")
    service_product = Product.objects.create(
        name="Comision Transbank",
        product_type=Product.Type.SERVICE,
        uom=uom,
        category=cat,
        sale_price=100,
        cost_price=100
    )
    
    # Payment Method
    print("Setting up PaymentMethod...")
    pm = PaymentMethod.objects.create(
        name="Redcompra Test",
        method_type=PaymentMethod.Type.CARD_TERMINAL,
        treasury_account=treasury_acc,
        is_terminal=True,
        supplier=supplier,
        terminal_receivable_account=receivable_acc,
        commission_expense_account=expense_acc,
        commission_product=service_product  # <--- CRITICAL
    )
    
    # Terminal
    print("Setting up Terminal...")
    terminal = POSTerminal.objects.create(name="POS 1", account=treasury_acc)
    terminal.allowed_payment_methods.add(pm)
    
    # Batches (Settled)
    print("Creating Batch...")
    today = timezone.now().date()
    batch1 = TerminalBatch.objects.create(
        terminal=terminal,
        batch_number="123",
        sales_date=today,
        net_amount=10000,
        commission_base=200, # Net commission
        commission_tax=38,   # VAT on commission
        status=TerminalBatch.Status.SETTLED, # Already settled
        supplier=supplier
    )
    # Note: TerminalBatchService.create_batch usually handles creation logic, but we just need a settled batch record here.
    
    print(f"Created batch {batch1.id} with commission base {batch1.commission_base}")
    
    # 2. Run Generation
    print("Generating Monthly Invoice...")
    try:
        invoice = TerminalBatchService.generate_monthly_invoice(
            supplier=supplier,
            year=today.year,
            month=today.month,
            number="FACT-001",
            date=today
        )
        
        if invoice:
            print(f"SUCCESS: Invoice {invoice.number} created.")
            print(f"Invoice Total Net: {invoice.total_net}")
            print(f"Invoice Total: {invoice.total}")
            
            # Verify linkage
            batch1.refresh_from_db()
            if batch1.supplier_invoice == invoice:
                print("SUCCESS: Batch linked to invoice.")
            else:
                print("FAILURE: Batch NOT linked to invoice.")
                
            # Verify PO linkage
            po = invoice.purchase_order # Assuming related_name='invoices' or similar reverse relation from Invoice to PO?
            # Wait, Invoice model usually has foreign key to PO? Or PO has ManyToMany to Invoices?
            # PurchaseOrder model has: `invoices = ...` (reverse relation from Invoice.purchase_order if it exists)
            # Let's check Invoice model structure if possible, but usually Invoice -> PurchaseOrder via `purchase_order` field.
            
            if invoice.purchase_order:
                 print(f"SUCCESS: Invoice linked to PO {invoice.purchase_order.number}")
                 line = invoice.purchase_order.lines.first()
                 if line.product == service_product:
                     print("SUCCESS: PO Line uses correct Service Product.")
                 else:
                     print(f"FAILURE: PO Line product mismatch. Got {line.product.name}")
            else:
                 print("WARNING: Invoice not directly linked to PO field (might be using different relation), checking reverse...")
                 # Check if PO exists for this supplier/date
                 from purchasing.models import PurchaseOrder
                 po = PurchaseOrder.objects.filter(supplier=supplier, date=today).last()
                 if po:
                     print(f"Found PO {po.number}. Checking if logic created it.")
                 else:
                     print("FAILURE: No PO found.")

        else:
            print("FAILURE: No invoice returned.")
            
    except Exception as e:
        print(f"EXCEPTION: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_verification()
