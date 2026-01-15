from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .serializers import (
    ProductSerializer, ProductCategorySerializer, WarehouseSerializer, 
    StockMoveSerializer, UoMSerializer, UoMCategorySerializer, PricingRuleSerializer,
    CustomFieldTemplateSerializer, ProductCustomFieldSerializer, ReorderingRuleSerializer,
    ReplenishmentProposalSerializer, SubscriptionSerializer
)
from .models import (
    Product, ProductCategory, Warehouse, StockMove, UoM, UoMCategory, PricingRule,
    CustomFieldTemplate, ProductCustomField, ReorderingRule, ReplenishmentProposal, Subscription
)
from .services import StockService, ProcurementService
from django_filters.rest_framework import DjangoFilterBackend
from decimal import Decimal

from core.mixins import BulkImportMixin

from .filters import ProductFilter, StockMoveFilter

class ProductViewSet(BulkImportMixin, viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = ProductFilter

    def get_queryset(self):
        queryset = super().get_queryset()
        active_param = self.request.query_params.get('active')
        
        # Default behavior: Show only active products
        if active_param is None:
            return queryset.filter(active=True)
            
        # If active=all, show everything
        if active_param == 'all':
            return queryset
            
        # If active=false, show only archived
        if active_param == 'false':
            return queryset.filter(active=False)
            
        # If active=true (default explicit)
        return queryset.filter(active=True)

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
            stock_qty = p.stock_moves.aggregate(total=Sum('quantity'))['total'] or 0
            
            # Movements
            moves_in = p.stock_moves.filter(quantity__gt=0).aggregate(total=Sum('quantity'))['total'] or 0
            # moves_out should be positive for display, but moves have negative quantity
            moves_out = abs(p.stock_moves.filter(quantity__lt=0).aggregate(total=Sum('quantity'))['total'] or 0)
            
            report.append({
                'id': p.id,
                'code': p.code,
                'internal_code': p.internal_code,
                'name': p.name,
                'category_name': p.category.name,
                'uom_id': p.uom.id if p.uom else None,
                'uom_category_id': p.uom.category_id if p.uom else None,
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

    @action(detail=True, methods=['post'])
    def rotate_uom(self, request, pk=None):
        """
        Rotates the product's base UoM to the next one in the same category.
        Crucially, it converts all existing StockMove and BOM quantities 
        to maintain physical consistency.
        """
        from django.db import transaction, models
        from django.apps import apps
        from .models import UoM
        
        product = self.get_object()
        if not product.uom:
            return Response({'error': 'El producto no tiene unidad base.'}, status=400)

        # Get all active UoMs for the same category, sorted by ratio
        uoms = list(UoM.objects.filter(category=product.uom.category, active=True).order_by('ratio'))
        if len(uoms) <= 1:
            return Response({'error': 'No hay otras unidades en esta categoría.'}, status=400)

        try:
            current_index = uoms.index(product.uom)
            next_index = (current_index + 1) % len(uoms)
        except ValueError:
            next_index = 0

        new_uom = uoms[next_index]
        old_uom = product.uom
        
        # Conversion factor (physical amount remains same)
        # Formula: Factor = OldRatio / NewRatio
        factor = Decimal(str(old_uom.ratio)) / Decimal(str(new_uom.ratio))

        with transaction.atomic():
            # 1. Update stock moves
            product.stock_moves.update(quantity=models.F('quantity') * factor)
            
            # 2. Update prices (assuming they are "per base unit")
            if factor != 1:
                product.cost_price = (product.cost_price / factor).quantize(Decimal('0.01'), rounding='ROUND_HALF_UP')
                product.sale_price = (product.sale_price / factor).quantize(Decimal('0.01'), rounding='ROUND_HALF_UP')
            
            # 3. Update BOM lines where this is a component and used inherited UoM
            BOMLine = apps.get_model('production', 'BillOfMaterialsLine')
            BOMLine.objects.filter(component=product, uom__isnull=True).update(
                quantity=models.F('quantity') * factor
            )
            
            # 4. Update BOMs where this is the finished product
            # BOM lines are "per 1 unit" of the finished product.
            # If 1 Unit becomes 10 (G -> Kg), each line needs 1/10th for the same "physical unit"?
            # Wait, no. If the finished product is 1 Kg instead of 1 G, 
            # we need 1000x more of each component per finished unit.
            # So multiply line quantity by (1/factor).
            BOM = apps.get_model('production', 'BillOfMaterials')
            boms = BOM.objects.filter(product=product)
            for bom in boms:
                bom.lines.update(quantity=models.F('quantity') / factor)

            product.uom = new_uom
            product.save()

        return Response({
            'status': 'ok', 
            'new_uom': new_uom.name, 
            'conversion_factor': float(factor),
            'new_cost': float(product.cost_price)
        })

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer

class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer

class UoMViewSet(viewsets.ModelViewSet):
    queryset = UoM.objects.all()
    serializer_class = UoMSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category', 'active']

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
            adjustment_reason = request.data.get('adjustment_reason')
            uom_id = request.data.get('uom_id')

            product = Product.objects.get(pk=product_id)
            warehouse = Warehouse.objects.get(pk=warehouse_id)
            
            uom = None
            if uom_id:
                try:
                   uom = UoM.objects.get(pk=uom_id)
                except UoM.DoesNotExist:
                   pass

            move = StockService.adjust_stock(product, warehouse, quantity, unit_cost, description, adjustment_reason, uom=uom)
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

class ReorderingRuleViewSet(viewsets.ModelViewSet):
    queryset = ReorderingRule.objects.all()
    serializer_class = ReorderingRuleSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['product', 'warehouse', 'active']


class ReplenishmentProposalViewSet(viewsets.ModelViewSet):
    queryset = ReplenishmentProposal.objects.all()
    serializer_class = ReplenishmentProposalSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['product', 'warehouse', 'status']

    @action(detail=False, methods=['post'])
    def create_po(self, request):
        """
        Creates Purchase Orders from a list of proposal IDs.
        """
        proposal_ids = request.data.get('proposal_ids', [])
        if not proposal_ids:
            return Response({'error': 'No se proporcionaron IDs de propuestas.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            created_pos = ProcurementService.create_purchase_order_from_proposals(proposal_ids, user=request.user)
            from purchasing.serializers import PurchaseOrderSerializer
            return Response(PurchaseOrderSerializer(created_pos, many=True).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def ignore(self, request):
        """
        Marks proposals as ignored.
        """
        proposal_ids = request.data.get('proposal_ids', [])
        ReplenishmentProposal.objects.filter(id__in=proposal_ids).update(status=ReplenishmentProposal.Status.IGNORED)
        return Response({'status': 'ok'})


class SubscriptionViewSet(viewsets.ModelViewSet):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'product', 'supplier']
