import pytest
from decimal import Decimal
from django.core.exceptions import ValidationError
from sales.models import SaleOrder, SaleLine
from sales.services import SalesService
from inventory.models import Product, Warehouse, UoM
from billing.models import Invoice
from accounting.models import AccountingSettings, Account
from django.utils import timezone
from contacts.models import Contact

@pytest.fixture
def basic_setup(db):
    # Setup Accounting
    acc_receivable = Account.objects.create(code='1.1.01', name='Receivable', account_type='ASSET')
    acc_revenue = Account.objects.create(code='4.1.01', name='Revenue', account_type='REVENUE')
    acc_tax = Account.objects.create(code='2.1.01', name='Tax', account_type='LIABILITY')
    
    settings = AccountingSettings.objects.create(
        default_receivable_account=acc_receivable,
        default_revenue_account=acc_revenue,
        default_tax_payable_account=acc_tax
    )
    
    # Setup UoM
    uom = UoM.objects.create(name='Unit', code='UNT')
    
    # Setup Customer
    customer = Contact.objects.create(name='Test Customer', is_customer=True)
    
    # Setup Warehouse
    warehouse = Warehouse.objects.create(name='Main Warehouse')
    
    return {
        'settings': settings,
        'uom': uom,
        'customer': customer,
        'warehouse': warehouse
    }

@pytest.mark.django_db
def test_create_note_validate_quantity_delivered(basic_setup):
    uom = basic_setup['uom']
    
    product = Product.objects.create(
        name='Storable Product',
        internal_code='ST01',
        product_type=Product.Type.STORABLE,
        uom=uom,
        track_inventory=True
    )
    
    order = SaleOrder.objects.create(
        customer=basic_setup['customer'],
        number='NV-001'
    )
    
    line = SaleLine.objects.create(
        order=order,
        product=product,
        quantity=10,
        unit_price=1000,
        uom=uom,
        quantity_delivered=5 # Delivered 5
    )
    
    # Try to return 6 (should fail)
    with pytest.raises(ValidationError, match="excede la cantidad entregada físicamente"):
        SalesService.create_note(
            order=order,
            note_type=Invoice.DTEType.NOTA_CREDITO,
            amount_net=Decimal('6000'),
            amount_tax=Decimal('1140'),
            document_number='NC-TEST',
            return_items=[{'product_id': product.id, 'quantity': 6}]
        )

@pytest.mark.django_db
def test_create_note_block_service_return(basic_setup):
    uom = basic_setup['uom']
    
    service = Product.objects.create(
        name='Service',
        internal_code='SV01',
        product_type=Product.Type.SERVICE,
        uom=uom,
        track_inventory=False
    )
    
    order = SaleOrder.objects.create(
        customer=basic_setup['customer']
    )
    
    # Try to return service (should fail)
    with pytest.raises(ValidationError, match="No se pueden registrar devoluciones físicas para servicios"):
        SalesService.create_note(
            order=order,
            note_type=Invoice.DTEType.NOTA_CREDITO,
            amount_net=Decimal('1000'),
            amount_tax=Decimal('190'),
            document_number='NC-TEST',
            return_items=[{'product_id': service.id, 'quantity': 1}]
        )

@pytest.mark.django_db
def test_block_debit_note_for_non_storable_manufacturable(basic_setup):
    uom = basic_setup['uom']
    
    mfg_product = Product.objects.create(
        name='Mfg Product',
        internal_code='MFG01',
        product_type=Product.Type.MANUFACTURABLE,
        uom=uom,
        track_inventory=False # Non storable
    )
    
    order = SaleOrder.objects.create(
        customer=basic_setup['customer']
    )
    
    # Try to create ND for non-storable mfg (should fail)
    with pytest.raises(ValidationError, match="No se permite crear Nota de Débito para el producto fabricado"):
        SalesService.create_note(
            order=order,
            note_type=Invoice.DTEType.NOTA_DEBITO,
            amount_net=Decimal('1000'),
            amount_tax=Decimal('190'),
            document_number='ND-TEST',
            return_items=[{'product_id': mfg_product.id, 'quantity': 1}]
        )
