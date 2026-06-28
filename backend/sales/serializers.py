from django.db.models import Sum
from rest_framework import serializers

from sales.selectors import SaleOrderSelector
from sales.services import SalesService

from .models import (
    SaleDelivery,
    SaleDeliveryLine,
    SaleLine,
    SaleOrder,
    SaleReturn,
    SaleReturnLine,
    SalesSettings,
)


class SalesSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesSettings
        fields = "__all__"


class SaleLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True, allow_null=True)
    product_type = serializers.SerializerMethodField()
    track_inventory = serializers.SerializerMethodField()
    manufacturable_quantity = serializers.SerializerMethodField()
    mfg_auto_finalize = serializers.SerializerMethodField()
    has_bom = serializers.SerializerMethodField()

    product_code = serializers.CharField(source="product.code", read_only=True, allow_null=True)
    product_id = serializers.ReadOnlyField(source="product.id")

    quantity_pending = serializers.ReadOnlyField()
    uom_name = serializers.CharField(source="uom.name", read_only=True, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True)

    # Explicitly define tax_rate to ensure it is writable and passed to validated_data
    tax_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, default=19.00
    )

    class Meta:
        model = SaleLine
        fields = [
            "id",
            "product",
            "product_id",
            "product_name",
            "product_code",
            "product_type",
            "track_inventory",
            "manufacturable_quantity",
            "description",
            "quantity",
            "uom",
            "uom_name",
            "unit_price",
            "unit_price_gross",
            "tax_rate",
            "discount_percentage",
            "discount_amount",
            "subtotal",
            "quantity_delivered",
            "quantity_pending",
            "manufacturing_data",
            "requires_advanced_manufacturing",
            "is_production_finished",
            "work_order_summary",
            "mfg_auto_finalize",
            "has_bom",
            "related_note",
            "available_stock",
            "delivery_status",
            "delivery_date",
        ]

    def get_product_type(self, obj):
        return obj.product.product_type if obj.product else None

    def get_track_inventory(self, obj):
        return obj.product.track_inventory if obj.product else False

    def get_manufacturable_quantity(self, obj):
        if obj.product and obj.product.strategy.can_have_bom:
            qty = obj.product.get_manufacturable_quantity()
            return float(qty) if qty is not None else None
        return None

    requires_advanced_manufacturing = serializers.SerializerMethodField()

    def get_requires_advanced_manufacturing(self, obj):
        return obj.product.requires_advanced_manufacturing if obj.product else False

    def get_mfg_auto_finalize(self, obj):
        return (
            obj.product.mfg_profile.mfg_auto_finalize
            if (obj.product and obj.product.mfg_profile)
            else False
        )

    def get_has_bom(self, obj):
        return obj.product.has_bom if obj.product else False

    available_stock = serializers.SerializerMethodField()

    def get_available_stock(self, obj):
        if obj.product and obj.product.product_type == "STORABLE":
            qty = obj.product.qty_available
            return float(qty) if qty is not None else 0.0
        return None

    is_production_finished = serializers.SerializerMethodField()
    work_order_summary = serializers.SerializerMethodField()

    def get_is_production_finished(self, obj):
        # If not manufacturable, we consider "production" as N/A (True for dispatch purposes)
        if not obj.product or not obj.product.strategy.requires_manufacturing_profile:
            return True

        # Use prefetched work_orders
        ots = [ot for ot in obj.work_orders.all() if ot.status != "CANCELLED"]
        if not ots:
            # If no OT yet (or all cancelled), but it's manufacturable, it's not finished
            return False

        # Check if all OTs have reached the FINISHED stage (not just status)
        return all(ot.current_stage == "FINISHED" for ot in ots)

    def get_work_order_summary(self, obj):
        ots = [ot for ot in obj.work_orders.all() if ot.status != "CANCELLED"]
        if not ots:
            return None

        # Return summary of first active OT for simple UI display
        ot = ots[0]
        return {
            "number": ot.number,
            "status": ot.status,
            "status_display": ot.get_status_display(),
            "current_stage": ot.current_stage,
            "current_stage_display": ot.get_current_stage_display(),
        }

    delivery_status = serializers.SerializerMethodField()
    delivery_date = serializers.SerializerMethodField()

    def get_delivery_status(self, obj):
        if obj.quantity_delivered >= obj.quantity:
            return "ENTREGADO"
        if obj.quantity_delivered > 0:
            return "PARCIAL"
        return "PENDIENTE"

    def get_delivery_date(self, obj):
        return obj.order.delivery_date if obj.order else None

    def validate(self, data):
        product = data.get("product")
        uom = data.get("uom")

        if product and uom:
            from inventory.services import UoMService

            allowed_uoms = UoMService.get_allowed_uoms_for_context(product, "sale")

            if uom.id not in allowed_uoms.values_list("id", flat=True):
                allowed_names = ", ".join(allowed_uoms.values_list("name", flat=True))
                raise serializers.ValidationError(
                    {
                        "uom": f"La unidad '{uom.name}' no está permitida para este producto. "
                        f"Unidades permitidas: {allowed_names}"
                    }
                )

        return data


class SaleOrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True, allow_null=True)
    channel_display = serializers.CharField(source="get_channel_display", read_only=True)
    total_paid = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    serialized_payments = serializers.SerializerMethodField()
    related_documents = serializers.SerializerMethodField()
    work_orders = serializers.SerializerMethodField()
    production_progress = serializers.SerializerMethodField()
    has_pending_work_orders = serializers.SerializerMethodField()
    pos_session_display = serializers.SerializerMethodField()
    lines = serializers.SerializerMethodField()

    def get_pos_session_display(self, obj):
        return str(obj.pos_session) if obj.pos_session else None

    credit_assignment_origin_display = serializers.CharField(
        source="get_credit_assignment_origin_display", read_only=True
    )
    credit_approval_task_details = serializers.SerializerMethodField()

    def get_credit_approval_task_details(self, obj):
        if obj.credit_approval_task:
            return {
                "id": obj.credit_approval_task.id,
                "status": obj.credit_approval_task.status,
                "status_display": obj.credit_approval_task.get_status_display(),
                "completed_at": obj.credit_approval_task.completed_at,
                "completed_by_name": obj.credit_approval_task.completed_by.get_full_name()
                or obj.credit_approval_task.completed_by.username
                if obj.credit_approval_task.completed_by
                else None,
            }
        return None

    display_id = serializers.CharField(read_only=True)

    class Meta:
        model = SaleOrder
        fields = [
            "id",
            "number",
            "display_id",
            "customer",
            "customer_name",
            "date",
            "status",
            "channel",
            "channel_display",
            "notes",
            "payment_method",
            "delivery_status",
            "delivery_date",
            "salesperson",
            "total_net",
            "total_tax",
            "total_discount_amount",
            "total",
            "effective_total",
            "total_paid",
            "pending_amount",
            "lines",
            "serialized_payments",
            "related_documents",
            "work_orders",
            "production_progress",
            "has_pending_work_orders",
            "pos_session",
            "pos_session_display",
            "credit_assignment_origin",
            "credit_assignment_origin_display",
            "credit_approval_task_details",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "number",
            "status",
            "total_net",
            "total_tax",
            "total",
            "journal_entry",
        ]

    def get_serialized_payments(self, obj):
        from treasury.serializers import TreasuryMovementSerializer
        return TreasuryMovementSerializer(obj.payments.all(), many=True).data

    def get_related_documents(self, obj):
        return SaleOrderSelector.get_related_documents(obj)

    def get_lines(self, obj):
        # Only include original lines (not those from notes)
        lines = [line for line in obj.lines.all() if getattr(line, "related_note_id", None) is None]
        return SaleLineSerializer(lines, many=True).data

    def get_work_orders(self, obj):
        # Only include OTs NOT linked to a note (original order OTs)
        ots = [ot for ot in obj.work_orders.all() if getattr(ot, "related_note_id", None) is None]
        from production.serializers import WorkOrderSerializer
        return WorkOrderSerializer(ots, many=True).data

    def get_has_pending_work_orders(self, obj):
        ots = [ot for ot in obj.work_orders.all() if getattr(ot, "related_note_id", None) is None and ot.status != "FINISHED"]
        return len(ots) > 0

    def get_total_paid(self, obj):
        return sum(p.amount for p in obj.payments.all())

    def get_pending_amount(self, obj):
        return obj.effective_total - self.get_total_paid(obj)

    def get_production_progress(self, obj):
        from production.serializers import WorkOrderSerializer
        wos = [ot for ot in obj.work_orders.all() if getattr(ot, "related_note_id", None) is None and ot.status != "CANCELLED"]
        if not wos:
            return 0
        total_progress = sum(
            WorkOrderSerializer(wo).data.get("production_progress", 0) for wo in wos
        )
        return total_progress / len(wos)


class CreateSaleOrderSerializer(serializers.ModelSerializer):
    """
    Serializer to handle nested creation of lines.

    payment_method_id (opcional): ID de treasury.PaymentMethod.
        Si se provee, se guarda en payment_method_ref (FK nuevo).
        El campo legacy payment_method se normaliza desde el tipo del método si no viene explícito.
    """

    lines = SaleLineSerializer(many=True)
    payment_method_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = SaleOrder
        fields = [
            "id",
            "number",
            "customer",
            "notes",
            "payment_method",
            "payment_method_id",
            "total_discount_amount",
            "lines",
        ]
        read_only_fields = ["id", "number", "status", "journal_entry"]

    def validate(self, attrs):
        settings = SalesSettings.get_solo()
        if settings and settings.restrict_stock_sales:
            for line in attrs.get("lines", []):
                product = line.get("product")
                quantity = line.get("quantity")
                if product and product.product_type == "STORABLE":
                    current_stock = product.moves.aggregate(total=Sum("quantity"))["total"] or 0
                    if current_stock < quantity:
                        raise serializers.ValidationError(
                            f"Stock insuficiente para {product.name}. Disponible: {current_stock}, Solicitado: {quantity}"
                        )
        return attrs

    def create(self, validated_data):
        return SalesService.create_sale_order(validated_data)


class SaleDeliveryLineSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source="product.code", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)
    order_quantity = serializers.DecimalField(
        source="sale_line.quantity", max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = SaleDeliveryLine
        fields = "__all__"


class SaleDeliverySerializer(serializers.ModelSerializer):
    lines = SaleDeliveryLineSerializer(many=True, read_only=True)
    sale_order_number = serializers.CharField(source="sale_order.number", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    customer_name = serializers.CharField(source="sale_order.customer.name", read_only=True)
    customer_id = serializers.IntegerField(source="sale_order.customer_id", read_only=True)

    class Meta:
        model = SaleDelivery
        fields = "__all__"
        read_only_fields = ["id", "number", "status"]


class SaleReturnLineSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source="product.code", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)

    class Meta:
        model = SaleReturnLine
        fields = "__all__"


class SaleReturnSerializer(serializers.ModelSerializer):
    lines = SaleReturnLineSerializer(many=True, read_only=True)
    sale_order_number = serializers.CharField(source="sale_order.number", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = SaleReturn
        fields = "__all__"
        read_only_fields = ["id", "number", "status"]
