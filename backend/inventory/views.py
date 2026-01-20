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
from core.views import AuditHistoryMixin

from .filters import ProductFilter, StockMoveFilter

class ProductViewSet(BulkImportMixin, AuditHistoryMixin, viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = ProductFilter

    def get_queryset(self):
        queryset = Product.objects.all()
        
        # If it's a detail request (requesting a single object by ID), 
        # we MUST return the full queryset to avoid 404s on archived products.
        if self.kwargs.get('pk') or self.action in ['retrieve', 'update', 'partial_update', 'destroy']:
            return queryset

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

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        active_val = request.data.get('active')
        
        # If we are archiving (active: True -> False)
        if active_val is False and instance.active is True:
            from .services import ProductService
            restrictions = ProductService.check_archiving_restrictions(instance)
            if restrictions:
                return Response({
                    'error': 'No se puede archivar el producto debido a dependencias activas.',
                    'restrictions': restrictions
                }, status=status.HTTP_400_BAD_REQUEST)
                
        return super().partial_update(request, *args, **kwargs)

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
                'moves_out': float(moves_out),
                'qty_reserved': float(p.qty_reserved),
                'qty_available': float(p.qty_available)
            })
            
        return Response(report)

    @action(detail=True, methods=['get'])
    def price_history(self, request, pk=None):
        """
        Returns history filtered only for sale_price and cost_price changes.
        """
        instance = self.get_object()
        history = instance.history.select_related('history_user').all().order_by('history_date')
        
        results = []
        last_sale = None
        last_cost = None
        
        for h in history:
            # Check if this record changed prices vs the previous one in the loop
            if h.sale_price != last_sale or h.cost_price != last_cost:
                results.append({
                    'history_date': h.history_date,
                    'history_user': h.history_user.username if h.history_user else "System",
                    'sale_price': float(h.sale_price),
                    'cost_price': float(h.cost_price),
                    'old_sale_price': float(last_sale) if last_sale is not None else None,
                    'old_cost_price': float(last_cost) if last_cost is not None else None,
                    'history_type': h.history_type
                })
                last_sale = h.sale_price
                last_cost = h.cost_price
        
        results.reverse() # Most recent first
        return Response(results)

    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        """
        Comprehensive timeline of stock moves, price changes and events.
        """
        from django.db.models import Sum
        from collections import defaultdict
        
        product = self.get_object()
        
        # 1. Fetch Price History
        history = product.history.select_related('history_user').all().order_by('history_date')
        
        # 2. Fetch Stock Moves
        moves = product.stock_moves.select_related('journal_entry').all().order_by('date', 'created_at')
        
        # 3. Build Timeline Data Structure
        # We'll use dates as keys
        timeline_map = defaultdict(lambda: {
            'sale_price': None, # Carry forward
            'cost_price': None, # Carry forward
            'stock_delta': 0,
            'in_qty': 0,
            'out_qty': 0,
            'events': []
        })
        
        # Process Price Events
        for h in history:
            d = h.history_date.date()
            timeline_map[d]['sale_price'] = float(h.sale_price)
            timeline_map[d]['cost_price'] = float(h.cost_price)
            timeline_map[d]['events'].append({
                'type': 'price_change',
                'user': h.history_user.username if h.history_user else "System",
                'sale_price': float(h.sale_price),
                'cost_price': float(h.cost_price),
                'history_type': h.history_type
            })
            
        # Process Stock Events
        for m in moves:
            d = m.date
            qty = float(m.quantity)
            timeline_map[d]['stock_delta'] += qty
            if qty > 0:
                timeline_map[d]['in_qty'] += qty
            else:
                timeline_map[d]['out_qty'] += abs(qty)
                
            timeline_map[d]['events'].append({
                'type': 'stock_move',
                'qty': qty,
                'move_type': m.move_type,
                'description': m.description,
                'reference': m.journal_entry.reference if m.journal_entry else None
            })
            
        # 4. Sort dates and fill gaps / calculate cumulative stock
        sorted_dates = sorted(timeline_map.keys())
        if not sorted_dates:
            return Response([])
            
        result = []
        cumulative_stock = 0.0
        last_sale_price = 0.0
        last_cost_price = 0.0
        
        for d in sorted_dates:
            data = timeline_map[d]
            
            # Carry forward prices if not set on this date
            if data['sale_price'] is not None:
                last_sale_price = data['sale_price']
            if data['cost_price'] is not None:
                last_cost_price = data['cost_price']
                
            cumulative_stock += data['stock_delta']
            
            result.append({
                'date': d.isoformat(),
                'sale_price': last_sale_price,
                'cost_price': last_cost_price,
                'stock_level': cumulative_stock,
                'in_qty': data['in_qty'],
                'out_qty': data['out_qty'],
                'events': data['events']
            })
            
        return Response(result)

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

class StockMoveViewSet(viewsets.ReadOnlyModelViewSet, AuditHistoryMixin):
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
    def run_planifier(self, request):
        """
        Runs the replenishment planifier for all active storable products.
        """
        from .models import Product, Warehouse
        products = Product.objects.filter(
            active=True, 
            product_type__in=[Product.Type.STORABLE, Product.Type.CONSUMABLE],
            track_inventory=True
        )
        warehouses = Warehouse.objects.all()
        
        count = 0
        for warehouse in warehouses:
            for product in products:
                proposal = ProcurementService.check_replenishment(product, warehouse)
                if proposal:
                    count += 1
                    
        return Response({'status': 'ok', 'proposals_created_or_updated': count})

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

    def get_queryset(self):
        """
        Only show subscriptions for products that are currently active (not archived).
        """
        return super().get_queryset().filter(product__active=True)

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        sub = self.get_object()
        sub.status = Subscription.Status.PAUSED
        sub.save()
        return Response({'status': 'paused'})

    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        sub = self.get_object()
        sub.status = Subscription.Status.ACTIVE
        sub.save()
        return Response({'status': 'active'})
