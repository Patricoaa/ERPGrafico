"""
Manual test script for NoteCheckoutService
Run with: python backend/manage.py shell < backend/billing/test_note_manual.py
"""

from decimal import Decimal
from django.utils import timezone
from django.db import transaction

from billing.models import Invoice
from billing.note_workflow import NoteWorkflow
from billing.note_checkout_service import NoteCheckoutService
from sales.models import SaleOrder, SaleLine
from inventory.models import Product, Warehouse, UoM, StockMove, UoMCategory, ProductCategory
from accounting.models import AccountingSettings, Account
from contacts.models import Contact
from core.models import User


def setup_test_data():
    """Setup basic test data"""
    print("🔧 Setting up test data...")
    
    # Get or create accounting
    acc_receivable, _ = Account.objects.get_or_create(
        code='1.1.01',
        defaults={'name': 'Cuentas por Cobrar', 'account_type': 'ASSET'}
    )
    acc_revenue, _ = Account.objects.get_or_create(
        code='4.1.01',
        defaults={'name': 'Ingresos', 'account_type': 'REVENUE'}
    )
    acc_tax_payable, _ = Account.objects.get_or_create(
        code='2.1.02',
        defaults={'name': 'IVA por Pagar', 'account_type': 'LIABILITY'}
    )
    acc_inventory, _ = Account.objects.get_or_create(
        code='1.2.01',
        defaults={'name': 'Inventario', 'account_type': 'ASSET'}
    )
    
    settings, _ = AccountingSettings.objects.get_or_create(
        id=1,
        defaults={
            'default_receivable_account': acc_receivable,
            'default_revenue_account': acc_revenue,
            'default_tax_payable_account': acc_tax_payable,
            'default_inventory_account': acc_inventory
        }
    )
    
    # UoM
    uom_cat, _ = UoMCategory.objects.get_or_create(name='Unit Category')
    uom, _ = UoM.objects.get_or_create(
        name='Unit', 
        defaults={
            'category': uom_cat,
            'ratio': Decimal('1.0'),
            'rounding': Decimal('0.01'),
            'active': True
        }
    )
    if not uom.category:
        uom.category = uom_cat
        uom.save()
    
    # Customer
    customer, _ = Contact.objects.get_or_create(
        name='Test Customer NC',
        defaults={'tax_id': '11111111-1', 'account_receivable': acc_receivable}
    )
    
    # Warehouse
    warehouse, _ = Warehouse.objects.get_or_create(name='Test Warehouse NC')
    
    # Product Category
    prod_cat, _ = ProductCategory.objects.get_or_create(name='Test Category NC')

    # Products
    service, _ = Product.objects.get_or_create(
        internal_code='SRV-TEST-NC',
        defaults={
            'name': 'Test Service NC',
            'product_type': 'SERVICE',
            'category': prod_cat,
            'uom': uom,
            'track_inventory': False,
            'income_account': acc_revenue
        }
    )
    
    stockable, _ = Product.objects.get_or_create(
        internal_code='STK-TEST-NC',
        defaults={
            'name': 'Test Stockable NC',
            'product_type': 'STORABLE',
            'category': prod_cat,
            'uom': uom,
            'track_inventory': True,
            'cost_price': Decimal('500')
        }
    )
    
    print("✅ Test data ready")
    return {
        'customer': customer,
        'warehouse': warehouse,
        'uom': uom,
        'service': service,
        'stockable': stockable
    }


def create_posted_invoice(setup):
    """Create a posted invoice for testing"""
    print("\n📄 Creating posted invoice...")
    
    # Create sale order
    order = SaleOrder.objects.create(
        customer=setup['customer'],
        status=SaleOrder.Status.CONFIRMED,
        payment_method='CREDIT'
    )
    
    # Add lines
    SaleLine.objects.create(
        order=order,
        product=setup['service'],
        quantity=2,
        unit_price=Decimal('1000'),
        uom=setup['uom'],
        quantity_delivered=2
    )
    
    SaleLine.objects.create(
        order=order,
        product=setup['stockable'],
        quantity=10,
        unit_price=Decimal('800'),
        uom=setup['uom'],
        quantity_delivered=10
    )
    
    # Create invoice
    invoice = Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA,
        number='F-TEST-NC-001',
        status=Invoice.Status.POSTED,
        sale_order=order,
        contact=setup['customer'],
        total_net=Decimal('10000'),
        total_tax=Decimal('1900'),
        total=Decimal('11900')
    )
    
    print(f"✅ Invoice created: {invoice.display_id} - ${invoice.total}")
    return invoice, order


@transaction.atomic
def test_complete_workflow():
    """Test complete NC workflow"""
    print("\n" + "="*60)
    print("TESTING NOTE CHECKOUT WORKFLOW")
    print("="*60)
    
    # Setup
    setup = setup_test_data()
    invoice, order = create_posted_invoice(setup)
    
    try:
        # Stage 1: Init workflow
        print("\n1. Initializing workflow...")
        workflow = NoteCheckoutService.init_note_workflow(
            corrected_invoice_id=invoice.id,
            note_type=Invoice.DTEType.NOTA_CREDITO,
            reason="Devolución de mercadería dañada"
        )
        print(f"   Workflow created: ID={workflow.id}, Stage={workflow.get_current_stage_display()}")
        print(f"   Note invoice: {workflow.invoice.display_id} (Status: {workflow.invoice.get_status_display()})")
        
        # Stage 2: Select items
        print("\n2. Selecting items...")
        workflow = NoteCheckoutService.select_items(
            workflow_id=workflow.id,
            selected_items=[
                {
                    'product_id': setup['stockable'].id,
                    'quantity': 3,
                    'reason': 'Producto dañado',
                    'unit_price': 800,
                    'tax_amount': 152
                },
                {
                    'product_id': setup['service'].id,
                    'quantity': 1,
                    'reason': 'No prestado',
                    'unit_price': 1000,
                    'tax_amount': 190
                }
            ]
        )
        print(f"   Items selected: {workflow.total_items} products")
        print(f"   Total Net: ${workflow.invoice.total_net}")
        print(f"   Total Tax: ${workflow.invoice.total_tax}")
        print(f"   Total: ${workflow.invoice.total}")
        print(f"   Requires logistics: {workflow.requires_logistics}")
        
        # Stage 3: Logistics
        if workflow.requires_logistics:
            print("\n3. Processing logistics...")
            workflow = NoteCheckoutService.process_logistics(
                workflow_id=workflow.id,
                warehouse_id=setup['warehouse'].id,
                date=timezone.now().date(),
                notes="Recibido en bodega principal"
            )
            print(f"   Logistics processed: {workflow.get_current_stage_display()}")
            
            # Check stock moves
            moves = StockMove.objects.filter(
                description__contains=f"WORKFLOW-{workflow.id}"
            )
            print(f"   Stock moves created: {moves.count()}")
            for move in moves:
                print(f"      - {move.product.name}: {move.quantity} ({move.move_type})")
        else:
            print("\n3. Skipping logistics (no stockable items)...")
            workflow = NoteCheckoutService.skip_logistics(workflow_id=workflow.id)
            print(f"   Logistics skipped")
        
        # Stage 4: Register document
        print("\n4. Registering document...")
        workflow = NoteCheckoutService.register_document(
            workflow_id=workflow.id,
            document_number='NC-MANUAL-001',
            is_pending=False
        )
        print(f"   Document registered: {workflow.invoice.display_id}")
        print(f"   Status: {workflow.invoice.get_status_display()}")
        print(f"   Journal entry: ID={workflow.invoice.journal_entry.id if workflow.invoice.journal_entry else 'None'}")
        
        # Check accounting
        if workflow.invoice.journal_entry:
            entry = workflow.invoice.journal_entry
            print(f"\n   Accounting Entry:")
            print(f"      Status: {entry.get_status_display()}")
            print(f"      Items: {entry.items.count()}")
            for item in entry.items.all():
                print(f"         {item.account.name}: D${item.debit} C${item.credit}")
        
        # Stage 5: Complete
        print("\n5. Completing workflow...")
        workflow = NoteCheckoutService.complete_workflow(
            workflow_id=workflow.id,
            payment_data={'method': 'CREDIT', 'apply_credit': True}
        )
        print(f"   Workflow completed: {workflow.get_current_stage_display()}")
        
        print("\n" + "="*60)
        print("ALL TESTS PASSED!")
        print("="*60)
        
        return True

        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


# Run tests
if __name__ == '__main__':
    test_complete_workflow()
