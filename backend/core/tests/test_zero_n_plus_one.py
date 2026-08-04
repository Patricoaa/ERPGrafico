"""
N+1 Query Regression Tests — Runtime assertNumQueries.

Replaces the old static grep-based test with actual DB query counting.
Each test creates N objects with relationships and asserts that the list
endpoint executes a bounded (O(1)) number of queries regardless of N.

LIMITS: Set to current baseline + ~10% headroom. Phases 1-5 will TIGHTEN them.
To run:
    pytest core/tests/test_zero_n_plus_one.py -v
"""

import pytest
from datetime import date
from decimal import Decimal


N = 5


# ===================================================================
#  INVENTORY
# ===================================================================

@pytest.mark.django_db
class TestInventoryNPlusOne:

    def test_product_list(self, api_client, django_assert_max_num_queries):
        from inventory.models import Product, ProductCategory, UoM, UoMCategory
        uom_cat = UoMCategory.objects.create(name="Unidades")
        uom = UoM.objects.create(name="Und", category=uom_cat, ratio=Decimal("1"))
        cat = ProductCategory.objects.create(name="Cat", prefix="C")
        for i in range(N):
            Product.objects.create(
                name=f"Prod {i}", code=f"P-{i:03d}",
                category=cat, product_type="STORABLE",
                uom=uom, sale_uom=uom, purchase_uom=uom,
            )
        with django_assert_max_num_queries(35):
            resp = api_client.get("/api/inventory/products/")
        assert resp.status_code == 200

    def test_stock_move_list(self, api_client, product, warehouse, internal_location, django_assert_max_num_queries):
        from inventory.models import StockMove
        for i in range(N):
            StockMove.objects.create(
                product=product, uom=product.uom,
                source_location=internal_location,
                destination_location=internal_location,
                quantity=Decimal("10"),
            )
        with django_assert_max_num_queries(5):
            resp = api_client.get("/api/inventory/moves/")
        assert resp.status_code == 200

    def test_pricing_rule_list(self, api_client, product, product_category, uom, django_assert_max_num_queries):
        from inventory.models import PricingRule
        for i in range(N):
            PricingRule.objects.create(
                name=f"Rule {i}", rule_type="FIXED",
                product=product, category=product_category, uom=uom,
                min_quantity=Decimal("1"), max_quantity=Decimal("100"),
                fixed_price=Decimal("1000"),
            )
        with django_assert_max_num_queries(5):
            resp = api_client.get("/api/inventory/pricing-rules/")
        assert resp.status_code == 200

    def test_subscription_list(self, api_client, product, supplier_contact, django_assert_max_num_queries):
        from inventory.models import Subscription
        for i in range(N):
            Subscription.objects.create(
                product=product, supplier=supplier_contact,
                status="ACTIVE", recurrence_period="MONTHLY",
                start_date=date.today(), amount=Decimal("10000"),
            )
        with django_assert_max_num_queries(5):
            resp = api_client.get("/api/inventory/subscriptions/")
        assert resp.status_code == 200

    def test_inventory_count_list(self, api_client, warehouse, django_assert_max_num_queries):
        from inventory.models import InventoryCount
        for i in range(N):
            InventoryCount.objects.create(
                warehouse=warehouse, status="DRAFT",
            )
        with django_assert_max_num_queries(10):
            resp = api_client.get("/api/inventory/counts/")
        assert resp.status_code == 200


# ===================================================================
#  SALES
# ===================================================================

@pytest.mark.django_db
class TestSalesNPlusOne:

    def test_sale_order_list(self, api_client, sale_order_with_lines, django_assert_max_num_queries):
        from sales.models import SaleOrder, SaleLine
        from inventory.models import Product, UoM, UoMCategory, ProductCategory
        from contacts.models import Contact

        uom_cat = UoMCategory.objects.create(name="U")
        uom = UoM.objects.create(name="Ud", category=uom_cat, ratio=Decimal("1"))
        cat = ProductCategory.objects.create(name="C", prefix="C")
        prod = Product.objects.create(
            name="P", code="P-999", category=cat,
            product_type="CONSUMABLE", uom=uom, sale_uom=uom, purchase_uom=uom,
        )
        for i in range(N - 1):
            c = Contact.objects.create(name=f"Cliente {i}", tax_id=f"76.{i:06d}-K")
            so = SaleOrder.objects.create(status="CONFIRMED", customer=c)
            SaleLine.objects.create(
                order=so, product=prod, description="L",
                quantity=Decimal("1"), unit_price=Decimal("1000"), uom=uom,
            )
        with django_assert_max_num_queries(25):
            resp = api_client.get("/api/sales/orders/")
        assert resp.status_code == 200

    def test_sale_delivery_list(
        self, api_client, sale_order, warehouse, product, uom,
        django_assert_max_num_queries,
    ):
        from sales.models import SaleDelivery
        for i in range(N):
            SaleDelivery.objects.create(
                sale_order=sale_order, warehouse=warehouse,
                delivery_date=date.today(), status="CONFIRMED",
            )
        with django_assert_max_num_queries(5):
            resp = api_client.get("/api/sales/deliveries/")
        assert resp.status_code == 200

    def test_sale_return_list(
        self, api_client, sale_order, warehouse, django_assert_max_num_queries,
    ):
        from sales.models import SaleReturn
        for i in range(N):
            SaleReturn.objects.create(
                sale_order=sale_order, warehouse=warehouse,
                date=date.today(), status="DRAFT",
            )
        with django_assert_max_num_queries(5):
            resp = api_client.get("/api/sales/returns/")
        assert resp.status_code == 200


# ===================================================================
#  BILLING
# ===================================================================

@pytest.mark.django_db
class TestBillingNPlusOne:

    def test_invoice_list(self, api_client, django_assert_max_num_queries):
        from billing.models import Invoice
        from sales.models import SaleOrder
        from contacts.models import Contact

        for i in range(N):
            c = Contact.objects.create(name=f"Contact {i}", tax_id=f"87.{i:06d}-K")
            so = SaleOrder.objects.create(status="CONFIRMED", customer=c)
            Invoice.objects.create(
                dte_type="FACTURA", status="POSTED", contact=c, sale_order=so,
            )
        with django_assert_max_num_queries(5):
            resp = api_client.get("/api/billing/invoices/")
        assert resp.status_code == 200


# ===================================================================
#  TREASURY
# ===================================================================

@pytest.mark.django_db
class TestTreasuryNPlusOne:

    def test_treasury_movement_list(
        self, api_client, treasury_account, account_asset, contact, sale_order,
        django_assert_max_num_queries,
    ):
        from treasury.models import TreasuryMovement
        for i in range(N):
            TreasuryMovement.objects.create(
                movement_type="INBOUND", amount=Decimal("10000"),
                to_account=treasury_account, account=account_asset,
                contact=contact, sale_order=sale_order,
            )
        with django_assert_max_num_queries(5):
            resp = api_client.get("/api/treasury/movements/")
        assert resp.status_code == 200

    def test_bank_list(self, api_client, django_assert_max_num_queries):
        from treasury.models import Bank
        from contacts.models import Contact

        for i in range(N):
            b = Bank.objects.create(name=f"Banco {i}", code=f"B{i}")
            execs = [
                Contact.objects.create(name=f"Ejec {i}-{j}", tax_id=f"77.{i}{j:04d}-K")
                for j in range(2)
            ]
            b.account_executives.set(execs)
        with django_assert_max_num_queries(5):
            resp = api_client.get("/api/treasury/banks/")
        assert resp.status_code == 200

    def test_treasury_account_list(self, api_client, django_assert_max_num_queries):
        from treasury.models import TreasuryAccount
        from accounting.models import Account, AccountType

        for i in range(N):
            acc = Account.objects.create(
                code=f"1.1.01.{100 + i:03d}", name=f"Caja {i}", account_type=AccountType.ASSET,
            )
            TreasuryAccount.objects.create(
                name=f"Cta {i}", account_type="CASH", account=acc,
            )
        with django_assert_max_num_queries(40):
            resp = api_client.get("/api/treasury/accounts/")
        assert resp.status_code == 200

    def test_terminal_batch_list(self, api_client, treasury_account, django_assert_max_num_queries):
        from treasury.models import (
            TerminalBatch, PaymentMethod, PaymentTerminalDevice, PaymentTerminalProvider,
        )
        from contacts.models import Contact
        from accounting.models import Account, AccountType
        from inventory.models import Product, ProductCategory, UoM, UoMCategory

        supplier = Contact.objects.create(name="Transbank", tax_id="76.000.000-0")
        recv_acc = Account.objects.create(code="1.1.02.001", name="Cobro Terminal", account_type=AccountType.ASSET)
        comm_acc = Account.objects.create(code="5.1.02.001", name="Comisión Terminal", account_type=AccountType.EXPENSE)
        iva_acc = Account.objects.create(code="1.1.03.001", name="IVA Comisión", account_type=AccountType.ASSET)
        provider = PaymentTerminalProvider.objects.create(
            name="Transbank", supplier=supplier,
            receivable_account=recv_acc, commission_expense_account=comm_acc,
            commission_iva_account=iva_acc,
        )
        device = PaymentTerminalDevice.objects.create(
            name="Terminal 1", serial_number="SN-001", provider=provider,
        )
        pm = PaymentMethod.objects.create(
            name="TC", method_type="CARD_TERMINAL",
            treasury_account=treasury_account,
            linked_terminal_device=device,
        )
        for i in range(N):
            TerminalBatch.objects.create(
                payment_method=pm,
                sales_date=date.today(), settlement_date=date.today(),
                gross_amount=Decimal("50000"), commission_base=Decimal("50000"),
                commission_tax=Decimal("5000"), commission_total=Decimal("5000"),
                net_amount=Decimal("45000"), status="PENDING",
            )
        with django_assert_max_num_queries(5):
            resp = api_client.get("/api/treasury/terminal-batches/")
        assert resp.status_code == 200

    def test_bank_loan_list(self, api_client, django_assert_max_num_queries):
        from treasury.models import Bank, TreasuryAccount, BankLoan
        from accounting.models import Account, AccountType

        bank_obj = Bank.objects.create(name="Banco", code="B")
        cta = TreasuryAccount.objects.create(
            name="Disbursement", account_type="CHECKING",
            bank=bank_obj, account_number="123",
        )
        liab_acc = Account.objects.create(
            code="2.1.01.001", name="Loan Acc", account_type=AccountType.LIABILITY,
        )
        liab_cta = TreasuryAccount.objects.create(
            name="Loan Cta", account_type="LOAN", account=liab_acc,
        )
        for i in range(N):
            BankLoan.objects.create(
                lender=bank_obj, principal=Decimal("1000000"),
                interest_rate=Decimal("0.01"),
                term_months=12, start_date=date.today(),
                first_due_date=date(2026, 8, 15),
                disbursement_account=cta, liability_account=liab_cta,
                status="ACTIVE",
            )
        with django_assert_max_num_queries(5):
            resp = api_client.get("/api/treasury/loans/")
        assert resp.status_code == 200


# ===================================================================
#  PRODUCTION
# ===================================================================

@pytest.mark.django_db
class TestProductionNPlusOne:

    def test_work_order_list(
        self, api_client, sale_order, product, warehouse,
        django_assert_max_num_queries,
    ):
        from production.models import WorkOrder
        for i in range(N):
            WorkOrder.objects.create(
                description=f"OT {i}", status="DRAFT",
                sale_order=sale_order, product=product, warehouse=warehouse,
            )
        with django_assert_max_num_queries(10):
            resp = api_client.get("/api/production/orders/")
        assert resp.status_code == 200


# ===================================================================
#  PURCHASING
# ===================================================================

@pytest.mark.django_db
class TestPurchasingNPlusOne:

    def test_purchase_order_list(
        self, api_client, supplier_contact, django_assert_max_num_queries,
    ):
        from purchasing.models import PurchaseOrder
        for i in range(N):
            PurchaseOrder.objects.create(
                status="CONFIRMED", supplier=supplier_contact,
            )
        with django_assert_max_num_queries(10):
            resp = api_client.get("/api/purchasing/orders/")
        assert resp.status_code == 200


# ===================================================================
#  HR
# ===================================================================

@pytest.mark.django_db
class TestHrNPlusOne:

    def test_payroll_list(
        self, api_client, employee, payroll_concept, django_assert_max_num_queries,
    ):
        from hr.models import Payroll, PayrollItem
        for i in range(N):
            p = Payroll.objects.create(
                employee=employee, period_year=2026, period_month=i + 1,
            )
            PayrollItem.objects.create(
                payroll=p, concept=payroll_concept,
                amount=Decimal("500000"),
            )
        with django_assert_max_num_queries(10):
            resp = api_client.get("/api/hr/payrolls/")
        assert resp.status_code == 200

    def test_salary_advance_list(
        self, api_client, employee, django_assert_max_num_queries,
    ):
        from hr.models import SalaryAdvance
        for i in range(N):
            SalaryAdvance.objects.create(
                employee=employee, amount=Decimal("100000"),
                date=date.today(),
            )
        with django_assert_max_num_queries(5):
            resp = api_client.get("/api/hr/advances/")
        assert resp.status_code == 200


# ===================================================================
#  CONTACTS
# ===================================================================

@pytest.mark.django_db
class TestContactsNPlusOne:

    def test_contact_list(self, api_client, django_assert_max_num_queries):
        from contacts.models import Contact
        for i in range(N):
            Contact.objects.create(
                name=f"Contacto {i}", tax_id=f"77.{i:06d}-K",
            )
        with django_assert_max_num_queries(5):
            resp = api_client.get("/api/contacts/")
        assert resp.status_code == 200
