import pytest
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.utils import timezone

from billing.models import Invoice
from billing.note_workflow import NoteWorkflow
from billing.note_checkout_service import NoteCheckoutService
from sales.models import SaleOrder, SaleLine
from purchasing.models import PurchaseOrder, PurchaseLine
from inventory.models import Product, Warehouse, UoM, StockMove
from accounting.models import AccountingSettings, Account, JournalEntry, JournalItem, AccountType
from contacts.models import Contact
from core.models import User


@pytest.fixture
def comprehensive_setup(db):
    """Complete setup for note workflow testing"""
    
    # Accounting setup
    acc_receivable = Account.objects.create(
        code='1.1.01',
        name='Cuentas por Cobrar',
        account_type=AccountType.ASSET
    )
    acc_payable = Account.objects.create(
        code='2.1.01',
        name='Cuentas por Pagar',
        account_type=AccountType.LIABILITY
    )
    acc_revenue = Account.objects.create(
        code='4.1.01',
        name='Ingresos por Ventas',
        account_type=AccountType.REVENUE
    )
    acc_expense = Account.objects.create(
        code='5.1.01',
        name='Costo de Ventas',
        account_type=AccountType.EXPENSE
    )
    acc_inventory = Account.objects.create(
        code='1.2.01',
        name='Inventario',
        account_type=AccountType.ASSET
    )
    acc_tax_payable = Account.objects.create(
        code='2.1.02',
        name='IVA por Pagar',
        account_type=AccountType.LIABILITY
    )
    acc_tax_receivable = Account.objects.create(
        code='1.1.02',
        name='IVA por Recuperar',
        account_type=AccountType.ASSET
    )
    
    settings = AccountingSettings.objects.create(
        default_receivable_account=acc_receivable,
        default_payable_account=acc_payable,
        default_revenue_account=acc_revenue,
        default_expense_account=acc_expense,
        default_inventory_account=acc_inventory,
        default_tax_payable_account=acc_tax_payable,
        default_tax_receivable_account=acc_tax_receivable
    )
    
    # UoM
    uom = UoM.objects.create(name='Unit', code='UNT')
    
    # Contacts
    customer = Contact.objects.create(
        name='Test Customer',
        is_customer=True,
        account_receivable=acc_receivable
    )
    supplier = Contact.objects.create(
        name='Test Supplier',
        is_supplier=True,
        account_payable=acc_payable
    )
    
    # Warehouse
    warehouse = Warehouse.objects.create(name='Main Warehouse')
    
    # User
    user = User.objects.create_user(username='testuser', email='test@test.com')
    
    # Products
    service = Product.objects.create(
        name='Service Product',
        internal_code='SRV01',
        product_type=Product.Type.SERVICE,
        uom=uom,
        track_inventory=False,
        income_account=acc_revenue
    )
    
    consumable = Product.objects.create(
        name='Consumable Product',
        internal_code='CNS01',
        product_type=Product.Type.CONSUMABLE,
        uom=uom,
        track_inventory=False,
        expense_account=acc_expense
    )
    
    stockable = Product.objects.create(
        name='Stockable Product',
        internal_code='STK01',
        product_type=Product.Type.STORABLE,
        uom=uom,
        track_inventory=True,
        cost_price=Decimal('500')
    )
    
    manufacturable_with_bom = Product.objects.create(
        name='Manufacturable with BOM',
        internal_code='MFG01',
        product_type=Product.Type.MANUFACTURABLE,
        uom=uom,
        track_inventory=True,
        requires_advanced_manufacturing=False,
        has_bom=True
    )
    
    manufacturable_advanced = Product.objects.create(
        name='Advanced Manufacturable',
        internal_code='MFG02',
        product_type=Product.Type.MANUFACTURABLE,
        uom=uom,
        track_inventory=False,
        requires_advanced_manufacturing=True,
        has_bom=False
    )
    
    return {
        'settings': settings,
        'accounts': {
            'receivable': acc_receivable,
            'payable': acc_payable,
            'revenue': acc_revenue,
            'expense': acc_expense,
            'inventory': acc_inventory,
            'tax_payable': acc_tax_payable,
            'tax_receivable': acc_tax_receivable,
        },
        'uom': uom,
        'customer': customer,
        'supplier': supplier,
        'warehouse': warehouse,
        'user': user,
        'products': {
            'service': service,
            'consumable': consumable,
            'stockable': stockable,
            'mfg_with_bom': manufacturable_with_bom,
            'mfg_advanced': manufacturable_advanced,
        }
    }


@pytest.fixture
def posted_sale_invoice(comprehensive_setup):
    """Create a posted sale invoice for testing"""
    setup = comprehensive_setup
    
    # Create sale order
    order = SaleOrder.objects.create(
        customer=setup['customer'],
        status=SaleOrder.Status.CONFIRMED,
        payment_method='CREDIT'
    )
    
    # Add lines
    SaleLine.objects.create(
        order=order,
        product=setup['products']['service'],
        quantity=2,
        unit_price=Decimal('1000'),
        uom=setup['uom'],
        quantity_delivered=2
    )
    
    SaleLine.objects.create(
        order=order,
        product=setup['products']['stockable'],
        quantity=10,
        unit_price=Decimal('800'),
        uom=setup['uom'],
        quantity_delivered=10
    )
    
    # Create invoice
    invoice = Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA,
        number='F-001',
        status=Invoice.Status.POSTED,
        sale_order=order,
        contact=setup['customer'],
        total_net=Decimal('10000'),  # 2*1000 + 10*800
        total_tax=Decimal('1900'),    # 19%
        total=Decimal('11900')
    )
    
    # Create journal entry
    entry = JournalEntry.objects.create(
        date=timezone.now().date(),
        description=f"Factura {invoice.number}",
        status=JournalEntry.State.POSTED
    )
    
    invoice.journal_entry = entry
    invoice.save()
    
    return {
        'invoice': invoice,
        'order': order,
        **comprehensive_setup
    }


# ==================== VALIDATION TESTS ====================

@pytest.mark.django_db
def test_init_workflow_valid_origin_statuses(comprehensive_setup):
    """Test that workflow can be created from POSTED or PAID invoices, but not DRAFT"""
    setup = comprehensive_setup
    
    # 1. DRAFT invoice should fail
    draft_invoice = Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA,
        status=Invoice.Status.DRAFT,
        contact=setup['customer'],
        total=Decimal('1000')
    )
    
    with pytest.raises(ValidationError, match="Solo se pueden crear NC/ND desde facturas publicadas o pagadas"):
        NoteCheckoutService.init_note_workflow(
            corrected_invoice_id=draft_invoice.id,
            note_type=Invoice.DTEType.NOTA_CREDITO,
            reason="Test"
        )

    # 2. PAID invoice should succeed
    paid_invoice = Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA,
        status=Invoice.Status.PAID,
        contact=setup['customer'],
        total=Decimal('1000')
    )
    
    workflow = NoteCheckoutService.init_note_workflow(
        corrected_invoice_id=paid_invoice.id,
        note_type=Invoice.DTEType.NOTA_CREDITO,
        reason="Test"
    )
    assert workflow.corrected_invoice == paid_invoice


@pytest.mark.django_db
def test_init_workflow_not_from_another_note(posted_sale_invoice):
    """Test that workflow cannot be created from another note"""
    setup = posted_sale_invoice
    
    # Create a credit note
    credit_note = Invoice.objects.create(
        dte_type=Invoice.DTEType.NOTA_CREDITO,
        number='NC-001',
        status=Invoice.Status.POSTED,
        sale_order=setup['order'],
        contact=setup['customer'],
        total=Decimal('1000')
    )
    
    # Should fail
    with pytest.raises(ValidationError, match="No se puede crear una nota desde otra nota"):
        NoteCheckoutService.init_note_workflow(
            corrected_invoice_id=credit_note.id,
            note_type=Invoice.DTEType.NOTA_CREDITO,
            reason="Test"
        )


@pytest.mark.django_db
def test_init_workflow_success(posted_sale_invoice):
    """Test successful workflow initialization"""
    setup = posted_sale_invoice
    
    workflow = NoteCheckoutService.init_note_workflow(
        corrected_invoice_id=setup['invoice'].id,
        note_type=Invoice.DTEType.NOTA_CREDITO,
        reason="Devolución de mercadería",
        created_by=setup['user']
    )
    
    assert workflow is not None
    assert workflow.current_stage == NoteWorkflow.Stage.INVOICE_SELECTED
    assert workflow.corrected_invoice == setup['invoice']
    assert workflow.invoice.dte_type == Invoice.DTEType.NOTA_CREDITO
    assert workflow.invoice.status == Invoice.Status.DRAFT
    assert workflow.reason == "Devolución de mercadería"
    assert workflow.created_by == setup['user']


# ==================== SELECT ITEMS TESTS ====================

@pytest.mark.django_db
def test_select_items_validates_quantity(posted_sale_invoice):
    """Test that select_items validates quantity against delivered"""
    setup = posted_sale_invoice
    
    workflow = NoteCheckoutService.init_note_workflow(
        corrected_invoice_id=setup['invoice'].id,
        note_type=Invoice.DTEType.NOTA_CREDITO,
        reason="Test"
    )
    
    stockable = setup['products']['stockable']
    
    # Attempt to return more than delivered (10)
    with pytest.raises(ValidationError, match="excede cantidad entregada"):
        NoteCheckoutService.select_items(
            workflow_id=workflow.id,
            selected_items=[{
                'product_id': stockable.id,
                'quantity': 15,  # More than delivered
                'unit_price': 800,
                'tax_amount': 152
            }]
        )


@pytest.mark.django_db
def test_select_items_identifies_stockable(posted_sale_invoice):
    """Test that stockable items are identified correctly"""
    setup = posted_sale_invoice
    
    workflow = NoteCheckoutService.init_note_workflow(
        corrected_invoice_id=setup['invoice'].id,
        note_type=Invoice.DTEType.NOTA_CREDITO,
        reason="Test"
    )
    
    workflow = NoteCheckoutService.select_items(
        workflow_id=workflow.id,
        selected_items=[
            {
                'product_id': setup['products']['stockable'].id,
                'quantity': 5,
                'unit_price': 800,
                'tax_amount': 152
            },
            {
                'product_id': setup['products']['service'].id,
                'quantity': 1,
                'unit_price': 1000,
                'tax_amount': 190
            }
        ]
    )
    
    workflow.refresh_from_db()
    
    # Should require logistics because stockable is present
    assert workflow.requires_logistics is True
    assert workflow.current_stage == NoteWorkflow.Stage.ITEMS_SELECTED
    assert len(workflow.selected_items) == 2
    
    # Check total calculation
    expected_net = Decimal('5') * Decimal('800') + Decimal('1') * Decimal('1000')
    expected_tax = Decimal('5') * Decimal('152') + Decimal('1') * Decimal('190')
    
    assert workflow.invoice.total_net == expected_net
    assert workflow.invoice.total_tax == expected_tax


@pytest.mark.django_db
def test_select_items_excludes_advanced_manufacturable(comprehensive_setup):
    """Test that advanced manufacturable products don't trigger logistics"""
    setup = comprehensive_setup
    
    # Create invoice with advanced manufacturable
    order = SaleOrder.objects.create(
        customer=setup['customer'],
        status=SaleOrder.Status.CONFIRMED
    )
    
    SaleLine.objects.create(
        order=order,
        product=setup['products']['mfg_advanced'],
        quantity=3,
        unit_price=Decimal('2000'),
        uom=setup['uom'],
        quantity_delivered=3
    )
    
    invoice = Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA,
        number='F-002',
        status=Invoice.Status.POSTED,
        sale_order=order,
        contact=setup['customer'],
        total=Decimal('7140')  # 3*2000*1.19
    )
    
    # Create workflow
    workflow = NoteCheckoutService.init_note_workflow(
        corrected_invoice_id=invoice.id,
        note_type=Invoice.DTEType.NOTA_CREDITO,
        reason="Test"
    )
    
    # Select advanced manufacturable
    workflow = NoteCheckoutService.select_items(
        workflow_id=workflow.id,
        selected_items=[{
            'product_id': setup['products']['mfg_advanced'].id,
            'quantity': 2,
            'unit_price': 2000,
            'tax_amount': 380
        }]
    )
    
    workflow.refresh_from_db()
    
    # Should NOT require logistics (advanced manufacturable doesn't recover stock)
    assert workflow.requires_logistics is False
    assert workflow.selected_items[0]['creates_stock_move'] is False


# ==================== LOGISTICS TESTS ====================

@pytest.mark.django_db
def test_process_logistics_creates_stock_moves(posted_sale_invoice):
    """Test that logistics creates proper stock movements"""
    setup = posted_sale_invoice
    
    workflow = NoteCheckoutService.init_note_workflow(
        corrected_invoice_id=setup['invoice'].id,
        note_type=Invoice.DTEType.NOTA_CREDITO,
        reason="Test"
    )
    
    workflow = NoteCheckoutService.select_items(
        workflow_id=workflow.id,
        selected_items=[{
            'product_id': setup['products']['stockable'].id,
            'quantity': 5,
            'unit_price': 800,
            'tax_amount': 152
        }]
    )
    
    # Process logistics
    workflow = NoteCheckoutService.process_logistics(
        workflow_id=workflow.id,
        warehouse_id=setup['warehouse'].id,
        date=timezone.now().date(),
        notes="Recibido correctamente"
    )
    
    workflow.refresh_from_db()
    
    assert workflow.current_stage == NoteWorkflow.Stage.LOGISTICS_COMPLETED
    assert workflow.logistics_data is not None
    assert workflow.logistics_data['warehouse_id'] == setup['warehouse'].id
    
    # Check stock move was created
    stock_moves = StockMove.objects.filter(
        product=setup['products']['stockable'],
        warehouse=setup['warehouse']
    )
    
    assert stock_moves.exists()
    move = stock_moves.first()
    assert move.move_type == StockMove.Type.IN  # Credit note = IN
    assert move.quantity == Decimal('5')


@pytest.mark.django_db
def test_skip_logistics_for_services(comprehensive_setup):
    """Test skipping logistics when only services"""
    setup = comprehensive_setup
    
    # Create invoice with only service
    order = SaleOrder.objects.create(
        customer=setup['customer'],
        status=SaleOrder.Status.CONFIRMED
    )
    
    SaleLine.objects.create(
        order=order,
        product=setup['products']['service'],
        quantity=3,
        unit_price=Decimal('1000'),
        uom=setup['uom'],
        quantity_delivered=3
    )
    
    invoice = Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA,
        number='F-003',
        status=Invoice.Status.POSTED,
        sale_order=order,
        contact=setup['customer'],
        total=Decimal('3570')
    )
    
    workflow = NoteCheckoutService.init_note_workflow(
        corrected_invoice_id=invoice.id,
        note_type=Invoice.DTEType.NOTA_CREDITO,
        reason="Test"
    )
    
    workflow = NoteCheckoutService.select_items(
        workflow_id=workflow.id,
        selected_items=[{
            'product_id': setup['products']['service'].id,
            'quantity': 2,
            'unit_price': 1000,
            'tax_amount': 190
        }]
    )
    
    # Should not require logistics
    workflow.refresh_from_db()
    assert workflow.requires_logistics is False
    
    # Skip logistics
    workflow = NoteCheckoutService.skip_logistics(workflow_id=workflow.id)
    workflow.refresh_from_db()
    
    assert workflow.current_stage == NoteWorkflow.Stage.LOGISTICS_COMPLETED


# ==================== ACCOUNTING TESTS ====================

@pytest.mark.django_db
def test_register_document_creates_accounting_entry(posted_sale_invoice):
    """Test that document registration creates proper accounting entries"""
    setup = posted_sale_invoice
    
    workflow = NoteCheckoutService.init_note_workflow(
        corrected_invoice_id=setup['invoice'].id,
        note_type=Invoice.DTEType.NOTA_CREDITO,
        reason="Test"
    )
    
    # Select service (no logistics)
    workflow = NoteCheckoutService.select_items(
        workflow_id=workflow.id,
        selected_items=[{
            'product_id': setup['products']['service'].id,
            'quantity': 1,
            'unit_price': 1000,
            'tax_amount': 190
        }]
    )
    
    workflow = NoteCheckoutService.skip_logistics(workflow_id=workflow.id)
    
    # Register document
    workflow = NoteCheckoutService.register_document(
        workflow_id=workflow.id,
        document_number='NC-TEST-001',
        is_pending=False
    )
    
    workflow.refresh_from_db()
    
    assert workflow.current_stage == NoteWorkflow.Stage.REGISTRATION_PENDING
    assert workflow.invoice.number == 'NC-TEST-001'
    assert workflow.invoice.status == Invoice.Status.POSTED
    assert workflow.invoice.journal_entry is not None
    
    # Validate journal entry
    entry = workflow.invoice.journal_entry
    assert entry.status == JournalEntry.State.POSTED
    
    items = entry.items.all()
    assert items.count() == 3  # Receivable, Revenue, Tax
    
    # Check receivable (Credit for credit note in sales)
    receivable_item = items.filter(account=setup['accounts']['receivable']).first()
    assert receivable_item is not None
    assert receivable_item.credit == Decimal('1190')  # 1000 + 190
    assert receivable_item.debit == Decimal('0')
    
    # Check revenue (Debit for credit note in sales)
    revenue_item = items.filter(account=setup['accounts']['revenue']).first()
    assert revenue_item is not None
    assert revenue_item.debit == Decimal('0')
    assert revenue_item.credit == Decimal('1000')
    
    # Check tax (Debit for credit note in sales)
    tax_item = items.filter(account=setup['accounts']['tax_payable']).first()
    assert tax_item is not None
    assert tax_item.debit == Decimal('0')
    assert tax_item.credit == Decimal('190')


@pytest.mark.django_db
def test_stockable_uses_inventory_account(posted_sale_invoice):
    """Test that stockable products use inventory account"""
    setup = posted_sale_invoice
    
    workflow = NoteCheckoutService.init_note_workflow(
        corrected_invoice_id=setup['invoice'].id,
        note_type=Invoice.DTEType.NOTA_CREDITO,
        reason="Test"
    )
    
    workflow = NoteCheckoutService.select_items(
        workflow_id=workflow.id,
        selected_items=[{
            'product_id': setup['products']['stockable'].id,
            'quantity': 5,
            'unit_price': 800,
            'tax_amount': 152
        }]
    )
    
    workflow = NoteCheckoutService.process_logistics(
        workflow_id=workflow.id,
        warehouse_id=setup['warehouse'].id,
        date=timezone.now().date()
    )
    
    workflow = NoteCheckoutService.register_document(
        workflow_id=workflow.id,
        document_number='NC-STK-001',
        is_pending=False
    )
    
    workflow.refresh_from_db()
    
    # Check that inventory account was used
    entry = workflow.invoice.journal_entry
    inventory_item = entry.items.filter(account=setup['accounts']['inventory']).first()
    
    assert inventory_item is not None
    assert inventory_item.credit == Decimal('4000')  # 5 * 800


# ==================== COMPLETE WORKFLOW TESTS ====================

@pytest.mark.django_db
def test_complete_workflow_end_to_end(posted_sale_invoice):
    """Test complete workflow from init to completion"""
    setup = posted_sale_invoice
    
    # Stage 1: Init
    workflow = NoteCheckoutService.init_note_workflow(
        corrected_invoice_id=setup['invoice'].id,
        note_type=Invoice.DTEType.NOTA_CREDITO,
        reason="Devolución completa",
        created_by=setup['user']
    )
    assert workflow.current_stage == NoteWorkflow.Stage.INVOICE_SELECTED
    
    # Stage 2: Select items
    workflow = NoteCheckoutService.select_items(
        workflow_id=workflow.id,
        selected_items=[{
            'product_id': setup['products']['stockable'].id,
            'quantity': 3,
            'unit_price': 800,
            'tax_amount': 152
        }]
    )
    assert workflow.current_stage == NoteWorkflow.Stage.ITEMS_SELECTED
    assert workflow.requires_logistics is True
    
    # Stage 3: Logistics
    workflow = NoteCheckoutService.process_logistics(
        workflow_id=workflow.id,
        warehouse_id=setup['warehouse'].id,
        date=timezone.now().date(),
        notes="Recibido OK"
    )
    assert workflow.current_stage == NoteWorkflow.Stage.LOGISTICS_COMPLETED
    
    # Stage 4: Register document
    workflow = NoteCheckoutService.register_document(
        workflow_id=workflow.id,
        document_number='NC-E2E-001',
        is_pending=False
    )
    assert workflow.current_stage == NoteWorkflow.Stage.REGISTRATION_PENDING
    assert workflow.invoice.status == Invoice.Status.POSTED
    
    # Stage 5: Complete
    workflow = NoteCheckoutService.complete_workflow(
        workflow_id=workflow.id,
        payment_data={'method': 'CREDIT', 'apply_credit': True}
    )
    assert workflow.current_stage == NoteWorkflow.Stage.COMPLETED
    
    # Verify everything is consistent
    workflow.refresh_from_db()
    assert workflow.invoice.status == Invoice.Status.POSTED
    assert workflow.invoice.journal_entry.status == JournalEntry.State.POSTED
    assert StockMove.objects.filter(product=setup['products']['stockable']).exists()


@pytest.mark.django_db
def test_cancel_workflow(posted_sale_invoice):
    """Test workflow cancellation"""
    setup = posted_sale_invoice
    
    workflow = NoteCheckoutService.init_note_workflow(
        corrected_invoice_id=setup['invoice'].id,
        note_type=Invoice.DTEType.NOTA_CREDITO,
        reason="Test"
    )
    
    original_invoice_id = workflow.invoice.id
    
    # Cancel workflow
    workflow = NoteCheckoutService.cancel_workflow(
        workflow_id=workflow.id,
        reason="Cliente retiró solicitud"
    )
    
    assert workflow.current_stage == NoteWorkflow.Stage.CANCELLED
    assert "CANCELADO" in workflow.notes
    
    # Draft invoice should be deleted
    assert not Invoice.objects.filter(id=original_invoice_id).exists()
