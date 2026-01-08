from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .serializers import (
    ProductSerializer, ProductCategorySerializer, WarehouseSerializer, 
    StockMoveSerializer, UoMSerializer, UoMCategorySerializer, PricingRuleSerializer,
    CustomFieldTemplateSerializer, ProductCustomFieldSerializer
)
from .models import (
    Product, ProductCategory, Warehouse, StockMove, UoM, UoMCategory, PricingRule,
    CustomFieldTemplate, ProductCustomField
)
from .services import StockService
from django_filters.rest_framework import DjangoFilterBackend
from decimal import Decimal

from core.mixins import BulkImportMixin

from .filters import ProductFilter, StockMoveFilter

class ProductViewSet(BulkImportMixin, viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = ProductFilter

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=False, methods=['get'])
    def stock_report(self, request):
        """
        Returns a summary of stock per product.
        """
        from django.db.models import Sum, Q
        
        products = Product.objects.filter(
            product_type__in=[Product.Type.STORABLE, Product.Type.CONSUMABLE]
        ).select_related('category')
        report = []
        
        for p in products:
            # Current stock is sum of all moves
            stock_qty = p.moves.aggregate(total=Sum('quantity'))['total'] or 0
            
            # Movements
            moves_in = p.moves.filter(quantity__gt=0).aggregate(total=Sum('quantity'))['total'] or 0
            # moves_out should be positive for display, but moves have negative quantity
            moves_out = abs(p.moves.filter(quantity__lt=0).aggregate(total=Sum('quantity'))['total'] or 0)
            
            report.append({
                'id': p.id,
                'code': p.code,
                'name': p.name,
                'category_name': p.category.name,
                'uom_name': p.uom.name if p.uom else '',
                'stock_qty': float(stock_qty),
                'unit_cost': float(p.cost_price),
                'total_value': float(stock_qty * p.cost_price),
                'moves_in': float(moves_in),
                'moves_out': float(moves_out)
            })
            
        return Response(report)

    @action(detail=True, methods=['get'])
    def effective_price(self, request, pk=None):
        product = self.get_object()
        quantity = Decimal(request.query_params.get('quantity', 1))
        uom_id = request.query_params.get('uom_id')
        uom = None
        if uom_id:
            try:
                uom = UoM.objects.get(pk=uom_id)
            except UoM.DoesNotExist:
                pass
        
        from .services import PricingService
        price = PricingService.get_product_price(product, quantity, uom=uom)
        return Response({'price': price})

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer

class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer

class UoMViewSet(viewsets.ModelViewSet):
    queryset = UoM.objects.all()
    serializer_class = UoMSerializer

class UoMCategoryViewSet(viewsets.ModelViewSet):
    queryset = UoMCategory.objects.all()
    serializer_class = UoMCategorySerializer

class StockMoveViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockMove.objects.all()
    serializer_class = StockMoveSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = StockMoveFilter

    @action(detail=False, methods=['post'])
    def adjust(self, request):
        """
        Custom endpoint to perform manual stock adjustment
        """
        try:
            product_id = request.data.get('product_id')
            warehouse_id = request.data.get('warehouse_id')
            quantity = Decimal(str(request.data.get('quantity')))
            unit_cost = Decimal(str(request.data.get('unit_cost', 0)))
            description = request.data.get('description', 'Manual Adjustment')

            product = Product.objects.get(pk=product_id)
            warehouse = Warehouse.objects.get(pk=warehouse_id)

            move = StockService.adjust_stock(product, warehouse, quantity, unit_cost, description)
            return Response(StockMoveSerializer(move).data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class PricingRuleViewSet(viewsets.ModelViewSet):
    queryset = PricingRule.objects.all()
    serializer_class = PricingRuleSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['product', 'category', 'active']

class CustomFieldTemplateViewSet(viewsets.ModelViewSet):
    queryset = CustomFieldTemplate.objects.all()
    serializer_class = CustomFieldTemplateSerializer

class ProductCustomFieldViewSet(viewsets.ModelViewSet):
    queryset = ProductCustomField.objects.all()
    serializer_class = ProductCustomFieldSerializer
    filterset_fields = ['product']

