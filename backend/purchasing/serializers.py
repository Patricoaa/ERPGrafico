from rest_framework import serializers

from purchasing.selectors import PurchaseOrderSelector
from purchasing.services import PurchasingService
from treasury.serializers import TreasuryMovementSerializer

from .models import (
    PurchaseLine,
    PurchaseOrder,
    PurchaseReceipt,
    PurchaseReceiptLine,
    PurchaseReturn,
    PurchaseReturnLine,
)


class PurchaseLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_type = serializers.CharField(source="product.product_type", read_only=True)
    product_id = serializers.ReadOnlyField(source="product.id")
    quantity_pending = serializers.ReadOnlyField()
    uom_name = serializers.CharField(source="uom.name", read_only=True, allow_null=True)

    track_inventory = serializers.SerializerMethodField()
    has_bom = serializers.SerializerMethodField()
    requires_advanced_manufacturing = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseLine
        fields = [
            "id",
            "product",
            "product_id",
            "product_name",
            "product_type",
            "quantity",
            "uom",
            "uom_name",
            "unit_cost",
            "tax_rate",
            "subtotal",
            "quantity_received",
            "quantity_pending",
            "track_inventory",
            "has_bom",
            "requires_advanced_manufacturing",
        ]
        read_only_fields = ["subtotal", "quantity_received", "quantity_pending"]

    def get_track_inventory(self, obj):
        return obj.product.track_inventory if obj.product else False

    def get_has_bom(self, obj):
        return obj.product.has_bom if obj.product else False

    def get_requires_advanced_manufacturing(self, obj):
        return obj.product.requires_advanced_manufacturing if obj.product else False

    def validate(self, data):
        product, uom = data.get('product'), data.get('uom')
        if product and uom:
            from inventory.services import UoMService
            if not product.uom: raise serializers.ValidationError({'product': f"El producto '{product.name}' debe tener UoM base."}) 
            if not UoMService.validate_uom_compatibility(product.uom, uom):
                raise serializers.ValidationError({'uom': f"La unidad '{uom.name}' no es compatible con '{product.uom.category.name}'."})
        return data


class PurchaseOrderSerializer(serializers.ModelSerializer):
    lines = serializers.SerializerMethodField()
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    total_paid = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    is_invoiced = serializers.SerializerMethodField()
    invoice_details = serializers.SerializerMethodField()
    serialized_payments = TreasuryMovementSerializer(source="payments", many=True, read_only=True)
    payment_method_ref_name = serializers.CharField(
        source="payment_method_ref.name", read_only=True, allow_null=True
    )
    payment_method_ref_method_type = serializers.CharField(
        source="payment_method_ref.method_type", read_only=True, allow_null=True
    )
    work_order_number = serializers.CharField(
        source="work_order.number", read_only=True, allow_null=True
    )
    related_documents = serializers.SerializerMethodField()
    actual_receipt_date = serializers.SerializerMethodField()

    display_id = serializers.CharField(read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "number",
            "display_id",
            "supplier",
            "supplier_name",
            "warehouse",
            "warehouse_name",
            "date",
            "status",
            "receiving_status",
            "receipt_date",
            "notes",
            "total_net",
            "total_tax",
            "total",
            "total_paid",
            "pending_amount",
            "is_invoiced",
            "invoice_details",
            "serialized_payments",
            "payment_method",
            "payment_method_ref_name",
            "payment_method_ref_method_type",
            "work_order",
            "work_order_number",
            "related_documents",
            "lines",
            "created_at",
            "updated_at",
            "actual_receipt_date",
        ]
        read_only_fields = [
            "id",
            "number",
            "status",
            "receiving_status",
            "total_net",
            "total_tax",
            "total",
        ]

    def get_total_paid(self, obj):
        # Exclude payments specific to Notes (NC/ND)
        payments = obj.payments.all()
        valid_payments = [
            p
            for p in payments
            if not (p.invoice and p.invoice.dte_type in ["NOTA_CREDITO", "NOTA_DEBITO"])
        ]
        return sum(p.amount for p in valid_payments)

    def get_pending_amount(self, obj):
        # Calculate base total from Primary Invoices (Factura/Boleta) OR PO Total
        # We exclude Notes (NC/ND) to keep the PO Hub status pure.
        # Use python iteration over prefetched obj.invoices.all()
        primary_invoices = [
            inv for inv in obj.invoices.all()
            if inv.dte_type in ["FACTURA", "BOLETA", "PURCHASE_INV"] and inv.status != "CANCELLED"
        ]

        if primary_invoices:
            base_total = sum(inv.total for inv in primary_invoices)
        else:
            base_total = obj.total

        return base_total - self.get_total_paid(obj)

    def get_is_invoiced(self, obj):
        from billing.models import Invoice

        return any(
            inv.dte_type in [
                Invoice.DTEType.FACTURA,
                Invoice.DTEType.BOLETA,
                Invoice.DTEType.PURCHASE_INV,
            ]
            for inv in obj.invoices.all()
        )

    def get_invoice_details(self, obj):
        return PurchaseOrderSelector.get_invoice_details(obj)

    def get_related_documents(self, obj):
        return PurchaseOrderSelector.get_related_documents(obj)

    def get_actual_receipt_date(self, obj):
        confirmed_receipts = [r for r in obj.receipts.all() if r.status == PurchaseReceipt.Status.CONFIRMED]
        if not confirmed_receipts:
            return None
        confirmed_receipts.sort(key=lambda r: r.receipt_date)
        return confirmed_receipts[0].receipt_date.isoformat()

    def get_lines(self, obj):
        # Only include original lines (not those from notes)
        lines = [l for l in obj.lines.all() if getattr(l, "related_note_id", None) is None]
        return PurchaseLineSerializer(lines, many=True).data


class WritePurchaseOrderSerializer(serializers.ModelSerializer):
    lines = PurchaseLineSerializer(many=True)
    payment_method_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "supplier",
            "warehouse",
            "work_order",
            "notes",
            "lines",
            "supplier_reference",
            "payment_method",
            "payment_method_id",
        ]
        read_only_fields = ["id", "number", "status"]

    def create(self, validated_data):
        return PurchasingService.create_purchase_order(validated_data)

    def update(self, instance, validated_data):
        return PurchasingService.update_purchase_order(instance, validated_data)


class PurchaseReceiptLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_code = serializers.CharField(source="product.code", read_only=True)

    class Meta:
        model = PurchaseReceiptLine
        fields = "__all__"


class PurchaseReceiptSerializer(serializers.ModelSerializer):
    lines = PurchaseReceiptLineSerializer(many=True, read_only=True)
    purchase_order_number = serializers.CharField(source="purchase_order.number", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    supplier_name = serializers.CharField(source="purchase_order.supplier.name", read_only=True)
    supplier_id = serializers.IntegerField(source="purchase_order.supplier_id", read_only=True)

    class Meta:
        model = PurchaseReceipt
        fields = "__all__"
        read_only_fields = ["id", "number", "status"]


class PurchaseReturnLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_code = serializers.CharField(source="product.code", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)

    class Meta:
        model = PurchaseReturnLine
        fields = "__all__"


class PurchaseReturnSerializer(serializers.ModelSerializer):
    lines = PurchaseReturnLineSerializer(many=True, read_only=True)
    purchase_order_number = serializers.CharField(source="purchase_order.number", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    supplier_name = serializers.CharField(source="purchase_order.supplier.name", read_only=True)
    supplier_id = serializers.IntegerField(source="purchase_order.supplier_id", read_only=True)

    class Meta:
        model = PurchaseReturn
        fields = "__all__"
        read_only_fields = ["id", "number", "status"]


class NoteCreationSerializer(serializers.Serializer):
    note_type = serializers.ChoiceField(
        choices=[("NOTA_CREDITO", "Nota de Crédito"), ("NOTA_DEBITO", "Nota de Débito")]
    )
    amount_net = serializers.DecimalField(max_digits=14, decimal_places=2)
    amount_tax = serializers.DecimalField(max_digits=14, decimal_places=2)
    document_number = serializers.CharField(max_length=50)
    document_date = serializers.DateField(required=False, allow_null=True)
    original_invoice_id = serializers.IntegerField(required=False, allow_null=True)
    return_items = serializers.ListField(
        child=serializers.DictField(), required=False, allow_empty=True
    )

    def validate(self, data):
        if data["amount_net"] < 0 or data["amount_tax"] < 0:
            raise serializers.ValidationError("Los montos no pueden ser negativos.")
        return data
