from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .serializers import ProductSerializer, ProductCategorySerializer, WarehouseSerializer, StockMoveSerializer, ProductAttributeSerializer, ProductAttributeValueSerializer
from .models import Product, ProductCategory, Warehouse, StockMove, ProductAttribute, ProductAttributeValue
from .services import StockService
from decimal import Decimal
import itertools
from django.utils.text import slugify

from core.mixins import BulkImportMixin

class ProductViewSet(BulkImportMixin, viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    @action(detail=False, methods=['get'])
    def stock_report(self, request):
        """
        Returns a summary of stock per product.
        """
        from django.db.models import Sum, Q
        
        products = Product.objects.all().select_related('category')
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
                'stock_qty': float(stock_qty),
                'unit_cost': float(p.cost_price),
                'total_value': float(stock_qty * p.cost_price),
                'moves_in': float(moves_in),
                'moves_out': float(moves_out)
            })
            
        return Response(report)

    @action(detail=True, methods=['post'])
    def generate_variants(self, request, pk=None):
        parent = self.get_object()
        if parent.variant_of:
            return Response({"error": "No se pueden generar variantes de una variante"}, status=400)
            
        attributes = request.data.get('attributes', {})
        # attributes = {"Color": ["Rojo", "Azul"], "Talla": ["S", "M"]}
        
        if not attributes:
            return Response({"error": "Se requieren atributos"}, status=400)

        # Generate combinations
        keys = list(attributes.keys())
        values_list = [attributes[key] for key in keys]
        
        combinations = list(itertools.product(*values_list))
        
        variants_created = []
        
        for combination in combinations:
            attr_values_objs = []
            variant_name_suffix = []
            variant_code_suffix = []
            
            for i, value_str in enumerate(combination):
                attr_name = keys[i]
                attr, _ = ProductAttribute.objects.get_or_create(name=attr_name)
                val_obj, _ = ProductAttributeValue.objects.get_or_create(attribute=attr, value=value_str)
                attr_values_objs.append(val_obj)
                variant_name_suffix.append(value_str)
                variant_code_suffix.append(slugify(value_str)[:3].upper())
            
            variant_name = f"{parent.name} - {' '.join(variant_name_suffix)}"
            # Generate code: PARENT-COL-SIZ
            variant_code = f"{parent.code}-{''.join(variant_code_suffix)}"
            
            if Product.objects.filter(code=variant_code).exists():
                continue
                
            variant = Product.objects.create(
                name=variant_name,
                code=variant_code,
                category=parent.category,
                product_type=parent.product_type,
                sale_price=parent.sale_price,
                variant_of=parent
            )
            variant.attribute_values.set(attr_values_objs)
            variants_created.append(variant.code)
            
        return Response({"message": f"{len(variants_created)} variantes creadas", "variants": variants_created})

class ProductAttributeViewSet(viewsets.ModelViewSet):
    queryset = ProductAttribute.objects.all()
    serializer_class = ProductAttributeSerializer

class ProductAttributeValueViewSet(viewsets.ModelViewSet):
    queryset = ProductAttributeValue.objects.all()
    serializer_class = ProductAttributeValueSerializer

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer

class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer

class StockMoveViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockMove.objects.all()
    serializer_class = StockMoveSerializer

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
