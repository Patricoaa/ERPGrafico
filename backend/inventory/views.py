from decimal import Decimal

from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api.pagination import StandardResultsSetPagination
from core.mixins import AuditHistoryMixin as AuditHistory
from core.mixins import BulkImportMixin
from core.idempotency import idempotent_endpoint

from .filters import ProductFilter, StockMoveFilter, UoMFilter
from .models import (
    PricingRule,
    Product,
    ProductAttribute,
    ProductAttributeValue,
    ProductCategory,
    ProductFavorite,
    ProductUoMPrice,
    StockMove,
    Subscription,
    UoM,
    UoMCategory,
    Warehouse,
)
from .selectors import get_product_base_queryset, get_stock_report_data, list_products
from .serializers import (
    PricingRuleSerializer,
    ProductAttributeSerializer,
    ProductAttributeValueSerializer,
    ProductCategorySerializer,
    ProductSerializer,
    ProductSimpleSerializer,
    ProductUoMPriceSerializer,
    StockMoveSerializer,
    SubscriptionSerializer,
    UoMCategorySerializer,
    UoMSerializer,
    WarehouseSerializer,
)
from .services import StockService, UoMService


class ProductViewSet(BulkImportMixin, AuditHistory, viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = ProductFilter
    search_fields = ["name", "internal_code", "code"]

    def get_queryset(self):
        user = self.request.user
        if self.kwargs.get("pk") or self.action in [
            "retrieve",
            "update",
            "partial_update",
            "destroy",
        ]:
            return get_product_base_queryset(user=user)
        return list_products(user=user, params=self.request.query_params)

    @action(detail=False, methods=["get"], url_path="filter-suggestions")
    def filter_suggestions(self, request):
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response([])
        names = (
            Product.objects.filter(is_active=True, name__icontains=q)
            .values_list("name", flat=True)
            .distinct()
            .order_by("name")[:10]
        )
        return Response(list(names))

    @action(detail=True, methods=["post"])
    def toggle_favorite(self, request, pk=None):
        product = self.get_object()
        user = request.user
        if not user.is_authenticated:
            return Response(
                {"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED
            )

        favorite, created = ProductFavorite.objects.get_or_create(user=user, product=product)
        if not created:
            favorite.delete()
            return Response({"is_favorite": False})
        return Response({"is_favorite": True})

    def perform_update(self, serializer):
        serializer.save()

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        active_val = request.data.get("is_active")

        # If we are archiving (is_active: True -> False)
        if active_val is False and instance.is_active is True:
            from .services import ProductService

            restrictions = ProductService.check_archiving_restrictions(instance)
            if restrictions:
                return Response(
                    {
                        "error": "No se puede archivar el producto debido a dependencias activas.",
                        "restrictions": restrictions,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        return super().partial_update(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def stock_report(self, request):
        """
        Returns a summary of stock per product.
        Cached in Redis for 60s — invalidated by StockMove signal.
        """
        from core.api.throttles import HeavyReportThrottle
        from core.cache import cache_report

        # Apply heavy report throttle manually
        throttle = HeavyReportThrottle()
        if not throttle.allow_request(request, self):
            from rest_framework.exceptions import Throttled

            raise Throttled(
                detail="Demasiadas solicitudes al reporte de stock. Intente en un momento."
            )

        def _generate():
            return get_stock_report_data()

        data = cache_report(
            module="inventory",
            endpoint="stock_report",
            timeout=60,
            generator=_generate,
        )
        return Response(data)

    @action(detail=True, methods=["get"])
    def insights(self, request, pk=None):
        """
        Returns a unified view of product performance:
        1. Price/Cost History
        2. Stock Movements (Kardex)
        3. Sales Performance (Avg Price, Cost, Margin)
        4. Production Usage (OTs)
        """
        from .selectors import ProductSelector
        
        instance = self.get_object()
        data = ProductSelector.get_insights(instance)
        return Response(data)

    @action(detail=True, methods=["post"])
    def generate_variants(self, request, pk=None):
        from .services import ProductService
        from django.core.exceptions import ValidationError

        template = self.get_object()
        selection = request.data.get("selection", [])  # List of {attribute: id, values: [ids]}

        if not template.has_variants:
            return Response(
                {"error": "El producto no tiene activada la opción de variantes."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = ProductService.generate_variants(template, selection)
            return Response(result)
        except ValidationError as e:
            return Response({"error": str(e.message if hasattr(e, "message") else e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Error interno: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"], url_path="sync-variant-prices")
    def sync_variant_prices(self, request, pk=None):
        """Establece price_inheritance_mode=INHERIT en todas las variantes activas del template."""
        template = self.get_object()
        if not template.has_variants:
            return Response(
                {"error": "Este producto no es un template de variantes."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        updated = template.variants.filter(is_active=True).update(
            price_inheritance_mode=Product.PriceInheritance.INHERIT,
            price_surcharge=None,
        )
        return Response({"updated": updated})

    @action(detail=True, methods=["post"], url_path="bulk-clone-bom")
    def bulk_clone_bom(self, request, pk=None):
        """
        Clona la BOM activa del template a las variantes indicadas.
        Si variant_ids está vacío, aplica a todas las variantes activas.
        """
        from django.core.exceptions import ValidationError
        from .services import ProductService

        template = self.get_object()
        variant_ids = request.data.get("variant_ids", [])  # [] = todas

        if not template.has_variants:
            return Response(
                {"error": "Este producto no es un template de variantes."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = ProductService.bulk_clone_bom(template, variant_ids or None)
            return Response(result)
        except ValidationError as e:
            return Response(
                {"error": str(e.message if hasattr(e, "message") else e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"], url_path="bulk-set-surcharge")
    def bulk_set_surcharge(self, request, pk=None):
        """
        Asigna un sobrecargo a las variantes indicadas (o todas si variant_ids está vacío).
        Cambia el price_inheritance_mode a SURCHARGE y aplica el valor.
        """
        template = self.get_object()
        variant_ids = request.data.get("variant_ids", [])
        surcharge = request.data.get("surcharge")

        if surcharge is None:
            return Response(
                {"error": "Debe proporcionar el campo 'surcharge'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not template.has_variants:
            return Response(
                {"error": "Este producto no es un template de variantes."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from decimal import Decimal

        variants_qs = template.variants.filter(is_active=True)
        if variant_ids:
            variants_qs = variants_qs.filter(id__in=variant_ids)

        updated = variants_qs.update(
            price_inheritance_mode=Product.PriceInheritance.SURCHARGE,
            price_surcharge=Decimal(str(surcharge)),
        )
        return Response({"updated": updated})

    @action(detail=True, methods=["get"])
    def variants(self, request, pk=None):
        template = self.get_object()
        variants = template.variants.filter(is_active=True)
        serializer = ProductSimpleSerializer(variants, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def effective_price(self, request, pk=None):
        product = self.get_object()
        quantity = Decimal(request.query_params.get("quantity", 1))
        uom_id = request.query_params.get("uom_id")
        uom = None
        if uom_id:
            try:
                uom = UoM.objects.get(pk=uom_id)
            except UoM.DoesNotExist:
                pass

        from .services import PricingService

        price_gross = PricingService.get_product_price(product, quantity, uom=uom)
        from accounting.utils import get_vat_multiplier

        price_net = (price_gross / get_vat_multiplier()).quantize(
            Decimal("1"), rounding="ROUND_HALF_UP"
        )

        return Response(
            {
                "price": float(price_net),
                "price_gross": float(price_gross),
                "price_net": float(price_net),
            }
        )

    @action(detail=False, methods=["post"])
    def check_availability(self, request):
        """
        Validates stock availability for multiple product lines.
        Checks both storable products and manufacturable products (including components).
        """
        from .services import ProductService

        lines = request.data.get("lines", [])
        if not lines:
            return Response({"error": "No lines provided"}, status=status.HTTP_400_BAD_REQUEST)

        result = ProductService.check_availability(lines)
        return Response(result)


class ProductAttributeViewSet(viewsets.ModelViewSet, AuditHistory):
    queryset = ProductAttribute.objects.all()
    serializer_class = ProductAttributeSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["name"]


class ProductAttributeValueViewSet(viewsets.ModelViewSet, AuditHistory):
    queryset = ProductAttributeValue.objects.all()
    serializer_class = ProductAttributeValueSerializer
    filterset_fields = ["attribute"]


class CategoryViewSet(viewsets.ModelViewSet, AuditHistory):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer


class WarehouseViewSet(viewsets.ModelViewSet, AuditHistory):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer


class UoMViewSet(viewsets.ModelViewSet, AuditHistory):
    queryset = UoM.objects.all()
    serializer_class = UoMSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = UoMFilter
    search_fields = ["name", "abbreviation"]

    @action(detail=False, methods=["get"])
    def allowed(self, request):
        """
        Returns allowed UoMs for a specific product and context.
        Query params: product_id (required), context (optional, default 'sale')
        """
        product_id = request.query_params.get("product_id")
        context = request.query_params.get("context", "sale")

        if not product_id:
            return Response({"error": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        product = get_object_or_404(Product, id=product_id)

        try:
            queryset = UoMService.get_allowed_uoms_for_context(product, context)
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class UoMCategoryViewSet(viewsets.ModelViewSet, AuditHistory):
    queryset = UoMCategory.objects.all()
    serializer_class = UoMCategorySerializer


class StockMoveViewSet(viewsets.ReadOnlyModelViewSet, AuditHistory):
    queryset = StockMove.objects.all()
    serializer_class = StockMoveSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend]
    filterset_class = StockMoveFilter

    @action(detail=False, methods=["get"], url_path="stock-level")
    def stock_level(self, request):
        """
        Aggregated stock for (product, warehouse) computed at DB level.
        Replaces the previous client-side pattern of fetching all moves and
        summing in JS — that pattern silently truncated to one page (≤50
        rows) once the viewset adopted pagination, producing wrong stock
        figures for any product with a long move history.
        """
        from django.db.models import Sum

        product_id = request.query_params.get("product_id")
        warehouse_id = request.query_params.get("warehouse_id")
        if not product_id or not warehouse_id:
            return Response(
                {"detail": "product_id and warehouse_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        total = StockMove.objects.filter(
            product_id=product_id,
            warehouse_id=warehouse_id,
        ).aggregate(total=Sum("quantity"))["total"] or Decimal("0.0")
        return Response({"stock_level": str(total)})

    @idempotent_endpoint(scope="inventory.move.create")
    @action(detail=False, methods=["post"])
    def adjust(self, request):
        """
        Custom endpoint to perform manual stock adjustment.
        Supports partner_contact_id for PARTNER_CONTRIBUTION/PARTNER_WITHDRAWAL reasons.
        """
        try:
            product_id = request.data.get("product_id")
            warehouse_id = request.data.get("warehouse_id")
            quantity = Decimal(str(request.data.get("quantity")))
            unit_cost = Decimal(str(request.data.get("unit_cost", 0)))
            description = request.data.get("description", "Manual Adjustment")
            adjustment_reason = request.data.get("adjustment_reason")
            uom_id = request.data.get("uom_id")
            partner_contact_id = request.data.get("partner_contact_id")

            product = Product.objects.get(pk=product_id)
            warehouse = Warehouse.objects.get(pk=warehouse_id)

            uom = None
            if uom_id:
                try:
                    uom = UoM.objects.get(pk=uom_id)
                except UoM.DoesNotExist:
                    pass

            # Resolve partner contact for partner-related adjustments
            partner_contact = None
            partner_reasons = [
                StockMove.AdjustmentReason.PARTNER_CONTRIBUTION,
                StockMove.AdjustmentReason.PARTNER_WITHDRAWAL,
            ]
            if adjustment_reason in partner_reasons:
                if not partner_contact_id:
                    return Response(
                        {
                            "error": "Debe seleccionar un socio para aportes o retiros de capital en inventario."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                from contacts.models import Contact

                try:
                    partner_contact = Contact.objects.get(pk=partner_contact_id)
                except Contact.DoesNotExist:
                    return Response(
                        {"error": "Socio no encontrado."}, status=status.HTTP_400_BAD_REQUEST
                    )
                if not partner_contact.is_partner:
                    return Response(
                        {"error": "El contacto seleccionado no es un socio."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            move = StockService.adjust_stock(
                product,
                warehouse,
                quantity,
                unit_cost,
                description,
                adjustment_reason,
                uom=uom,
                partner_contact=partner_contact,
            )
            return Response(StockMoveSerializer(move).data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PricingRuleViewSet(AuditHistory, viewsets.ModelViewSet):
    queryset = PricingRule.objects.all()
    serializer_class = PricingRuleSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["product", "category", "active"]
    search_fields = ["name"]


class SubscriptionViewSet(viewsets.ModelViewSet):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["status", "product", "supplier"]
    search_fields = ["product__name", "supplier__name", "supplier__tax_id"]

    def get_queryset(self):
        """
        Only show subscriptions for products that are currently active (not archived).
        """
        return super().get_queryset().filter(product__is_active=True)

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        sub = self.get_object()
        sub.status = Subscription.Status.PAUSED
        sub.save()
        return Response({"status": "paused"})

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        sub = self.get_object()
        sub.status = Subscription.Status.ACTIVE
        sub.save()
        return Response({"status": "active"})


class ProductUoMPriceViewSet(viewsets.ModelViewSet):
    serializer_class = ProductUoMPriceSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["product", "uom"]

    def get_queryset(self):
        return ProductUoMPrice.objects.select_related("uom").filter(product__is_active=True)
