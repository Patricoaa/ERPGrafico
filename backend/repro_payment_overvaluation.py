import os
import django
import sys
from decimal import Decimal

# Setup Django environment
sys.path.append(os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from billing.services import BillingService
from sales.models import SaleOrder
from contacts.models import Contact
from treasury.models import Payment, TreasuryAccount
from accounting.models import JournalItem

def test_pos_checkout_with_change():
    print("Testing POS checkout with change (Amount Received > Total)...")
    
    # 1. Setup Data
    customer = Contact.objects.filter(is_default_customer=True).first()
    if not customer:
        customer = Contact(
            name="Cliente General",
            email="cliente@general.com", 
            phone="000000000", 
            tax_id="66666666-6",
            is_default_customer=True
        )
        customer.save()
    account = TreasuryAccount.objects.filter(allows_cash=True).first()
    if not account:
        from accounting.models import Account, AccountType
        asset_account = Account.objects.filter(account_type=AccountType.ASSET).first()
        if not asset_account:
             asset_account = Account.objects.create(
                 code='1101', name='Caja General', account_type=AccountType.ASSET
             )
        account = TreasuryAccount.objects.create(
            name="Caja Test", 
            allows_cash=True,
            account=asset_account
        )
    
    # We need at least one product to create lines
    from inventory.models import Product, UoM, UoMCategory, ProductCategory
    uom_cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="Unidad", defaults={'category': uom_cat})
    cat, _ = ProductCategory.objects.get_or_create(name="Categoría Test")
    
    product, _ = Product.objects.get_or_create(
        name="Producto Test", 
        defaults={
            'sale_price': 1000, 
            'uom': uom, 
            'category': cat,
            'product_type': 'CONSUMABLE'
        }
    )

    order_data = {
        'customer': customer.id,
        'lines': [
            {
                'product': product.id,
                'description': 'Item 1',
                'quantity': 7,
                'unit_price': 1000,
                'tax_rate': 0, # Simplify
                'uom': uom.id
            }
        ]
    }
    
    # Total is 7000
    amount_received = 10000
    
    print(f"Checkout for total 7000, received {amount_received}")
    
    # 2. Run POS Checkout
    invoice = BillingService.pos_checkout(
        order_data=order_data,
        dte_type='BOLETA',
        payment_method='CASH',
        amount=amount_received,
        treasury_account_id=account.id
    )
    
    order = invoice.sale_order
    print(f"Order {order.number} created. Total: {order.total}")
    
    # 3. Verify Payment
    payment = Payment.objects.filter(sale_order=order).first()
    if not payment:
        print("FAIL: No payment record found")
        return
    
    print(f"Payment amount registered: {payment.amount}")
    
    if payment.amount == Decimal('7000'):
        print("SUCCESS: Payment amount capped at 7000")
    else:
        print(f"FAIL: Payment amount is {payment.amount}, expected 7000")

    # 4. Verify Accounting Entry
    items = JournalItem.objects.filter(entry=payment.journal_entry)
    for item in items:
        if item.account == account.account:
            print(f"Accounting - Debit to {item.account.name}: {item.debit}")
            if item.debit == Decimal('7000'):
                print("SUCCESS: Accounting entry correct")
            else:
                print(f"FAIL: Accounting debit is {item.debit}, expected 7000")

if __name__ == "__main__":
    test_pos_checkout_with_change()
