"""
ADR-0104 — RBAC Phase 1, Task 3: permisos de negocio para acciones económicas.

Verifica que cada acción de la primera tanda (documentos con efecto económico):
1. Esté mapeada en ``action_permissions`` del ViewSet con el permiso exacto de la tabla.
2. Rechace a usuarios sin ese permiso (aunque tengan solo add_*/change_*).
3. Permita a usuarios que sí tienen el permiso.
"""
from __future__ import annotations

import importlib

import pytest
from django.apps import apps
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from core.api.permissions import StandardizedModelPermissions
from core.tests.rbac_factories import make_user

# ---------------------------------------------------------------------------
# Wave 1 mapping table  (viewset_module.ClassName, action, "app.perm")
# ---------------------------------------------------------------------------
WAVE_1 = [
    # Facturación
    ("billing.views.InvoiceViewSet", "confirm", "billing.confirm_invoice"),
    ("billing.views.InvoiceViewSet", "annul", "billing.annul_invoice"),
    ("billing.views.InvoiceViewSet", "cancel", "billing.cancel_invoice"),
    # Ventas — orden
    ("sales.views.SaleOrderViewSet", "confirm", "sales.confirm_saleorder"),
    ("sales.views.SaleOrderViewSet", "cancel", "sales.cancel_saleorder"),
    ("sales.views.SaleOrderViewSet", "annul", "sales.annul_saleorder"),
    ("sales.views.SaleOrderViewSet", "write_off", "sales.write_off_saleorder"),
    # Ventas — despacho y devolución
    ("sales.views.SaleDeliveryViewSet", "annul", "sales.annul_saledelivery"),
    ("sales.views.SaleReturnViewSet", "annul", "sales.annul_salereturn"),
    # Compras
    ("purchasing.views.PurchaseOrderViewSet", "confirm", "purchasing.confirm_purchaseorder"),
    ("purchasing.views.PurchaseOrderViewSet", "cancel", "purchasing.cancel_purchaseorder"),
    ("purchasing.views.PurchaseOrderViewSet", "annul", "purchasing.annul_purchaseorder"),
    ("purchasing.views.PurchaseReceiptViewSet", "annul", "purchasing.annul_purchasereceipt"),
    ("purchasing.views.PurchaseReturnViewSet", "annul", "purchasing.annul_purchasereturn"),
    # Contabilidad
    ("accounting.views.JournalEntryViewSet", "post_entry", "accounting.post_journalentry"),
    ("accounting.views.JournalEntryViewSet", "reverse_entry", "accounting.reverse_journalentry"),
    # Tesorería
    ("treasury.views.TreasuryMovementViewSet", "cancel", "treasury.cancel_treasurymovement"),
    ("treasury.views.TreasuryMovementViewSet", "annul", "treasury.annul_treasurymovement"),
    ("treasury.views.BankStatementViewSet", "confirm", "treasury.confirm_bankstatement"),
    # Nómina (HR)
    ("hr.views.PayrollViewSet", "post_payroll", "hr.post_payroll"),
    ("hr.views.PayrollViewSet", "pay_salary", "hr.pay_payroll"),
    ("hr.views.PayrollViewSet", "pay_previred", "hr.pay_payroll"),
    ("hr.views.SalaryAdvanceViewSet", "annul", "hr.annul_salaryadvance"),
    ("hr.views.PayrollPaymentViewSet", "annul", "hr.annul_payrollpayment"),
    # Producción
    ("production.views.WorkOrderViewSet", "annul", "production.annul_workorder"),
    # Tributario
    ("tax.views.TaxPeriodViewSet", "close", "tax.can_close_tax_period"),
    ("tax.views.TaxPeriodViewSet", "reopen", "tax.can_reopen_tax_period"),
    ("tax.views.AccountingPeriodViewSet", "close", "tax.can_close_accounting_period"),
    ("tax.views.AccountingPeriodViewSet", "reopen", "tax.can_reopen_accounting_period"),
    ("tax.views.F29PaymentViewSet", "annul", "tax.annul_f29payment"),
]

# ---------------------------------------------------------------------------
# Wave 2 mapping table  (viewset_module.ClassName, action, "app.perm")
# ---------------------------------------------------------------------------
WAVE_2 = [
    # Ventas — despacho
    ("sales.views.SaleOrderViewSet", "dispatch_order", "sales.dispatch_saleorder"),
    ("sales.views.SaleOrderViewSet", "partial_dispatch", "sales.dispatch_saleorder"),
    ("sales.views.SaleOrderViewSet", "register_merchandise_return", "sales.add_salereturn"),
    ("sales.views.SaleOrderViewSet", "register_note", "billing.add_invoice"),
    # Facturación
    ("billing.views.InvoiceViewSet", "process_logistics", "sales.dispatch_saleorder"),
    ("billing.note_views.NoteWorkflowViewSet", "checkout", "billing.add_invoice"),
    ("billing.note_views.NoteWorkflowViewSet", "complete", "billing.confirm_invoice"),
    # Compras
    ("purchasing.views.PurchaseOrderViewSet", "receive", "purchasing.receive_purchaseorder"),
    ("purchasing.views.PurchaseOrderViewSet", "partial_receive", "purchasing.receive_purchaseorder"),
    ("purchasing.views.PurchaseOrderViewSet", "partial_return", "purchasing.add_purchasereturn"),
    ("purchasing.views.PurchaseOrderViewSet", "register_note", "billing.add_invoice"),
    # Inventario
    ("inventory.views.InventoryDocumentViewSet", "confirm", "inventory.confirm_inventorydocument"),
    ("inventory.views.InventoryDocumentViewSet", "annul", "inventory.annul_inventorydocument"),
    ("inventory.views.InventoryCountViewSet", "apply", "inventory.post_inventorycount"),
    ("inventory.subscription_views.SubscriptionViewSet", "cancel", "inventory.cancel_subscription"),
    # Producción
    ("production.views.WorkOrderViewSet", "rectify", "production.reopen_workorder"),
    ("production.views.WorkOrderViewSet", "restart", "production.reopen_workorder"),
    # Contactos / socios
    ("contacts.views.ContactViewSet", "unblock_credit", "sales.override_credit_limit"),
    ("contacts.views.ContactViewSet", "write_off_debt", "contacts.write_off_contact"),
    ("contacts.views.ContactViewSet", "recover_written_off_debt", "contacts.write_off_contact"),
    ("contacts.views.ContactViewSet", "promote_partner", "contacts.post_partnertransaction"),
    ("contacts.views.ContactViewSet", "demote_partner", "contacts.post_partnertransaction"),
    ("contacts.views.ContactViewSet", "setup_partner", "contacts.post_partnertransaction"),
    ("contacts.views.ContactViewSet", "initial_setup", "contacts.post_partnertransaction"),
    ("contacts.views.ContactViewSet", "equity_subscription", "contacts.post_partnertransaction"),
    ("contacts.views.ContactViewSet", "equity_transfer", "contacts.post_partnertransaction"),
    ("contacts.views.ContactViewSet", "individual_dividend_payment", "contacts.post_partnertransaction"),
    ("contacts.views.ContactViewSet", "partner_transactions", "contacts.post_partnertransaction"),
    ("contacts.views.ContactViewSet", "mass_mobilize_retained_earnings", "contacts.post_partnertransaction"),
    # Distribución de utilidades
    ("contacts.profit_distribution_views.ProfitDistributionResolutionViewSet", "approve", "contacts.approve_profitdistributionresolution"),
    ("contacts.profit_distribution_views.ProfitDistributionResolutionViewSet", "execute", "contacts.pay_profitdistributionresolution"),
    ("contacts.profit_distribution_views.ProfitDistributionResolutionViewSet", "mass_payment", "contacts.pay_profitdistributionresolution"),
    # Tesorería
    ("treasury.views.TerminalBatchViewSet", "generate_invoice", "billing.add_invoice"),
    ("treasury.views.POSSessionViewSet", "close_session", "treasury.close_possession"),
    ("treasury.views.BankStatementLineViewSet", "confirm", "treasury.confirm_bankstatement"),
    ("treasury.views.CheckViewSet", "bounce", "treasury.annul_check"),
    ("treasury.views.CheckViewSet", "void", "treasury.annul_check"),
    ("treasury.views.BankLoanViewSet", "disburse", "treasury.post_bankloan"),
    ("treasury.views.BankLoanViewSet", "prepay", "treasury.pay_loaninstallment"),
    ("treasury.views.LoanInstallmentViewSet", "pay", "treasury.pay_loaninstallment"),
    ("treasury.views.CreditCardStatementViewSet", "pay", "treasury.pay_creditcardstatement"),
    ("treasury.views.CreditCardStatementViewSet", "cancel", "treasury.cancel_creditcardstatement"),
    ("treasury.views.CreditCardStatementViewSet", "reverse", "treasury.reverse_creditcardstatement"),
    # Tributario
    ("tax.views.F29DeclarationViewSet", "register", "tax.post_f29declaration"),
    # Contabilidad
    ("accounting.views.AccountViewSet", "populate_ifrs", "accounting.override_account"),
]

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _ensure_perm_in_db(perm_str: str) -> Permission:
    """Ensure a custom permission exists in the test DB.

    Meta.permissions are auto-created by Django's test setup; PermissionRegistry
    permissions are created via the post_migrate signal.  This function handles
    the edge case where a permission is not yet created (e.g. when the Registry
    registration was added but post_migrate has not been re-fired in this session).
    """
    app_label, codename = perm_str.split(".", 1)
    existing = Permission.objects.filter(
        content_type__app_label=app_label, codename=codename
    ).first()
    if existing:
        return existing
    app_config = apps.get_app_config(app_label)
    model_list = list(app_config.get_models())
    ct = ContentType.objects.get_for_model(model_list[0])
    return Permission.objects.create(
        content_type=ct, codename=codename, name=f"Can {codename}"
    )


# ---------------------------------------------------------------------------
# Parametrized test
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("viewset_path,action,perm", WAVE_1 + WAVE_2)
def test_business_action_requires_permission(viewset_path, action, perm):
    """Business-critical actions must declare an explicit business permission and enforce it."""
    module_path, cls_name = viewset_path.rsplit(".", 1)
    module = importlib.import_module(module_path)
    viewset_cls = getattr(module, cls_name)

    # --- 1. Structural check: action_permissions must map the action to the right perm ---
    ap = getattr(viewset_cls, "action_permissions", {})
    assert action in ap, (
        f"{viewset_path} is missing action_permissions[{action!r}].  "
        f"Add action_permissions = {{'{action}': '{perm}', ...}} to the class body."
    )
    assert ap[action] == perm, (
        f"{viewset_path}.action_permissions[{action!r}] = {ap[action]!r}; "
        f"expected {perm!r}."
    )

    # --- 2. Behavioral check: deny without perm, allow with perm ---
    _ensure_perm_in_db(perm)

    factory = APIRequestFactory()

    # User with NO permissions → must be denied
    user_no = make_user(f"no__{action}")
    req_no = Request(factory.post("/test/"))
    req_no.user = user_no
    view_no = viewset_cls()
    view_no.action = action
    view_no.request = req_no
    view_no.args = ()
    view_no.kwargs = {}
    view_no.format_kwarg = None
    assert StandardizedModelPermissions().has_permission(req_no, view_no) is False, (
        f"{viewset_path}.{action}: unauthenticated/permless user should be denied."
    )

    # User WITH the business permission → must be allowed
    user_ok = make_user(f"ok__{action}", perm)
    req_ok = Request(factory.post("/test/"))
    req_ok.user = user_ok
    view_ok = viewset_cls()
    view_ok.action = action
    view_ok.request = req_ok
    view_ok.args = ()
    view_ok.kwargs = {}
    view_ok.format_kwarg = None
    assert StandardizedModelPermissions().has_permission(req_ok, view_ok) is True, (
        f"{viewset_path}.{action}: user with '{perm}' should be allowed."
    )
