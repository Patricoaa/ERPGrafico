import pytest
from django.core.exceptions import ValidationError
from rest_framework import serializers

from accounting.models import AccountingSettings
from billing.dte_policy import CONFIGURABLE_DTE_TYPES, validate_configured_dte_type
from billing.invoice_from_lines import InvoiceFromLinesService
from billing.models import Invoice
from billing.serializers import InvoiceWriteSerializer
from billing.services import BillingService
from contacts.models import Contact
from inventory.models import Warehouse
from purchasing.models import PurchaseOrder
from sales.models import SaleOrder


@pytest.fixture
def customer_and_supplier(db):
    return Contact.objects.create(name="Cliente DTE", tax_id="DTE-CLIENTE-1")


@pytest.fixture
def accounting_settings(db):
    settings = AccountingSettings.get_solo()
    settings.allowed_dte_types_emit = ["FACTURA"]
    settings.allowed_dte_types_receive = ["BOLETA"]
    settings.save()
    return settings


def test_empty_legacy_lists_mean_all_configurable_types_are_enabled(db):
    settings = AccountingSettings.get_solo()
    settings.allowed_dte_types_emit = []
    settings.allowed_dte_types_receive = []
    settings.save()

    for dte_type in CONFIGURABLE_DTE_TYPES:
        validate_configured_dte_type(side="emit", dte_type=dte_type)
        validate_configured_dte_type(side="receive", dte_type=dte_type)


def test_dte_policy_is_independent_for_emission_and_receiving(accounting_settings):
    validate_configured_dte_type(side="emit", dte_type="FACTURA")
    validate_configured_dte_type(side="receive", dte_type="BOLETA")

    with pytest.raises(ValidationError, match="deshabilitado para la emisión"):
        validate_configured_dte_type(side="emit", dte_type="BOLETA")
    with pytest.raises(ValidationError, match="deshabilitado para la recepción"):
        validate_configured_dte_type(side="receive", dte_type="FACTURA")


def test_sale_invoice_service_rejects_a_disabled_document_type(
    accounting_settings, customer_and_supplier
):
    order = SaleOrder.objects.create(customer=customer_and_supplier)

    with pytest.raises(ValidationError, match="deshabilitado para la emisión"):
        BillingService.create_sale_invoice(order, Invoice.DTEType.BOLETA)


def test_purchase_bill_service_rejects_a_disabled_document_type(
    accounting_settings, customer_and_supplier
):
    warehouse = Warehouse.objects.create(name="Bodega DTE", code="DTE-POLICY")
    order = PurchaseOrder.objects.create(
        number="PO-DTE-POLICY",
        supplier=customer_and_supplier,
        warehouse=warehouse,
    )

    with pytest.raises(ValidationError, match="deshabilitado para la recepción"):
        BillingService.create_purchase_bill(
            order,
            supplier_invoice_number="F-1",
            dte_type=Invoice.DTEType.FACTURA,
        )


def test_generic_invoice_write_serializer_enforces_sale_side_policy(
    accounting_settings, customer_and_supplier
):
    order = SaleOrder.objects.create(customer=customer_and_supplier)
    serializer = InvoiceWriteSerializer(
        data={"sale_order": order.pk, "dte_type": Invoice.DTEType.BOLETA}
    )

    with pytest.raises(serializers.ValidationError, match="deshabilitado para la emisión"):
        serializer.is_valid(raise_exception=True)


def test_standalone_invoice_write_serializer_uses_emission_policy(
    accounting_settings,
):
    serializer = InvoiceWriteSerializer(data={"dte_type": Invoice.DTEType.BOLETA})

    with pytest.raises(serializers.ValidationError, match="deshabilitado para la emisión"):
        serializer.is_valid(raise_exception=True)


def test_invoice_from_lines_enforces_side_policy_before_creating(
    accounting_settings,
):
    with pytest.raises(ValidationError, match="deshabilitado para la emisión"):
        InvoiceFromLinesService.create(
            side="sale",
            dte_type=Invoice.DTEType.BOLETA,
            items=[],
        )


def test_confirming_existing_invoice_rechecks_current_side_policy(
    accounting_settings, customer_and_supplier
):
    order = SaleOrder.objects.create(customer=customer_and_supplier)
    invoice = Invoice.objects.create(
        sale_order=order,
        contact=customer_and_supplier,
        dte_type=Invoice.DTEType.BOLETA,
    )

    with pytest.raises(ValidationError, match="deshabilitado para la emisión"):
        BillingService.confirm_invoice(invoice, number="B-1")


def test_confirming_existing_purchase_invoice_rechecks_receive_policy(
    accounting_settings, customer_and_supplier
):
    warehouse = Warehouse.objects.create(name="Bodega DTE Confirm", code="DTE-CONFIRM")
    order = PurchaseOrder.objects.create(
        number="PO-DTE-CONFIRM",
        supplier=customer_and_supplier,
        warehouse=warehouse,
    )
    invoice = Invoice.objects.create(
        purchase_order=order,
        contact=customer_and_supplier,
        dte_type=Invoice.DTEType.FACTURA,
    )

    with pytest.raises(ValidationError, match="deshabilitado para la recepción"):
        BillingService.confirm_invoice(invoice, number="F-2")


def test_non_configurable_dte_workflows_are_not_blocked(accounting_settings):
    validate_configured_dte_type(side="receive", dte_type=Invoice.DTEType.PURCHASE_INV)
    validate_configured_dte_type(side="emit", dte_type=Invoice.DTEType.NOTA_CREDITO)
