
import os
import django
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from purchasing.models import PurchaseOrder, PurchaseLine
from purchasing.services import PurchasingService
from inventory.models import Product, Warehouse, ProductCategory
from contacts.models import Contact
from accounting.models import Account, AccountType, AccountingSettings, JournalItem
from billing.models import Invoice

def run_test():
    print("--- Starting Credit Note Accounting Verification V2 ---")
    
    # 1. Setup Data
    warehouse, _ = Warehouse.objects.get_or_create(code="TEST-WH", defaults={'name': "Test Warehouse"})
    
    # Ensure Accounts
    payable_acc = AccountingSettings.objects.first().default_payable_account
    stock_input_acc = AccountingSettings.objects.first().stock_input_account
    inventory_acc = AccountingSettings.objects.first().default_inventory_account
    
    print(f"Payable Account: {payable_acc.code} ({payable_acc.account_type})")
    print(f"Stock Input Account: {stock_input_acc.code}")
    print(f"Inventory Account: {inventory_acc.code}")
    
    supplier, _ = Contact.objects.get_or_create(
        tax_id="99.999.999-9",
        defaults={'name': "Test Supplier V2", 'account_payable': payable_acc}
    )
    
    # Ensure Product
    category, _ = ProductCategory.objects.get_or_create(name="Test Cat")
    product, _ = Product.objects.get_or_create(
        code="TEST-PROD-V2", 
        defaults={
            'name': "Test Product V2", 
            'category': category, 
            'sale_price': 1000, 
            'cost': 500,
            'price': 500
        }
    )
    
    # 2. Create Order
    po = PurchaseOrder.objects.create(supplier=supplier, warehouse=warehouse)
    line = PurchaseLine.objects.create(
        order=po, 
        product=product, 
        quantity=10, 
        unit_cost=1000  # Total Net 10,000
    )
    po.total_net = 10000
    po.total_tax = 1900
    po.total = 11900
    po.status = 'CONFIRMED'
    po.save()
    
    # 3. Receive Order (Full) -> Dr Inventory / Cr Stock Input
    print("Receiving Order...")
    PurchasingService.receive_order(po, warehouse, "2024-01-01", "DEL-001")
    
    # 4. Invoice Order (Factura) -> Dr Stock Input / Dr Tax / Cr Payable
    print("Creating Invoice...")
    PurchasingService.create_invoice_from_order(
        po, 
        invoice_number="FACT-999", 
        invoice_date="2024-01-01", 
        dte_type=Invoice.DTEType.FACTURA, 
        document_attachment=None
    )
    invoice = po.invoices.first()
    
    # Capture Balances before NC
    def get_balance(account):
        return account.balance
        
    bal_pay_before = get_balance(payable_acc)
    bal_inv_before = get_balance(inventory_acc)
    bal_input_before = get_balance(stock_input_acc)
    
    print(f"Balances Before NC: Pay={bal_pay_before}, Inv={bal_inv_before}, Input={bal_input_before}")
    
    # 5. Create Credit Note (Full Return)
    print("Creating Credit Note...")
    return_items = [{'product_id': product.id, 'quantity': 10, 'line_id': line.id}]
    
    nc = PurchasingService.create_note(
        order=po,
        note_type="NOTA_CREDITO",
        amount_net=Decimal('10000'),
        amount_tax=Decimal('1900'),
        document_number="NC-999",
        return_items=return_items,
        original_invoice_id=invoice.id
    )
    
    # 6. Verify Results
    bal_pay_after = get_balance(payable_acc)
    bal_inv_after = get_balance(inventory_acc)
    bal_input_after = get_balance(stock_input_acc)
    
    print(f"Balances After NC: Pay={bal_pay_after}, Inv={bal_inv_after}, Input={bal_input_after}")
    
    diff_pay = bal_pay_after - bal_pay_before
    diff_inv = bal_inv_after - bal_inv_before
    diff_input = bal_input_after - bal_input_before
    
    print(f"Differences: Pay={diff_pay}, Inv={diff_inv}, Input={diff_input}")
    
    # Assertions
    # Payable should increase (Debit side increases balance for Liability? No, Liability increases with Credit)
    # Liability Logic: Balance = Credit - Debit. 
    # Invoice: Cr Payable (Increases Balance). NC: Dr Payable (Decreases Balance).
    # Expected Diff Pay: -11900 (Liability Reduced)
    
    # Inventory Asset Logic: Balance = Debit - Credit.
    # Receipt: Dr Invent (Increases). NC Return: Cr Invent (Decreases).
    # Expected Diff Inv: -10000 (Asset Reduced)
    
    # Stock Input Logic: Balance = Credit - Debit (Liability).
    # Receipt: Cr Input. Invoice: Dr Input. (Net 0).
    # NC Financial: Cr Input. NC Inventory: Dr Input. (Net 0).
    # Expected Diff Input: 0.
    
    if diff_pay == Decimal('-11900.00'):
        print("✅ Payable Account Correctly Reduced")
    else:
        print(f"❌ Payable Account Error. Expected -11900, got {diff_pay}")
        
    if diff_inv == Decimal('-10000.00'):
        print("✅ Inventory Account Correctly Reduced")
    else:
        print(f"❌ Inventory Account Error. Expected -10000, got {diff_inv}")
        
    if diff_input == Decimal('0.00'):
        print("✅ Stock Input Account Net Change is 0 (Correctly Cleared)")
    else:
        print(f"❌ Stock Input Account Error. Expected 0, got {diff_input}")

    # Verify Journal Items of NC specifically
    print("\nJournal Items for NC:")
    for item in nc.journal_entry.items.all():
        print(f" - {item.account.name}: Dr {item.debit} | Cr {item.credit} ({item.label})")

if __name__ == "__main__":
    run_test()
