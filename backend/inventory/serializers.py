import logging

from rest_framework import serializers
from rest_framework.fields import empty

logger = logging.getLogger(__name__)

from core.serializers import AttachmentSerializer


from .models import (
    PricingRule,
    Product,
    ProductAttribute,
    ProductAttributeValue,
    ProductCategory,
    ProductUoMPrice,
    StockMove,
    Subscription,
    UoM,
    UoMCategory,
    Warehouse,
)
from .services import ProductService


class ProductUoMPriceSerializer(serializers.ModelSerializer):
    uom_name = serializers.CharField(source="uom.name", read_only=True)

    class Meta:
        model = ProductUoMPrice
        fields = ["id", "uom", "uom_name", "price_net", "price_gross"]


class ProductAttributeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductAttribute
        fields = ["id", "name", "created_at"]


class ProductAttributeValueSerializer(serializers.ModelSerializer):
    attribute_name = serializers.CharField(source="attribute.name", read_only=True)

    class Meta:
        model = ProductAttributeValue
        fields = ["id", "attribute", "attribute_name", "value"]


class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = [
            "id",
            "name",
            "prefix",
            "icon",
            "parent",
            "asset_account",
            "income_account",
            "expense_account",
        ]


class UoMCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = UoMCategory
        fields = "__all__"


class UoMSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = UoM
        fields = "__all__"


class PricingRuleSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)
    product_code = serializers.CharField(source="product.code", read_only=True)
    product_internal_code = serializers.CharField(source="product.internal_code", read_only=True)
    rule_type_display = serializers.CharField(source="get_rule_type_display", read_only=True)
    operator_display = serializers.CharField(source="get_operator_display", read_only=True)

    class Meta:
        model = PricingRule
        fields = "__all__"

    def validate(self, data):
        product = data.get("product") or getattr(self.instance, "product", None)
        if product and product.is_dynamic_pricing:
            raise serializers.ValidationError(
                {
                    "product": "No se pueden crear ni aplicar reglas de precio a un producto con precio dinámico."
                }
            )
        return data


class SubscriptionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_code = serializers.CharField(source="product.code", read_only=True)
    product_internal_code = serializers.CharField(source="product.internal_code", read_only=True)
    category_name = serializers.CharField(source="product.category.name", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    recurrence_display = serializers.CharField(
        source="get_recurrence_period_display", read_only=True
    )

    class Meta:
        model = Subscription
        fields = [
            "id",
            "product",
            "supplier",
            "product_name",
            "product_code",
            "product_internal_code",
            "category_name",
            "supplier_name",
            "start_date",
            "end_date",
            "next_payment_date",
            "amount",
            "currency",
            "status",
            "status_display",
            "notes",
            "recurrence_period",
            "recurrence_display",
            "created_at",
            "updated_at",
        ]


class ProductSimpleSerializer(serializers.ModelSerializer):
    """Simplified product serializer for nested lists to avoid recursion"""

    attribute_values_data = ProductAttributeValueSerializer(
        source="attribute_values", many=True, read_only=True
    )
    is_favorite = serializers.SerializerMethodField()

    def get_is_favorite(self, obj):
        return getattr(obj, "is_favorite", False)

    uom_name = serializers.CharField(source="uom.name", read_only=True)
    uom_category = serializers.SerializerMethodField()
    image_thumbnail = serializers.SerializerMethodField()

    def get_uom_category(self, obj):
        if not obj.uom:
            return None
        return obj.uom.category_id

    def get_image_thumbnail(self, obj):
        if obj.image and hasattr(obj, "image_thumbnail"):
            try:
                return (
                    self.context["request"].build_absolute_uri(obj.image_thumbnail.url)
                    if self.context.get("request")
                    else obj.image_thumbnail.url
                )
            except Exception:
                return None
        return None

    class Meta:
        model = Product
        fields = [
            "id",
            "internal_code",
            "name",
            "variant_display_name",
            "sale_price",
            "cost_price",
            "is_favorite",
            "is_active",
            "attribute_values",
            "attribute_values_data",
            "product_type",
            "requires_advanced_manufacturing",
            "uom",
            "uom_name",
            "uom_category",
            "image",
            "image_thumbnail",
        ]


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)
    uom_category = serializers.SerializerMethodField()
    sale_uom_name = serializers.CharField(source="sale_uom.name", read_only=True)
    purchase_uom_name = serializers.CharField(source="purchase_uom.name", read_only=True)
    receiving_warehouse_name = serializers.CharField(
        source="receiving_warehouse.name", read_only=True
    )
    subscription_supplier_name = serializers.CharField(
        source="subscription_supplier.name", read_only=True
    )
    preferred_supplier_name = serializers.CharField(
        source="preferred_supplier.name", read_only=True
    )
    is_favorite = serializers.SerializerMethodField()

    def get_is_favorite(self, obj):
        return getattr(obj, "is_favorite", False)

    def get_uom_category(self, obj):
        if not obj.uom:
            return None
        return obj.uom.category_id

    # Variants fields
    variants = serializers.SerializerMethodField()
    variants_count = serializers.IntegerField(read_only=True)
    attribute_values_data = ProductAttributeValueSerializer(
        source="attribute_values", many=True, read_only=True
    )

    current_stock = serializers.SerializerMethodField()
    effective_price = serializers.SerializerMethodField()
    effective_price_net = serializers.SerializerMethodField()
    last_purchase_price = serializers.SerializerMethodField()
    manufacturable_quantity = serializers.SerializerMethodField()
    bom_cost = serializers.SerializerMethodField()

    # BOM validation fields
    has_active_bom = serializers.SerializerMethodField()
    active_bom_id = serializers.SerializerMethodField()
    requires_bom_validation = serializers.SerializerMethodField()

    qty_reserved = serializers.SerializerMethodField()
    qty_available = serializers.SerializerMethodField()

    # UoM-specific prices
    uom_prices = ProductUoMPriceSerializer(many=True, required=False)

    # Manufacturing fields: Support multiple BOMs
    boms = serializers.SerializerMethodField()
    attachments = AttachmentSerializer(many=True, read_only=True)
    available_uoms = serializers.SerializerMethodField()
    variant_generation_selection = serializers.JSONField(write_only=True, required=False)

    image_thumbnail = serializers.SerializerMethodField()
    image_catalog = serializers.SerializerMethodField()

    def get_image_thumbnail(self, obj):
        if obj.image and hasattr(obj, "image_thumbnail"):
            try:
                return (
                    self.context["request"].build_absolute_uri(obj.image_thumbnail.url)
                    if self.context.get("request")
                    else obj.image_thumbnail.url
                )
            except Exception:
                return None
        return None

    def get_image_catalog(self, obj):
        if obj.image and hasattr(obj, "image_catalog"):
            try:
                return (
                    self.context["request"].build_absolute_uri(obj.image_catalog.url)
                    if self.context.get("request")
                    else obj.image_catalog.url
                )
            except Exception:
                return None
        return None

    def get_boms(self, obj):
        from production.serializers import BillOfMaterialsSerializer

        return BillOfMaterialsSerializer(obj.boms.all(), many=True).data

    class Meta:
        model = Product
        fields = [
            "id",
            "internal_code",
            "code",
            "name",
            "category",
            "product_type",
            "image",
            "image_thumbnail",
            "image_catalog",
            "has_bom",
            "requires_advanced_manufacturing",
            "mfg_auto_finalize",
            "mfg_enable_prepress",
            "mfg_enable_press",
            "mfg_enable_postpress",
            "mfg_prepress_design",
            "mfg_prepress_specs",
            "mfg_prepress_folio",
            "mfg_press_offset",
            "mfg_press_digital",
            "mfg_press_special",
            "mfg_postpress_finishing",
            "mfg_postpress_binding",
            "recurrence_period",
            "renewal_notice_days",
            "is_variable_amount",
            "is_dynamic_pricing",
            "track_inventory",
            "can_be_sold",
            "can_be_purchased",
            "uom",
            "sale_uom",
            "purchase_uom",
            "allowed_sale_uoms",
            "receiving_warehouse",
            "sale_price",
            "sale_price_gross",
            "cost_price",
            "is_favorite",
            "is_active",
            "price_inheritance_mode",
            "price_surcharge",
            "effective_price_net",
            "uom_prices",
            "preferred_supplier",
            "preferred_supplier_name",
            "category_name",
            "uom_name",
            "uom_category",
            "sale_uom_name",
            "purchase_uom_name",
            "receiving_warehouse_name",
            "current_stock",
            "effective_price",
            "last_purchase_price",
            "manufacturable_quantity",
            "bom_cost",
            "qty_reserved",
            "qty_available",
            "boms",
            # Subscription Fields
            "subscription_supplier",
            "subscription_supplier_name",
            "subscription_amount",
            "subscription_start_date",
            "auto_activate_subscription",
            "default_invoice_type",
            "is_indefinite",
            "contract_end_date",
            "payment_day_type",
            "payment_day",
            "payment_interval_days",
            "attachments",
            "available_uoms",
            # Variant Fields
            "has_variants",
            "variants_count",
            "parent_template",
            "attribute_values",
            "attribute_values_data",
            "variant_display_name",
            "variants",
            "variant_generation_selection",
            # BOM validation fields
            "has_active_bom",
            "active_bom_id",
            "requires_bom_validation",
        ]

    def get_variants(self, obj):
        # Use prefetched variants if available to avoid N+1 queries
        if (
            hasattr(obj, "_prefetched_objects_cache")
            and "variants" in obj._prefetched_objects_cache
        ):
            variants = [v for v in obj.variants.all() if v.is_active]
        else:
            variants = obj.variants.filter(is_active=True)

        return ProductSimpleSerializer(variants, many=True).data

    def to_internal_value(self, data):
        from .validators import ProductValidator
        ret = ProductValidator.parse_request_data(data)
        return super().to_internal_value(ret)

    def get_current_stock(self, obj):
        return float(getattr(obj, "annotated_current_stock", None) or 0.0)

    def get_effective_price(self, obj):
        if hasattr(obj, "annotated_effective_price"):
            return float(obj.annotated_effective_price)
        from .services import PricingService

        return PricingService.get_product_price(obj, 1)

    def get_effective_price_net(self, obj):
        if hasattr(obj, "annotated_effective_price_net"):
            return float(obj.annotated_effective_price_net)
        from .services import PricingService

        if obj.parent_template_id:
            net, _ = PricingService.resolve_variant_price(obj)
            return net
        return obj.sale_price

    def get_qty_reserved(self, obj):
        if hasattr(obj, "annotated_qty_reserved"):
            return float(obj.annotated_qty_reserved)
        request = self.context.get("request")
        exclude_id = request.query_params.get("exclude_draft_id") if request else None
        return float(obj.get_qty_reserved(exclude_id))

    def get_qty_available(self, obj):
        if hasattr(obj, "annotated_qty_reserved") and hasattr(obj, "annotated_current_stock"):
            return float(obj.annotated_current_stock or 0.0) - float(obj.annotated_qty_reserved)
            
        request = self.context.get("request")
        exclude_id = request.query_params.get("exclude_draft_id") if request else None
        return float(obj.get_qty_available(exclude_id))

    def get_last_purchase_price(self, obj):
        # Si el selector anotó last_purchase_price, usarlo directamente (sin query)
        if hasattr(obj, "annotated_last_purchase_price"):
            v = obj.annotated_last_purchase_price
            return float(v) if v is not None else 0.0
        return 0.0


    def get_manufacturable_quantity(self, obj):
        """Return the calculated manufacturable quantity for MANUFACTURABLE products."""
        qty = obj.get_manufacturable_quantity()
        return float(qty) if qty is not None else None

    def get_bom_cost(self, obj):
        """Returns the total cost from the active BoM."""
        return float(obj.get_bom_cost())

    def get_has_active_bom(self, obj):
        return obj.has_active_bom()

    def get_active_bom_id(self, obj):
        # Use prefetched cache to avoid extra query per product
        if hasattr(obj, "_prefetched_objects_cache") and "boms" in obj._prefetched_objects_cache:
            active_bom = next((bom for bom in obj.boms.all() if bom.active), None)
        else:
            active_bom = obj.boms.filter(active=True).first()
        return active_bom.id if active_bom else None

    def get_requires_bom_validation(self, obj):
        return obj.requires_bom_validation

    def get_available_uoms(self, obj):
        if not obj.uom:
            return []
        from .services import UoMService

        uoms = UoMService.get_allowed_uoms_for_context(obj, "sale")
        return UoMSerializer(uoms, many=True).data

    def validate(self, data):
        from .validators import ProductValidator
        return ProductValidator.validate(data)

    def run_validation(self, data=empty):
        try:
            return super().run_validation(data)
        except serializers.ValidationError as e:
            logger.error(f"Validation error in ProductSerializer: {e.detail}. Data: {data}")
            raise e

    def create(self, validated_data):
        return ProductService.create_product(validated_data)

    def update(self, instance, validated_data):
        return ProductService.update_product(instance, validated_data)




class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = "__all__"



class StockMoveSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_code = serializers.CharField(source="product.code", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    product_internal_code = serializers.CharField(source="product.internal_code", read_only=True)
    product_code = serializers.CharField(source="product.code", read_only=True)
    move_type_display = serializers.CharField(source="get_move_type_display", read_only=True)
    journal_entry_number = serializers.CharField(
        source="journal_entry.number", read_only=True, allow_null=True
    )
    reference_code = serializers.SerializerMethodField()
    related_documents = serializers.SerializerMethodField()
    reference = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()

    class Meta:
        model = StockMove
        fields = "__all__"

    def validate(self, data):
        product = data.get("product")
        if product and not product.uom:
            raise serializers.ValidationError(
                f"El producto '{product.name}' no tiene una Unidad de Medida (UoM) asignada."
            )
        return data

    def get_related_documents(self, obj):
        from .selectors import StockMoveSelector
        return StockMoveSelector.get_related_documents(obj)

    def get_reference_code(self, obj):
        from core.prefix_registry import EntityPrefix
        return f"{EntityPrefix.STOCK_MOVE}-{obj.id}"

    def get_reference(self, obj):
        # 1. Purchase Receipt
        if hasattr(obj, "purchase_receipt_line"):
            receipt = getattr(obj.purchase_receipt_line, "receipt", None)
            return receipt.delivery_reference if receipt else None

        # 2. Sale Delivery
        if hasattr(obj, "sale_delivery_line"):
            delivery = getattr(obj.sale_delivery_line, "delivery", None)
            if delivery:
                from core.prefix_registry import EntityPrefix
                return f"{EntityPrefix.SALE_DELIVERY}-{delivery.number}"

        return None

    def get_notes(self, obj):
        # 1. Purchase Receipt
        if hasattr(obj, "purchase_receipt_line"):
            receipt = getattr(obj.purchase_receipt_line, "receipt", None)
            return receipt.notes if receipt else None

        # 2. Sale Delivery
        if hasattr(obj, "sale_delivery_line"):
            delivery = getattr(obj.sale_delivery_line, "delivery", None)
            return delivery.notes if delivery else None

        return None
