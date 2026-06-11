"""
test_cancel_annul_integration.py

Integration tests for the Cancel/Annul/Delete refactor (ADR-0047).

Covers 16 parametrized scenarios across Sales, Purchasing, Billing and Treasury.
Each service is called directly so the tests do NOT depend on HTTP or auth.
"""
import pytest
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

from sales.models import SaleOrder, SaleDelivery
from sales.services import SalesService, SaleOrderService
from purchasing.models import PurchaseOrder, PurchaseReceipt
from purchasing.services import PurchasingService, PurchaseOrderService
from billing.models import Invoice
from billing.services import BillingService
from treasury.models import TreasuryMovement, TreasuryAccount
from treasury.services import TreasuryService
from accounting.models import Account, AccountType, JournalEntry, JournalItem
from contacts.models import Contact
from inventory.models import Warehouse
from production.models import WorkOrder
from workflow.models import Transition

User = get_user_model()


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def env(db):
    user = User.objects.create_user(username='inttest', password='x')
    customer = Contact.objects.create(name='Cliente Integración', tax_id='33333333-3')
    supplier = Contact.objects.create(name='Proveedor Integración', tax_id='44444444-4')
    asset_acc = Account.objects.create(
        name='Caja', code='1.1.01.001', account_type=AccountType.ASSET,
    )
    ta = TreasuryAccount.objects.create(
        name='Caja', account=asset_acc, account_type=TreasuryAccount.Type.CASH,
    )
    warehouse = Warehouse.objects.create(name='Bodega Test', code='BTST')
    return {
        'user': user,
        'customer': customer,
        'supplier': supplier,
        'ta': ta,
        'warehouse': warehouse,
    }


# ── Object builders ──────────────────────────────────────────────────────────

def _sale_order(env, **overrides):
    kwargs = dict(
        customer=env['customer'],
        number='INT-SO-001',
        total=Decimal('100000'),
        total_net=Decimal('84034'),
        total_tax=Decimal('15966'),
    )
    kwargs.update(overrides)
    return SaleOrder.objects.create(**kwargs)


def _purchase_order(env, **overrides):
    kwargs = dict(
        supplier=env['supplier'],
        number='INT-PO-001',
        total=Decimal('100000'),
        total_net=Decimal('84034'),
        total_tax=Decimal('15966'),
    )
    kwargs.update(overrides)
    return PurchaseOrder.objects.create(**kwargs)


def _invoice(env, **overrides):
    kwargs = dict(
        dte_type=Invoice.DTEType.FACTURA,
        contact=env['customer'],
        total=Decimal('50000'),
        total_net=Decimal('42017'),
        total_tax=Decimal('7983'),
    )
    kwargs.update(overrides)
    return Invoice.objects.create(**kwargs)


def _movement(env, **overrides):
    kwargs = dict(
        movement_type=TreasuryMovement.Type.INBOUND,
        to_account=env['ta'],
        amount=Decimal('50000'),
        created_by=env['user'],
    )
    kwargs.update(overrides)
    return TreasuryMovement.objects.create(**kwargs)


def _delivery(env, order, **overrides):
    kwargs = dict(
        sale_order=order,
        warehouse=env['warehouse'],
        delivery_date='2026-06-01',
    )
    kwargs.update(overrides)
    return SaleDelivery.objects.create(**kwargs)


def _posted_je(env, suffix='001'):
    """Posted JE with one balanced debit/credit pair (reverse_entry requires items)."""
    income_acc, _created = Account.objects.get_or_create(
        code='4.1.01.001', defaults=dict(name='Ventas Test', account_type=AccountType.INCOME),
    )
    asset_acc = Account.objects.get(code='1.1.01.001')
    je = JournalEntry.objects.create(
        description=f'JE integración {suffix}', status=JournalEntry.State.POSTED,
    )
    JournalItem.objects.create(entry=je, account=asset_acc, debit=Decimal('100'), credit=0)
    JournalItem.objects.create(entry=je, account=income_acc, debit=0, credit=Decimal('100'))
    return je


def _receipt(env, order, **overrides):
    kwargs = dict(
        purchase_order=order,
        warehouse=env['warehouse'],
        receipt_date='2026-06-01',
    )
    kwargs.update(overrides)
    return PurchaseReceipt.objects.create(**kwargs)


# ── Tests ────────────────────────────────────────────────────────────────────

class TestCancelSaleOrderIntegration:
    """Scenarios for SalesService.cancel_sale_order."""

    @pytest.mark.django_db
    def test_001_draft_cancel_no_children(self, env):
        """DRAFT sale order with no children → CANCELLED."""
        order = _sale_order(env)
        result = SalesService.cancel_sale_order(order)
        result.refresh_from_db()
        assert result.status == SaleOrder.Status.CANCELLED

    @pytest.mark.django_db
    def test_002_draft_cancel_with_draft_invoice(self, env):
        """DRAFT sale order + DRAFT invoice → both CANCELLED."""
        order = _sale_order(env)
        inv = _invoice(env, sale_order=order)
        result = SalesService.cancel_sale_order(order)
        result.refresh_from_db()
        inv.refresh_from_db()
        assert result.status == SaleOrder.Status.CANCELLED
        assert inv.status == Invoice.Status.CANCELLED

    @pytest.mark.django_db
    def test_003_draft_cancel_with_draft_movement(self, env):
        """DRAFT sale order + DRAFT payment → both CANCELLED."""
        order = _sale_order(env)
        mov = _movement(env, sale_order=order)
        result = SalesService.cancel_sale_order(order)
        result.refresh_from_db()
        mov.refresh_from_db()
        assert result.status == SaleOrder.Status.CANCELLED
        assert mov.status == TreasuryMovement.MovementStatus.CANCELLED

    @pytest.mark.django_db
    def test_004_draft_cancel_with_draft_delivery(self, env):
        """DRAFT sale order + DRAFT delivery → delivery marked CANCELLED."""
        order = _sale_order(env)
        delivery = _delivery(env, order)
        result = SalesService.cancel_sale_order(order)
        result.refresh_from_db()
        delivery.refresh_from_db()
        assert result.status == SaleOrder.Status.CANCELLED
        assert delivery.status == SaleDelivery.Status.CANCELLED

    @pytest.mark.django_db
    def test_005_draft_block_confirmed_delivery(self, env):
        """DRAFT sale order + CONFIRMED delivery → ValidationError."""
        order = _sale_order(env)
        _delivery(env, order, status=SaleDelivery.Status.CONFIRMED)
        with pytest.raises(ValidationError, match='despachos confirmados'):
            SalesService.cancel_sale_order(order)

    @pytest.mark.django_db
    def test_006_draft_block_posted_payment(self, env):
        """DRAFT sale order + POSTED payment → ValidationError."""
        order = _sale_order(env)
        _movement(env, sale_order=order, status=TreasuryMovement.MovementStatus.POSTED)
        with pytest.raises(ValidationError, match='pagos contabilizados'):
            SalesService.cancel_sale_order(order)

    @pytest.mark.django_db
    def test_007_cancelled_idempotent(self, env):
        """Already CANCELLED order → no-op, returns same object."""
        order = _sale_order(env, status=SaleOrder.Status.CANCELLED)
        result = SalesService.cancel_sale_order(order)
        assert result == order
        assert result.status == SaleOrder.Status.CANCELLED

    @pytest.mark.django_db
    def test_008_annul_via_service_cancel(self, env):
        """CONFIRMED order → SaleOrderService.cancel() runs full annul path."""
        order = _sale_order(env, status=SaleOrder.Status.CONFIRMED)
        svc = SaleOrderService()
        result = svc.cancel(order, user=env['user'], reason='test integración')
        assert result.status == SaleOrder.Status.CANCELLED


class TestCancelPurchaseOrderIntegration:
    """Scenarios for PurchasingService.cancel_purchase_order."""

    @pytest.mark.django_db
    def test_009_draft_cancel_no_children(self, env):
        """DRAFT purchase order with no children → CANCELLED."""
        order = _purchase_order(env)
        result = PurchasingService.cancel_purchase_order(order)
        result.refresh_from_db()
        assert result.status == PurchaseOrder.Status.CANCELLED

    @pytest.mark.django_db
    def test_010_draft_cancel_with_draft_invoice(self, env):
        """DRAFT purchase order + DRAFT bill → both CANCELLED."""
        order = _purchase_order(env)
        inv = _invoice(env, purchase_order=order)
        result = PurchasingService.cancel_purchase_order(order)
        result.refresh_from_db()
        inv.refresh_from_db()
        assert result.status == PurchaseOrder.Status.CANCELLED
        assert inv.status == Invoice.Status.CANCELLED

    @pytest.mark.django_db
    def test_011_draft_cancel_with_draft_receipt(self, env):
        """DRAFT purchase order + DRAFT receipt → both CANCELLED."""
        order = _purchase_order(env)
        receipt = _receipt(env, order)
        result = PurchasingService.cancel_purchase_order(order)
        result.refresh_from_db()
        receipt.refresh_from_db()
        assert result.status == PurchaseOrder.Status.CANCELLED
        assert receipt.status == PurchaseReceipt.Status.CANCELLED

    @pytest.mark.django_db
    def test_012_draft_block_confirmed_receipt(self, env):
        """DRAFT purchase order + CONFIRMED receipt → ValidationError."""
        order = _purchase_order(env)
        _receipt(env, order, status=PurchaseReceipt.Status.CONFIRMED)
        with pytest.raises(ValidationError, match='recepciones confirmadas'):
            PurchasingService.cancel_purchase_order(order)

    @pytest.mark.django_db
    def test_013_draft_block_posted_payment(self, env):
        """DRAFT purchase order + POSTED payment → ValidationError."""
        order = _purchase_order(env)
        _movement(env, purchase_order=order, status=TreasuryMovement.MovementStatus.POSTED)
        with pytest.raises(ValidationError, match='pagos contabilizados'):
            PurchasingService.cancel_purchase_order(order)

    @pytest.mark.django_db
    def test_014_purchase_cancelled_idempotent(self, env):
        """Already CANCELLED purchase order → no-op."""
        order = _purchase_order(env, status=PurchaseOrder.Status.CANCELLED)
        result = PurchasingService.cancel_purchase_order(order)
        assert result == order
        assert result.status == PurchaseOrder.Status.CANCELLED

    @pytest.mark.django_db
    def test_015_purchase_draft_cancel_with_payment(self, env):
        """DRAFT purchase order + DRAFT payment → both CANCELLED."""
        order = _purchase_order(env)
        mov = _movement(env, purchase_order=order)
        result = PurchasingService.cancel_purchase_order(order)
        result.refresh_from_db()
        mov.refresh_from_db()
        assert result.status == PurchaseOrder.Status.CANCELLED
        assert mov.status == TreasuryMovement.MovementStatus.CANCELLED


class TestDirectCancelInvoiceIntegration:
    """Direct cancel of DRAFT invoices (not through order)."""

    @pytest.mark.django_db
    def test_016_direct_draft_invoice_cancel(self, env):
        """Standalone DRAFT invoice → CANCELLED."""
        inv = _invoice(env)
        result = BillingService.cancel_invoice(inv)
        result.refresh_from_db()
        assert result.status == Invoice.Status.CANCELLED

    @pytest.mark.django_db
    def test_017_direct_posted_invoice_cancel_blocked(self, env):
        """POSTED standalone invoice → ValidationError."""
        inv = _invoice(env, status=Invoice.Status.POSTED)
        with pytest.raises(ValidationError, match='Borrador'):
            BillingService.cancel_invoice(inv)


class TestDirectCancelTreasuryMovementIntegration:
    """Direct cancel of DRAFT treasury movements."""

    @pytest.mark.django_db
    def test_018_direct_draft_movement_cancel(self, env):
        """Standalone DRAFT movement → CANCELLED."""
        mov = _movement(env)
        result = TreasuryService.cancel_movement(mov)
        result.refresh_from_db()
        assert result.status == TreasuryMovement.MovementStatus.CANCELLED

    @pytest.mark.django_db
    def test_019_reconciled_movement_blocked(self, env):
        """Standalone reconciled movement → ValidationError."""
        mov = _movement(env, is_reconciled=True)
        with pytest.raises(ValidationError, match='conciliado'):
            TreasuryService.cancel_movement(mov)


class TestMixedChildrenAnnulIntegration:
    """Annul path with mixed child statuses."""

    @pytest.mark.django_db
    def test_020_sale_mixed_children(self, env):
        """CONFIRMED sale order with DRAFT invoice + CONFIRMED delivery."""
        order = _sale_order(env)
        inv = _invoice(env, sale_order=order)  # DRAFT
        delivery = _delivery(env, order, status=SaleDelivery.Status.CONFIRMED)
        svc = SaleOrderService()
        # The DRAFT invoice should be cancelled (not annulled), the CONFIRMED delivery annulled
        result = svc.cancel(order, user=env['user'], reason='test integración')
        result.refresh_from_db()
        inv.refresh_from_db()
        delivery.refresh_from_db()
        assert result.status == SaleOrder.Status.CANCELLED
        assert inv.status == Invoice.Status.CANCELLED
        assert delivery.status == SaleDelivery.Status.CANCELLED

    @pytest.mark.django_db
    def test_021_purchase_mixed_children(self, env):
        """CONFIRMED purchase order with DRAFT invoice + CONFIRMED receipt."""
        order = _purchase_order(env)
        inv = _invoice(env, purchase_order=order)  # DRAFT
        receipt = _receipt(env, order, status=PurchaseReceipt.Status.CONFIRMED)
        svc = PurchaseOrderService()
        result = svc.cancel(order, user=env['user'], reason='test integración')
        result.refresh_from_db()
        inv.refresh_from_db()
        receipt.refresh_from_db()
        assert result.status == PurchaseOrder.Status.CANCELLED
        assert inv.status == Invoice.Status.CANCELLED
        assert receipt.status == PurchaseReceipt.Status.CANCELLED


class TestPRACancelIntegrity:
    """PR A acceptance criteria: OT cascade, purchase folio annul, purge guard."""

    @pytest.mark.django_db
    def test_022_draft_cancel_cascades_work_order(self, env):
        """DRAFT sale order + early-stage OT → OT CANCELLED in cascade."""
        order = _sale_order(env)
        wo = WorkOrder.objects.create(
            number='INT-OT-001', description='OT integración', sale_order=order,
        )
        result = SalesService.cancel_sale_order(order)
        result.refresh_from_db()
        wo.refresh_from_db()
        assert result.status == SaleOrder.Status.CANCELLED
        assert wo.status == WorkOrder.Status.CANCELLED

    @pytest.mark.django_db
    def test_023_cancel_blocked_by_advanced_work_order(self, env):
        """DRAFT sale order + OT beyond limit stage → ValidationError blocks all."""
        order = _sale_order(env)
        WorkOrder.objects.create(
            number='INT-OT-002', description='OT avanzada', sale_order=order,
            current_stage=WorkOrder.Stage.PRESS,
        )
        with pytest.raises(ValidationError, match='etapa límite'):
            SalesService.cancel_sale_order(order)
        order.refresh_from_db()
        assert order.status == SaleOrder.Status.DRAFT

    @pytest.mark.django_db
    def test_024_annul_purchase_invoice_with_supplier_folio(self, env):
        """POSTED purchase bill with supplier folio → annul allowed (folio is theirs)."""
        order = _purchase_order(env, status=PurchaseOrder.Status.CONFIRMED)
        inv = _invoice(
            env, purchase_order=order, contact=env['supplier'],
            number='F-7788', status=Invoice.Status.POSTED,
        )
        result = BillingService.annul_invoice(inv, reason='test integración')
        result.refresh_from_db()
        assert result.status == Invoice.Status.CANCELLED

    @pytest.mark.django_db
    def test_025_annul_sale_invoice_with_folio_blocked(self, env):
        """POSTED sale invoice with own folio → blocked, requires credit note."""
        order = _sale_order(env, status=SaleOrder.Status.CONFIRMED)
        inv = _invoice(env, sale_order=order, number='1234', status=Invoice.Status.POSTED)
        with pytest.raises(ValidationError, match='Nota de Crédito'):
            BillingService.annul_invoice(inv, reason='test integración')

    @pytest.mark.django_db
    def test_026_purge_blocked_for_annulled_movement(self, env):
        """CANCELLED movement with accounting trace (ex-POSTED) → purge denied."""
        je = JournalEntry.objects.create(description='JE reverso', status=JournalEntry.State.POSTED)
        mov = _movement(
            env, status=TreasuryMovement.MovementStatus.CANCELLED, journal_entry=je,
        )
        with pytest.raises(ValidationError, match='pista de auditoría'):
            TreasuryService.validate_purge(mov)

    @pytest.mark.django_db
    def test_027_purge_allowed_for_clean_cancelled_movement(self, env):
        """CANCELLED movement without accounting trace → purge allowed."""
        mov = _movement(env, status=TreasuryMovement.MovementStatus.CANCELLED)
        TreasuryService.validate_purge(mov)  # must not raise

    @pytest.mark.django_db
    def test_028_purge_blocked_for_active_order(self, env):
        """Non-CANCELLED order → purge denied, redirect to /cancel/."""
        order = _sale_order(env)
        with pytest.raises(ValidationError, match='cancel'):
            SalesService.validate_purge(order)

    @pytest.mark.django_db
    def test_029_purge_blocked_for_order_with_accounting_trace(self, env):
        """CANCELLED order whose invoice kept a JE (annulled) → purge denied."""
        je = JournalEntry.objects.create(description='JE factura', status=JournalEntry.State.POSTED)
        order = _sale_order(env, status=SaleOrder.Status.CANCELLED)
        _invoice(env, sale_order=order, status=Invoice.Status.CANCELLED, journal_entry=je)
        with pytest.raises(ValidationError, match='pista de auditoría'):
            SalesService.validate_purge(order)


class TestPRBAuditAndSemantics:
    """PR B: workflow.Transition audit trail, treasury cancel/annul split, period guard."""

    @pytest.mark.django_db
    def test_030_cancel_logs_transition_with_user_and_reason(self, env):
        """Cancel logs a Transition for the order AND its cascaded children."""
        order = _sale_order(env)
        inv = _invoice(env, sale_order=order)
        SalesService.cancel_sale_order(order, user=env['user'], reason='orden duplicada')

        t = Transition.objects.get(entity_type='sales.saleorder', entity_id=order.id)
        assert t.transition == 'cancel'
        assert t.user == env['user']
        assert t.reason == 'orden duplicada'

        ti = Transition.objects.get(entity_type='billing.invoice', entity_id=inv.id)
        assert ti.transition == 'cancel'
        assert ti.reason == 'orden duplicada'

    @pytest.mark.django_db
    def test_031_cancel_movement_blocked_when_je_posted(self, env):
        """cancel on a movement whose JE is POSTED → redirect to annul."""
        je = _posted_je(env)
        mov = _movement(env, journal_entry=je)
        with pytest.raises(ValidationError, match='Anular'):
            TreasuryService.cancel_movement(mov)

    @pytest.mark.django_db
    def test_032_annul_movement_reverses_posted_je(self, env):
        """annul reverses the POSTED JE (linked via reversal_of) and logs 'annul'."""
        je = _posted_je(env)
        mov = _movement(
            env, journal_entry=je, status=TreasuryMovement.MovementStatus.POSTED,
        )
        result = TreasuryService.annul_movement(mov, user=env['user'], reason='monto errado')
        result.refresh_from_db()
        assert result.status == TreasuryMovement.MovementStatus.CANCELLED
        assert JournalEntry.objects.filter(reversal_of=je).exists()

        t = Transition.objects.get(entity_type='treasury.treasurymovement', entity_id=mov.id)
        assert t.transition == 'annul'
        assert t.reason == 'monto errado'

    @pytest.mark.django_db
    def test_033_annul_blocked_when_period_closed(self, env, monkeypatch):
        """Reversal date in a closed tax period → annul blocked."""
        from tax.services import TaxPeriodService
        monkeypatch.setattr(TaxPeriodService, 'is_period_closed', staticmethod(lambda d: True))
        je = _posted_je(env, suffix='033')
        mov = _movement(
            env, journal_entry=je, status=TreasuryMovement.MovementStatus.POSTED,
        )
        with pytest.raises(ValidationError, match='cerrado'):
            TreasuryService.annul_movement(mov, reason='test integración')

    @pytest.mark.django_db
    def test_034_annul_order_logs_annul_transition(self, env):
        """Full annul of a CONFIRMED order logs transition='annul' with reason."""
        order = _sale_order(env, status=SaleOrder.Status.CONFIRMED)
        svc = SaleOrderService()
        svc.cancel(order, user=env['user'], reason='cliente desistió')
        t = Transition.objects.get(entity_type='sales.saleorder', entity_id=order.id)
        assert t.transition == 'annul'
        assert t.reason == 'cliente desistió'

    @pytest.mark.django_db
    def test_035_annul_without_reason_blocked(self, env):
        """PR C: annul paths demand an explicit reason (cancel does not)."""
        order = _sale_order(env, status=SaleOrder.Status.CONFIRMED)
        svc = SaleOrderService()
        with pytest.raises(ValidationError, match='motivo'):
            svc.cancel(order, user=env['user'])

        je = _posted_je(env, suffix='035')
        mov = _movement(
            env, journal_entry=je, status=TreasuryMovement.MovementStatus.POSTED,
        )
        with pytest.raises(ValidationError, match='motivo'):
            TreasuryService.annul_movement(mov)

        inv = _invoice(env, purchase_order=_purchase_order(env, status=PurchaseOrder.Status.CONFIRMED),
                       contact=env['supplier'], number='F-035', status=Invoice.Status.POSTED)
        with pytest.raises(ValidationError, match='motivo'):
            BillingService.annul_invoice(inv)
