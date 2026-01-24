import os
import django
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from billing.models import Invoice
from billing.note_checkout_service import NoteCheckoutService
from inventory.models import Product, Warehouse, UoM, StockMove
from sales.models import SaleOrder, SaleLine
from contacts.models import Contact
from accounting.models import AccountingSettings, Account, JournalEntry

def reproduce_issue():
    print("Starting Reproduction of Partial Note Issue...")
    
    # 1. Setup Data
    acc_receivable, _ = Account.objects.get_or_create(code='1.1.01', defaults={'name': 'Receivable', 'account_type': 'ASSET'})
    acc_revenue, _ = Account.objects.get_or_create(code='4.1.01', defaults={'name': 'Revenue', 'account_type': 'REVENUE'})
    acc_tax, _ = Account.objects.get_or_create(code='2.1.01', defaults={'name': 'Tax', 'account_type': 'LIABILITY'})
    acc_inventory, _ = Account.objects.get_or_create(code='1.1.05', defaults={'name': 'Inventory', 'account_type': 'ASSET'})
    acc_cogs, _ = Account.objects.get_or_create(code='5.1.01', defaults={'name': 'COGS', 'account_type': 'EXPENSE'})

    import random
    rand_suffix = random.randint(1000, 99999)

    settings = AccountingSettings.objects.first()
    if not settings:
        AccountingSettings.objects.create(
            default_receivable_account=acc_receivable,
            default_revenue_account=acc_revenue,
            default_tax_payable_account=acc_tax,
            default_inventory_account=acc_inventory,
            storable_inventory_account=acc_inventory,
            default_expense_account=acc_cogs,
            merchandise_cogs_account=acc_cogs,
        )

    warehouse, _ = Warehouse.objects.get_or_create(
        name=f'Test Warehouse {rand_suffix}',
        defaults={'code': f'WH-{rand_suffix}'}
    )
    uom, _ = UoM.objects.get_or_create(name='Unit')
    contact, _ = Contact.objects.get_or_create(name='Test Customer', tax_id='1-9')
    
    from inventory.models import ProductCategory
    category, _ = ProductCategory.objects.get_or_create(name='Test Cat')

    # Product with Cost Price 100
    product, _ = Product.objects.get_or_create(
        internal_code=f'PROD_TEST_{rand_suffix}',
        defaults={
            'name': 'Test Product',
            'product_type': Product.Type.STORABLE,
            'track_inventory': True,
            'uom': uom,
            'category': category,
            'cost_price': Decimal('100'),
            'sale_price': Decimal('200')
        }
    )
    product.cost_price = Decimal('100')
    product.save()

    # Create Invoice (Posted)
    invoice = Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA,
        status=Invoice.Status.POSTED,
        date=timezone.now().date(),
        contact=contact,
        number=12345 + rand_suffix
    )
    # Mock sale order linkage (Note service needs it for validation sometimes)
    order = SaleOrder.objects.create(customer=contact, number=f"NV-{rand_suffix}")
    SaleLine.objects.create(order=order, product=product, quantity=10, unit_price=200, quantity_delivered=10)
    invoice.sale_order = order
    invoice.save()

    # 2. Execute Process Full Checkout (Credit Note for 5, Return 2)
    qty_invoice = Decimal('5')
    qty_return = Decimal('2')
    
    selected_items = [{
        'product_id': product.id,
        'quantity': float(qty_invoice), # Invoice for 5
        'unit_price': 200,
        'tax_amount': 38,
        'line_net': 1000,
        'line_id': 'line_1' # Needed for linking
    }]

    logistics_data = {
        'warehouse_id': warehouse.id,
        'delivery_type': 'PARTIAL',
        'date': str(timezone.now().date()),
        'line_data': [{
            'line_id': 'line_1', # Matches selected_item
            'quantity': float(qty_return), # Return 2
            'uom_id': uom.id
        }]
    }

    registration_data = {
        'document_number': '67890',
        'document_date': str(timezone.now().date()),
        'is_pending': False
    }

    print(f"Testing: Invoice Qty {qty_invoice}, Returned Qty {qty_return}")

    try:
        workflow = NoteCheckoutService.process_full_checkout(
            original_invoice_id=invoice.id,
            note_type=Invoice.DTEType.NOTA_CREDITO,
            selected_items=selected_items,
            registration_data=registration_data,
            logistics_data=logistics_data,
            reason="Partial Return Test"
        )
        
        # 3. Verify Results
        
        # Check Movements
        moves = StockMove.objects.filter(description__contains=f"REF: WF-{workflow.id}")
        total_moved = sum(m.quantity for m in moves) # Should be positive (IN) for Sale NC
        
        movements_passed = False
        if total_moved == qty_return:
            movements_passed = True
        
        # Check Accounting (COGS Reversal)
        expected_cogs_reversal = qty_return * product.cost_price

        entry = workflow.invoice.journal_entry
        inv_lines = entry.items.filter(account=acc_inventory, debit__gt=0)
        total_inv_debit = sum(line.debit for line in inv_lines)
        
        accounting_passed = False
        if total_inv_debit == expected_cogs_reversal:
            accounting_passed = True
            
        print("\n\n=== FINAL RESULTS ===")
        print(f"Moves: {total_moved} (Expected {qty_return}) -> {'PASS' if movements_passed else 'FAIL'}")
        print(f"Accounting: {total_inv_debit} (Expected {expected_cogs_reversal}) -> {'PASS' if accounting_passed else 'FAIL'}")
        
    except Exception as e:
        print(f"EXCEPTION: {e}")
        import traceback
        traceback.print_exc()

    except Exception as e:
        print(f"EXCEPTION: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    reproduce_issue()
