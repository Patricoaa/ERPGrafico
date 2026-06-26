from rest_framework import serializers

from core.serializers import AttachmentSerializer
from inventory.models import Product, UoM

from .models import (
    BillOfMaterials,
    BillOfMaterialsLine,
    ProductionConsumption,
    WorkOrder,
    WorkOrderHistory,
    WorkOrderMaterial,
)


class ProductionConsumptionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = ProductionConsumption
        fields = "__all__"

    def validate(self, data):
        product = data.get("product")
        if product and not product.uom:
            raise serializers.ValidationError(
                f"El producto '{product.name}' no tiene una Unidad de Medida (UoM) asignada."
            )
        return data


class WorkOrderHistorySerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.first_name", read_only=True)

    class Meta:
        model = WorkOrderHistory
        fields = "__all__"


class WorkOrderMaterialSerializer(serializers.ModelSerializer):
    component_name = serializers.CharField(source="component.name", read_only=True)
    component_code = serializers.CharField(source="component.code", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)
    stock_available = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()
    component_cost = serializers.SerializerMethodField()
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    purchase_order_number = serializers.CharField(
        source="purchase_line.order.number", read_only=True
    )
    purchase_order_receiving_status = serializers.CharField(
        source="purchase_line.order.receiving_status", read_only=True
    )
    purchase_order_id = serializers.IntegerField(source="purchase_line.order.id", read_only=True)
    total_cost = serializers.SerializerMethodField()
    planned_cost = serializers.SerializerMethodField()
    actual_cost = serializers.SerializerMethodField()

    class Meta:
        model = WorkOrderMaterial
        fields = "__all__"

    def get_stock_available(self, obj):
        from .selectors import ProductionSelectorExt
        return ProductionSelectorExt.get_stock_available(obj, self.context)

    def get_is_available(self, obj):
        quantity_planned = float(obj.quantity_planned)
        stock_available = self.get_stock_available(obj)
        return stock_available >= quantity_planned

    def get_component_cost(self, obj):
        if obj.is_outsourced and obj.unit_price > 0:
            return float(obj.unit_price)
        return float(obj.component.cost_price)

    def get_total_cost(self, obj):
        # Keep total_cost as actual for backward compatibility
        return self.get_actual_cost(obj)

    def get_planned_cost(self, obj):
        from inventory.services import UoMService

        qty = obj.quantity_planned
        component = obj.component

        if obj.uom and component.uom and obj.uom != component.uom:
            try:
                qty = UoMService.convert_quantity(obj.quantity_planned, obj.uom, component.uom)
            except Exception:
                pass

        cost = obj.unit_cost_snapshot
        if obj.is_outsourced and obj.unit_price > 0:
            cost = obj.unit_price

        total = qty * cost
        return float(total)

    def get_actual_cost(self, obj):
        from inventory.services import UoMService

        qty = obj.quantity_planned
        component = obj.component

        if obj.uom and component.uom and obj.uom != component.uom:
            try:
                qty = UoMService.convert_quantity(obj.quantity_planned, obj.uom, component.uom)
            except Exception:
                pass

        cost = obj.component.cost_price
        if obj.is_outsourced and obj.unit_price > 0:
            cost = obj.unit_price

        total = qty * cost
        return float(total)


class WorkOrderInitialMaterialSerializer(serializers.Serializer):
    component_id = serializers.IntegerField()
    quantity_planned = serializers.DecimalField(max_digits=12, decimal_places=4)
    is_outsourced = serializers.BooleanField(default=False)
    supplier_id = serializers.IntegerField(required=False, allow_null=True)
    unit_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    uom_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, data):
        from .validators import ProductionValidator
        return ProductionValidator.validate_initial_material(data)


class WorkOrderSerializer(serializers.ModelSerializer):
    consumptions = ProductionConsumptionSerializer(many=True, read_only=True)
    materials = WorkOrderMaterialSerializer(many=True, read_only=True)
    stage_history = WorkOrderHistorySerializer(many=True, read_only=True)
    sale_order_number = serializers.CharField(
        source="sale_order.number", read_only=True, allow_null=True
    )
    sale_order_date = serializers.DateField(
        source="sale_order.date", read_only=True, allow_null=True
    )
    sale_order_delivery_date = serializers.DateField(
        source="sale_order.delivery_date", read_only=True, allow_null=True
    )
    product_description = serializers.SerializerMethodField()
    sale_customer_name = serializers.SerializerMethodField()
    sale_customer_rut = serializers.SerializerMethodField()
    related_contact_id = serializers.IntegerField(
        source="related_contact.id", read_only=True, allow_null=True
    )
    related_contact_name = serializers.CharField(
        source="related_contact.name", read_only=True, allow_null=True
    )
    product_info = serializers.ReadOnlyField()
    main_product_id = serializers.SerializerMethodField()
    production_progress = serializers.SerializerMethodField()
    outsourcing_status = serializers.SerializerMethodField()
    attachments = AttachmentSerializer(many=True, read_only=True)
    is_cancellable = serializers.ReadOnlyField()
    cancellation_limit_stage = serializers.ReadOnlyField()
    display_id = serializers.SerializerMethodField()

    # Alias para compatibilidad con frontend (modelo usa estimated_completion_date)
    due_date = serializers.DateField(
        source="estimated_completion_date", read_only=True, allow_null=True
    )

    # Metadata helpers
    requires_prepress = serializers.SerializerMethodField()
    requires_press = serializers.SerializerMethodField()
    requires_postpress = serializers.SerializerMethodField()
    checkout_files = serializers.SerializerMethodField()
    workflow_tasks = serializers.SerializerMethodField()
    production_discrepancy = serializers.SerializerMethodField()
    side_effects = serializers.SerializerMethodField()

    # Unified accessors for product/volume that work for both LINKED (sale_line)
    # and MANUAL (product + stage_data) OTs.
    product_name = serializers.SerializerMethodField()
    quantity = serializers.SerializerMethodField()
    uom_id = serializers.SerializerMethodField()
    uom_name = serializers.SerializerMethodField()

    def get_checkout_files(self, obj):
        return []

    def get_display_id(self, obj):
        return obj.display_id

    def get_side_effects(self, obj):
        from .services import WorkOrderService

        return WorkOrderService.check_side_effects(obj)

    def get_product_name(self, obj):
        if obj.sale_line and obj.sale_line.product:
            return obj.sale_line.product.name
        if obj.product:
            return obj.product.name
        return ""

    def get_quantity(self, obj):
        if obj.sale_line and obj.sale_line.quantity is not None:
            return float(obj.sale_line.quantity)
        if obj.stage_data and obj.stage_data.get("quantity") is not None:
            try:
                return float(obj.stage_data["quantity"])
            except (TypeError, ValueError):
                return None
        return None

    def get_uom_id(self, obj):
        if obj.sale_line and obj.sale_line.uom_id:
            return obj.sale_line.uom_id
        if obj.stage_data and obj.stage_data.get("uom_id"):
            try:
                return int(obj.stage_data["uom_id"])
            except (TypeError, ValueError):
                return None
        return None

    def get_uom_name(self, obj):
        if obj.sale_line and obj.sale_line.uom:
            return obj.sale_line.uom.name
        if obj.stage_data and obj.stage_data.get("uom_name"):
            return obj.stage_data["uom_name"]
        
        uom_id = obj.stage_data.get("uom_id") if obj.stage_data else None
        if uom_id:
            from inventory.services import UoMService
            return UoMService.get_cached_uom_name(uom_id)
        return None

    def get_production_discrepancy(self, obj):
        if not obj.sale_line or obj.actual_quantity_produced is None:
            return None
        sold = float(obj.sale_line.quantity)
        produced = float(obj.actual_quantity_produced)
        if produced == sold:
            return None
        return {
            "produced": produced,
            "sold": sold,
            "delta": round(produced - sold, 4),
        }

    def get_product_description(self, obj):
        if obj.stage_data and obj.stage_data.get("product_description"):
            return obj.stage_data.get("product_description")
        return ""

    def get_sale_customer_name(self, obj):
        # 1. Prefer override from stage_data (set via Manufacturing Dialog)
        if obj.stage_data and obj.stage_data.get("contact_name"):
            return obj.stage_data.get("contact_name")
        # 2. Fallback to Sale Order customer
        if obj.sale_order and obj.sale_order.customer:
            return obj.sale_order.customer.name
        # 3. Fallback to related_contact
        if obj.related_contact:
            return obj.related_contact.name
        return "Manual / Interno"

    def get_sale_order_client_name(self, obj):
        if obj.sale_order and obj.sale_order.customer:
            return obj.sale_order.customer.name
        return None

    def get_sale_customer_rut(self, obj):
        if obj.stage_data and obj.stage_data.get("contact_tax_id"):
            return obj.stage_data.get("contact_tax_id")
        if obj.sale_order and obj.sale_order.customer:
            return obj.sale_order.customer.tax_id
        return ""

    def get_requires_prepress(self, obj):
        # 1. Try stage_data (specific for this order)
        if obj.stage_data and "phases" in obj.stage_data:
            return obj.stage_data["phases"].get("prepress", False)
        # 2. Fallback to product default
        if obj.sale_line and obj.sale_line.product:
            return (
                obj.sale_line.product.mfg_profile.mfg_enable_prepress
                if obj.sale_line.product.mfg_profile
                else False
            )
        return False

    def get_requires_press(self, obj):
        if obj.stage_data and "phases" in obj.stage_data:
            return obj.stage_data["phases"].get("press", False)
        if obj.sale_line and obj.sale_line.product:
            return (
                obj.sale_line.product.mfg_profile.mfg_enable_press
                if obj.sale_line.product.mfg_profile
                else False
            )
        return False

    def get_requires_postpress(self, obj):
        if obj.stage_data and "phases" in obj.stage_data:
            return obj.stage_data["phases"].get("postpress", False)
        if obj.sale_line and obj.sale_line.product:
            return (
                obj.sale_line.product.mfg_profile.mfg_enable_postpress
                if obj.sale_line.product.mfg_profile
                else False
            )
        return False

    def get_main_product_id(self, obj):
        if obj.sale_line and obj.sale_line.product_id:
            return obj.sale_line.product_id
        if obj.product_id:
            return obj.product_id
        return None

    def get_production_progress(self, obj):
        if obj.status == WorkOrder.Status.FINISHED:
            return 100
        if obj.status == WorkOrder.Status.CANCELLED:
            return 0

        # Progression based on stages
        weights = {
            WorkOrder.Stage.MATERIAL_ASSIGNMENT.value: 0,
            WorkOrder.Stage.MATERIAL_APPROVAL.value: 15,
            WorkOrder.Stage.OUTSOURCING_ASSIGNMENT.value: 30,
            WorkOrder.Stage.PREPRESS.value: 45,
            WorkOrder.Stage.PRESS.value: 60,
            WorkOrder.Stage.POSTPRESS.value: 75,
            WorkOrder.Stage.OUTSOURCING_VERIFICATION.value: 88,
            WorkOrder.Stage.RECTIFICATION.value: 95,
            WorkOrder.Stage.FINISHED.value: 100,
            WorkOrder.Stage.CANCELLED.value: 0,
        }
        return weights.get(obj.current_stage, 0)

    def get_outsourcing_status(self, obj):
        # Use prefetched materials — avoid .exists(), .filter(), .count()
        mats = list(obj.materials.all())
        if not mats:
            return "none"

        outsourced = [m for m in mats if m.is_outsourced]
        if not outsourced:
            return "none"

        if len(outsourced) == len(mats):
            return "full"
        return "partial"

    def get_attached_files(self, obj):
        files = []
        if not obj.sale_order and not obj.sale_line:
            return files

        # 1. From Sale Order — reads from prefetched RAM
        if obj.sale_order:
            files.extend(list(obj.sale_order.attachments.all()))

        # 2. From Sale Line (where manufacturing specs usually live) — reads from prefetched RAM
        if obj.sale_line:
            files.extend(list(obj.sale_line.attachments.all()))

        from core.serializers import AttachmentSerializer
        return AttachmentSerializer(files, many=True).data

    def get_workflow_tasks(self, obj):
        from workflow.serializers import TaskSerializer

        # Reads from prefetched GenericRelation in RAM
        tasks = list(obj.tasks.all())
        # Sort in Python to avoid hitting the DB (since tasks are prefetched)
        tasks.sort(key=lambda t: t.created_at)
        return TaskSerializer(tasks, many=True).data

    class Meta:
        model = WorkOrder
        fields = "__all__"
        read_only_fields = ["id", "number", "status", "current_stage"]


class BillOfMaterialsLineSerializer(serializers.ModelSerializer):
    component_name = serializers.CharField(source="component.name", read_only=True)
    component_code = serializers.CharField(source="component.code", read_only=True)
    component_cost = serializers.DecimalField(
        source="component.cost_price", max_digits=12, decimal_places=0, read_only=True
    )
    uom_name = serializers.CharField(source="uom.name", read_only=True)
    component_stock = serializers.SerializerMethodField()
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = BillOfMaterialsLine
        fields = [
            "id",
            "component",
            "component_code",
            "component_name",
            "component_cost",
            "component_stock",
            "quantity",
            "uom",
            "uom_name",
            "is_outsourced",
            "supplier",
            "supplier_name",
            "unit_price",
            "document_type",
        ]

    def get_component_stock(self, obj):
        # Use annotated stock if available on the component (from prefetched queryset)
        if hasattr(obj.component, "annotated_current_stock"):
            return float(obj.component.annotated_current_stock or 0.0)
        return float(obj.component.qty_on_hand)

    def validate(self, data):
        from .validators import ProductionValidator
        return ProductionValidator.validate_bom_line(data)


class BillOfMaterialsSerializer(serializers.ModelSerializer):
    lines = BillOfMaterialsLineSerializer(many=True, required=False)
    product_code = serializers.CharField(source="product.code", read_only=True)
    product_internal_code = serializers.CharField(source="product.internal_code", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    category_name = serializers.CharField(source="product.category.name", read_only=True)
    yield_uom_name = serializers.CharField(source="yield_uom.name", read_only=True)
    lines_count = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()

    product = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = BillOfMaterials
        fields = "__all__"

    def get_lines_count(self, obj):
        # Use prefetched lines if available
        return len(obj.lines.all())

    def get_total_cost(self, obj):
        from .selectors import ProductionSelectorExt
        return ProductionSelectorExt.get_total_cost(obj)

    def validate(self, data):
        product = data.get("product")
        if not product and self.instance:
            product = self.instance.product

        if product:
            effective_uom = product.uom or product.sale_uom or product.purchase_uom
            if product.track_inventory and not effective_uom:
                raise serializers.ValidationError(
                    f"El producto '{product.name}' requiere una Unidad de Medida (UoM) porque tiene activado 'Controlar Inventario'. "
                    f"Asigne una unidad o desactive el control de inventario en la ficha del producto."
                )
        return data

    def create(self, validated_data):
        from .services import BillOfMaterialsService

        return BillOfMaterialsService.create_bom(validated_data)

    def update(self, instance, validated_data):
        from .services import BillOfMaterialsService

        return BillOfMaterialsService.update_bom(instance, validated_data)
