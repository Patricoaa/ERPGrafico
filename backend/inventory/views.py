from rest_framework import viewsets, status, filters
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
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = ProductFilter
    search_fields = ['name', 'internal_code', 'code']

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
    def insights(self, request, pk=None):
        """
        Returns a unified view of product performance:
        1. Price/Cost History
        2. Stock Movements (Kardex)
        3. Sales Performance (Avg Price, Cost, Margin)
        4. Production Usage (OTs)
        """
        instance = self.get_object()
        
        # 1. Price History (Calculated from HistoricalRecords)
        history = instance.history.select_related('history_user').all().order_by('history_date')
        price_history = []
        last_sale = None
        last_cost = None
        for h in history:
            if h.sale_price != last_sale or h.cost_price != last_cost:
                price_history.append({
                    'date': h.history_date,
                    'sale_price': float(h.sale_price),
                    'cost_price': float(h.cost_price),
                    'user': h.history_user.username if h.history_user else "System"
                })
                last_sale = h.sale_price
                last_cost = h.cost_price
        price_history.reverse()

        # 2. Kardex (Recent Stock Moves)
        from inventory.models import StockMove
        moves = StockMove.objects.filter(product=instance).select_related('warehouse', 'uom').all().order_by('-date', '-id')[:50]
        kardex = [{
            'date': m.date,
            'type': m.move_type,
            'quantity': float(m.quantity),
            'warehouse': m.warehouse.name,
            'description': m.description,
            'uom': m.uom.name if m.uom else ""
        } for m in moves]

        # 3. Sales Analysis (from CONFIRMED deliveries)
        from sales.models import SaleDeliveryLine
        from django.db.models import Avg, Sum, F
        sales_stats = SaleDeliveryLine.objects.filter(
            product=instance, 
            delivery__status='CONFIRMED'
        ).aggregate(
            avg_price=Avg('unit_price'),
            avg_cost=Avg('unit_cost'),
            total_qty=Sum('quantity'),
            total_revenue=Sum(F('quantity') * F('unit_price')),
            total_cost_basis=Sum(F('quantity') * F('unit_cost'))
        )
        
        # 4. Production Analysis (Consumption in OTs)
        from production.models import ProductionConsumption
        consumptions = ProductionConsumption.objects.filter(
            product=instance
        ).select_related('work_order').all().order_by('-date')[:20]
        
        production_usage = [{
            'date': c.date,
            'ot_number': c.work_order.number,
            'quantity': float(c.quantity),
            'description': f"Consumo en OT-{c.work_order.number}"
        } for c in consumptions]

        return Response({
            'price_history': price_history,
            'kardex': kardex,
            'sales_analysis': {
                'avg_price': float(sales_stats['avg_price'] or 0),
                'avg_cost': float(sales_stats['avg_cost'] or 0),
                'total_sold': float(sales_stats['total_qty'] or 0),
                'total_revenue': float(sales_stats['total_revenue'] or 0),
                'total_cost_basis': float(sales_stats['total_cost_basis'] or 0),
            },
            'production_usage': production_usage
        })

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
        price_gross = PricingService.get_product_price(product, quantity, uom=uom)
        price_net = (price_gross / Decimal('1.19')).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
        
        return Response({
            'price': float(price_net),
            'price_gross': float(price_gross),
            'price_net': float(price_net)
        })

    @action(detail=False, methods=['post'])
    def check_availability(self, request):
        """
        Validates stock availability for multiple product lines.
        Checks both storable products and manufacturable products (including components).
        
        Request body:
        {
            "lines": [
                {"product_id": 123, "quantity": 10, "uom_id": 5},
                ...
            ]
        }
        
        Response:
        {
            "available": true/false,
            "details": [
                {
                    "product_id": 123,
                    "product_name": "Product A",
                    "requested_qty": 10,
                    "available_qty": 15,
                    "is_available": true,
                    "product_type": "STORABLE",
                    "missing_components": []
                },
                ...
            ]
        }
        """
        lines = request.data.get('lines', [])
        if not lines:
            return Response({'error': 'No lines provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        details = []
        all_available = True
        
        for line in lines:
            product_id = line.get('product_id')
            requested_qty = Decimal(str(line.get('quantity', 0)))
            uom_id = line.get('uom_id')
            
            try:
                product = Product.objects.get(pk=product_id)
            except Product.DoesNotExist:
                continue
            
            # Convert quantity to base UoM if needed
            if uom_id and product.uom_id != uom_id:
                try:
                    uom = UoM.objects.get(pk=uom_id)
                    # Convert to base UoM
                    requested_qty = requested_qty * uom.ratio
                except UoM.DoesNotExist:
                    pass
            
            line_detail = {
                'product_id': product.id,
                'product_name': product.name,
                'requested_qty': float(requested_qty),
                'product_type': product.product_type,
                'missing_components': []
            }
            
            # Check availability based on product type
            if product.product_type == Product.Type.STORABLE:
                available_qty = product.qty_available
                line_detail['available_qty'] = float(available_qty)
                line_detail['is_available'] = requested_qty <= available_qty
                
                if not line_detail['is_available']:
                    all_available = False
                    
            elif product.product_type == Product.Type.MANUFACTURABLE:
                if product.has_bom:
                    # Check if we can manufacture the requested quantity
                    manufacturable_qty = product.manufacturable_quantity or 0
                    line_detail['manufacturable_qty'] = float(manufacturable_qty)
                    line_detail['is_available'] = requested_qty <= manufacturable_qty
                    
                    if not line_detail['is_available']:
                        all_available = False
                        
                        # Get missing components details
                        from production.models import BillOfMaterials
                        try:
                            bom = BillOfMaterials.objects.get(product=product, active=True)
                            for component in bom.components.all():
                                comp_product = component.component
                                required_qty = component.quantity * requested_qty
                                available_qty = comp_product.qty_available
                                
                                if required_qty > available_qty:
                                    line_detail['missing_components'].append({
                                        'component_id': comp_product.id,
                                        'component_name': comp_product.name,
                                        'required_qty': float(required_qty),
                                        'available_qty': float(available_qty),
                                        'missing_qty': float(required_qty - available_qty)
                                    })
                        except BillOfMaterials.DoesNotExist:
                            pass
                else:
                    # No BOM = Express manufacturing, always available
                    line_detail['is_available'] = True
                    line_detail['manufacturable_qty'] = float('inf')
                    
            else:
                # SERVICE, CONSUMABLE, etc. - always available
                line_detail['is_available'] = True
                line_detail['available_qty'] = float('inf')
            
            details.append(line_detail)
        
        return Response({
            'available': all_available,
            'details': details
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

class PricingRuleViewSet(AuditHistoryMixin, viewsets.ModelViewSet):
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

class ReorderingRuleViewSet(AuditHistoryMixin, viewsets.ModelViewSet):
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
