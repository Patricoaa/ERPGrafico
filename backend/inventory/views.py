from decimal import Decimal

from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api.pagination import StandardResultsSetPagination
from core.mixins import AuditHistoryMixin as AuditHistory
from core.mixins import BulkImportMixin, NoDestroyModelMixin
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
from .services import StockService, UoMService, ProductService, PricingService


class ProductViewSet(NoDestroyModelMixin, BulkImportMixin, AuditHistory, viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = ProductFilter
    pagination_class = StandardResultsSetPagination
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

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        
        objects = page if page is not None else queryset
        
        from .services import ProductService
        ProductService.bulk_annotate_reserved_qty(objects)
        
        serializer = self.get_serializer(objects, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

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
        from core.api.throttles import HeavyReportThrottle
        from core.cache import cache_report
        from rest_framework.exceptions import Throttled

        if not HeavyReportThrottle().allow_request(request, self):
            raise Throttled(
                detail="Demasiadas solicitudes al reporte de stock. Intente en un momento."
            )

        data = cache_report(
            module="inventory",
            endpoint="stock_report",
            timeout=60,
            generator=get_stock_report_data,
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
        template = self.get_object()
        variant_ids = request.data.get("variant_ids", [])
        if not template.has_variants:
            return Response(
                {"error": "Este producto no es un template de variantes."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            result = ProductService.bulk_clone_bom(template, variant_ids or None)
            return Response(result)
        except Exception as e:
            msg = e.message if hasattr(e, "message") else str(e)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="bulk-set-surcharge")
    def bulk_set_surcharge(self, request, pk=None):
        template = self.get_object()
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
        updated = ProductService.bulk_set_surcharge(
            template, request.data.get("variant_ids", []), surcharge
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
        quantity = request.query_params.get("quantity", 1)
        uom_id = request.query_params.get("uom_id")
        data = PricingService.get_effective_price(product, quantity, uom_id)
        return Response(data)

    @action(detail=False, methods=["post"])
    def check_availability(self, request):
        """
        Validates stock availability for multiple product lines.
        Checks both storable products and manufacturable products (including components).
        """
        lines = request.data.get("lines", [])
        if not lines:
            return Response({"error": "No lines provided"}, status=status.HTTP_400_BAD_REQUEST)

        result = ProductService.check_availability(lines)
        return Response(result)


class ProductAttributeViewSet(NoDestroyModelMixin, viewsets.ModelViewSet, AuditHistory):
    queryset = ProductAttribute.objects.all()
    serializer_class = ProductAttributeSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["name"]


class ProductAttributeValueViewSet(NoDestroyModelMixin, viewsets.ModelViewSet, AuditHistory):
    queryset = ProductAttributeValue.objects.all()
    serializer_class = ProductAttributeValueSerializer
    filterset_fields = ["attribute"]


class CategoryViewSet(NoDestroyModelMixin, viewsets.ModelViewSet, AuditHistory):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer


class WarehouseViewSet(NoDestroyModelMixin, viewsets.ModelViewSet, AuditHistory):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer


class UoMViewSet(NoDestroyModelMixin, viewsets.ModelViewSet, AuditHistory):
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


class UoMCategoryViewSet(NoDestroyModelMixin, viewsets.ModelViewSet, AuditHistory):
    queryset = UoMCategory.objects.all()
    serializer_class = UoMCategorySerializer


class StockMoveViewSet(viewsets.ReadOnlyModelViewSet, AuditHistory):
    def get_queryset(self):
        return StockMove.objects.select_related(
            "product",
            "product__uom",
            "product__category",
            "uom",
            "warehouse",
            "journal_entry",
        ).all()
    serializer_class = StockMoveSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend]
    filterset_class = StockMoveFilter

    @action(detail=False, methods=["get"], url_path="stock-level")
    def stock_level(self, request):
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
        from django.core.exceptions import ValidationError

        try:
            move = StockService.adjust_stock_from_payload(request.data)
            return Response(StockMoveSerializer(move).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PricingRuleViewSet(NoDestroyModelMixin, AuditHistory, viewsets.ModelViewSet):
    queryset = PricingRule.objects.all()
    serializer_class = PricingRuleSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["product", "category", "active"]
    search_fields = ["name"]

class ProductUoMPriceViewSet(NoDestroyModelMixin, viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    serializer_class = ProductUoMPriceSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["product", "uom"]

    def get_queryset(self):
        return ProductUoMPrice.objects.select_related("uom").filter(product__is_active=True)
