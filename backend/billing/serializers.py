from rest_framework import serializers

from core.serializers import AttachmentSerializer
from sales.serializers import SaleOrderSerializer
from treasury.serializers import TreasuryMovementSerializer

from .models import Invoice


class InvoiceSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True, read_only=True)
    dte_type_display = serializers.CharField(source="get_dte_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_method_display = serializers.CharField(
        source="get_payment_method_display", read_only=True
    )

    sale_order_number = serializers.CharField(
        source="sale_order.number", read_only=True, allow_null=True
    )
    purchase_order_number = serializers.CharField(
        source="purchase_order.number", read_only=True, allow_null=True
    )
    po_receiving_status = serializers.CharField(
        source="purchase_order.receiving_status", read_only=True, allow_null=True
    )
    partner_name = serializers.SerializerMethodField()
    partner_id = serializers.SerializerMethodField()
    related_documents = serializers.SerializerMethodField()
    related_stock_moves = serializers.SerializerMethodField()
    related_returns = serializers.SerializerMethodField()
    lines = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    serialized_payments = serializers.SerializerMethodField()
    adjustments = serializers.SerializerMethodField()
    corrected_invoice = serializers.SerializerMethodField()
    order_delivery_status = serializers.SerializerMethodField()
    work_orders = serializers.SerializerMethodField()
    is_tax_exempt = serializers.ReadOnlyField()
    pos_session = serializers.IntegerField(
        source="sale_order.pos_session", read_only=True, allow_null=True
    )
    sale_order_detail = SaleOrderSerializer(source="sale_order", read_only=True, allow_null=True)
    is_sale_document = serializers.ReadOnlyField()

    class Meta:
        model = Invoice
        fields = [
            "id",
            "dte_type",
            "dte_type_display",
            "sii_document_code",
            "number",
            "document_attachment",
            "date",
            "sale_order",
            "purchase_order",
            "corrected_invoice",
            "contact",
            "status",
            "status_display",
            "payment_method",
            "payment_method_display",
            "total_net",
            "total_tax",
            "total_discount_amount",
            "total",
            "journal_entry",
            "tax_period_closed",
            "created_at",
            "updated_at",
            "attachments",
            "sale_order_number",
            "purchase_order_number",
            "po_receiving_status",
            "partner_name",
            "partner_id",
            "related_documents",
            "related_stock_moves",
            "related_returns",
            "lines",
            "pending_amount",
            "serialized_payments",
            "adjustments",
            "order_delivery_status",
            "work_orders",
            "is_tax_exempt",
            "pos_session",
            "sale_order_detail",
            "is_sale_document",
        ]
        read_only_fields = [
            "id",
            "number",
            "status",
            "total_net",
            "total_tax",
            "total",
            "journal_entry",
            "tax_period_closed",
        ]

    def get_serialized_payments(self, obj):
        from .selectors import InvoiceSelectorExt
        return InvoiceSelectorExt.get_serialized_payments(obj)

    def get_pending_amount(self, obj):
        # Leer de RAM: payments y payment_allocations ya están prefetcheados
        total_paid = sum(p.amount for p in obj.payments.all())
        total_allocated = sum(a.amount for a in obj.payment_allocations.all())
        return obj.total - (total_paid + total_allocated)

    def get_lines(self, obj):
        from .selectors import InvoiceSelectorExt
        return InvoiceSelectorExt.get_lines(obj)

    def get_related_documents(self, obj):
        from .selectors import InvoiceSelectorExt
        return InvoiceSelectorExt.get_related_documents(obj)

    def get_partner_name(self, obj):
        if obj.sale_order and obj.sale_order.customer:
            return obj.sale_order.customer.name
        if obj.purchase_order and obj.purchase_order.supplier:
            return obj.purchase_order.supplier.name
        if obj.contact:
            return obj.contact.name
        return ""

    def get_partner_id(self, obj):
        if obj.sale_order and obj.sale_order.customer:
            return obj.sale_order.customer.id
        if obj.purchase_order and obj.purchase_order.supplier:
            return obj.purchase_order.supplier.id
        if obj.contact:
            return obj.contact.id
        return None

    def get_related_stock_moves(self, obj):
        from .selectors import InvoiceSelectorExt
        return InvoiceSelectorExt.get_related_stock_moves(obj)

    def get_related_returns(self, obj):
        from .selectors import InvoiceSelectorExt
        return InvoiceSelectorExt.get_related_returns(obj)

    def get_adjustments(self, obj):
        # Only Facturas/Boletas usually have adjustments (Notes correcting them)
        adjustments = obj.adjustments.all()
        return [
            {
                "id": a.id,
                "number": a.number,
                "dte_type": a.dte_type,
                "dte_type_display": a.get_dte_type_display(),
                "status": a.status,
                "total": float(a.total),
                "display_id": a.display_id,
            }
            for a in adjustments
        ]

    def get_corrected_invoice(self, obj):
        if not obj.corrected_invoice:
            return None
        return {
            "id": obj.corrected_invoice.id,
            "number": obj.corrected_invoice.number,
            "display_id": obj.corrected_invoice.display_id,
            "dte_type": obj.corrected_invoice.dte_type,
            "dte_type_display": obj.corrected_invoice.get_dte_type_display(),
        }

    def get_order_delivery_status(self, obj):
        if obj.sale_order:
            return obj.sale_order.delivery_status
        if obj.purchase_order:
            return obj.purchase_order.receiving_status
        return None

    def get_work_orders(self, obj):
        # Only include Work Orders for Debit Notes
        if obj.dte_type == Invoice.DTEType.NOTA_DEBITO:
            from production.serializers import WorkOrderSerializer

            ots = obj.work_orders.all()
            return WorkOrderSerializer(ots, many=True).data
        return []


class CreateInvoiceSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    order_type = serializers.ChoiceField(choices=["sale", "purchase"])
    dte_type = serializers.ChoiceField(choices=Invoice.DTEType.choices)
    payment_method = serializers.ChoiceField(
        choices=Invoice.PaymentMethod.choices, default="CREDIT"
    )
    supplier_invoice_number = serializers.CharField(required=False, allow_blank=True)
    document_attachment = serializers.FileField(required=False, allow_null=True)
    issue_date = serializers.DateField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=Invoice.Status.choices, default=Invoice.Status.POSTED)
