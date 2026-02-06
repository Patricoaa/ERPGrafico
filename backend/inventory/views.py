from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from .serializers import (
    ProductSerializer, ProductCategorySerializer, WarehouseSerializer, 
    StockMoveSerializer, UoMSerializer, UoMCategorySerializer, PricingRuleSerializer,
    CustomFieldTemplateSerializer, ProductCustomFieldSerializer, ReorderingRuleSerializer,
    ReplenishmentProposalSerializer, SubscriptionSerializer,
    ProductAttributeSerializer, ProductAttributeValueSerializer
)
from .models import (
    Product, ProductCategory, Warehouse, StockMove, UoM, UoMCategory, PricingRule,
    CustomFieldTemplate, ProductCustomField, ReorderingRule, ReplenishmentProposal, Subscription,
    ProductAttribute, ProductAttributeValue
)
from django.shortcuts import get_object_or_404
from .services import StockService, ProcurementService, UoMService
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
        from django.db.models import Sum
        queryset = Product.objects.select_related(
            'category', 'uom', 'sale_uom', 'purchase_uom', 
            'receiving_warehouse', 'preferred_supplier', 'subscription_supplier'
        ).prefetch_related(
            'attribute_values', 
            'attribute_values__attribute',
            'allowed_sale_uoms',
            'product_custom_fields',
            'reordering_rules',
            'attachments'
        ).annotate(
            annotated_current_stock=Sum('stock_moves__quantity')
        )
        
        # If it's a detail request (requesting a single object by ID), 
        # we MUST return the full queryset to avoid 404s on archived products.
        if self.kwargs.get('pk') or self.action in ['retrieve', 'update', 'partial_update', 'destroy']:
            return queryset

        active_param = self.request.query_params.get('active')
        
        # Filter by active status
        if active_param == 'all':
            pass # Show all
        elif active_param == 'false':
            queryset = queryset.filter(active=False)
        else:
            # Default behavior: Show only active products (active=true or active is None)
            queryset = queryset.filter(active=True)

        # Variant filtering logic
        # 1. If parent_template__isnull is explicitly provided in query_params, 
        #    we let DjangoFilterBackend handle it (it will be applied after get_queryset).
        # 2. If NOT provided, we apply the default behavior of hiding technical variants.
        if 'parent_template__isnull' not in self.request.query_params:
            show_technical_variants = self.request.query_params.get('show_technical_variants', 'false') == 'true'
            if not show_technical_variants:
                queryset = queryset.filter(parent_template__isnull=True)

        # Option to exclude variant templates (products with has_variants=True)
        exclude_variant_templates = self.request.query_params.get('exclude_variant_templates', 'false') == 'true'
        if exclude_variant_templates:
            queryset = queryset.filter(has_variants=False)

        from django.db.models import Prefetch, Sum
        from production.models import BillOfMaterials, BillOfMaterialsLine
        
        
        bom_queryset = BillOfMaterials.objects.filter(active=True).prefetch_related(
            Prefetch(
                'lines',
                queryset=BillOfMaterialsLine.objects.select_related('uom').prefetch_related(
                    Prefetch(
                        'component',
                        queryset=Product.objects.annotate(
                            annotated_current_stock=Sum('stock_moves__quantity')
                        ).select_related('uom')
                    )
                )
            )
        )

        queryset = queryset.prefetch_related(
            Prefetch('boms', queryset=bom_queryset)
        )

        return queryset

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
        moves = StockMove.objects.filter(product=instance).select_related(
            'warehouse', 'uom'
        ).prefetch_related(
            'sale_delivery_line',
            'purchase_receipt_line',
            'sale_return_line',
            'purchase_return_line'
        ).all().order_by('-date', '-id')[:50]
        
        kardex = []
        for m in moves:
            unit_price = 0
            # Try to get price/cost from related lines
            if hasattr(m, 'sale_delivery_line') and m.sale_delivery_line:
                unit_price = float(m.sale_delivery_line.unit_price)
            elif hasattr(m, 'purchase_receipt_line') and m.purchase_receipt_line:
                unit_price = float(m.purchase_receipt_line.unit_cost)
            elif hasattr(m, 'sale_return_line') and m.sale_return_line:
                unit_price = float(m.sale_return_line.unit_price)
            elif hasattr(m, 'purchase_return_line') and m.purchase_return_line:
                unit_price = float(m.purchase_return_line.unit_cost)
            
            # If it's an adjustment, we don't have a direct line link in these relations,
            # but we might have it in the source_quantity if it was manual (handled by StockService)
            # However, for now, we rely on these mapped relations which cover 95% of cases.

            kardex.append({
                'date': m.date,
                'type': m.move_type,
                'quantity': float(m.quantity),
                'unit_price': unit_price,
                'total_price': abs(float(m.quantity) * unit_price),
                'warehouse': m.warehouse.name,
                'description': m.description,
                'uom': m.uom.name if m.uom else ""
            })

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

    @action(detail=True, methods=['post'])
    def generate_variants(self, request, pk=None):
        template = self.get_object()
        selection = request.data.get('selection', [])  # List of {attribute: id, values: [ids]}
        
        if not template.has_variants:
            return Response({"error": "El producto no tiene activada la opción de variantes."}, status=status.HTTP_400_BAD_REQUEST)
            
        import itertools
        from django.db import transaction
        
        # Prepare lists of values for each attribute
        attr_values_lists = []
        for item in selection:
            attr_id = item.get('attribute')
            val_ids = item.get('values', [])
            if val_ids:
                attr_values_lists.append(list(ProductAttributeValue.objects.filter(id__in=val_ids, attribute_id=attr_id)))
        
        if not attr_values_lists:
            return Response({"error": "Debe seleccionar valores de atributos."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Cartesian product of attribute values
        combinations = list(itertools.product(*attr_values_lists))
        
        created_count = 0
        skipped_count = 0
        
        with transaction.atomic():
            for combo in combinations:
                # Check if variant already exists
                existing_variants = Product.objects.filter(parent_template=template)
                for val in combo:
                    existing_variants = existing_variants.filter(attribute_values=val)
                
                # Ensure it has exactly the same number of attributes to avoid partial matches
                existing_variants = [v for v in existing_variants if v.attribute_values.count() == len(combo)]
                
                if existing_variants:
                    skipped_count += 1
                    continue
                
                # Create the variant
                variant = Product.objects.create(
                    name=template.name,
                    category=template.category,
                    product_type=template.product_type,
                    uom=template.uom,
                    sale_uom=template.sale_uom,
                    purchase_uom=template.purchase_uom,
                    receiving_warehouse=template.receiving_warehouse,
                    track_inventory=template.track_inventory,
                    can_be_sold=template.can_be_sold,
                    can_be_purchased=template.can_be_purchased,
                    parent_template=template,
                    sale_price=template.sale_price,
                    cost_price=template.cost_price,
                    requires_advanced_manufacturing=template.requires_advanced_manufacturing,
                    mfg_auto_finalize=template.mfg_auto_finalize,
                    mfg_enable_prepress=template.mfg_enable_prepress,
                    mfg_enable_press=template.mfg_enable_press,
                    mfg_enable_postpress=template.mfg_enable_postpress,
                    mfg_prepress_design=template.mfg_prepress_design,
                    mfg_prepress_specs=template.mfg_prepress_specs,
                    mfg_prepress_folio=template.mfg_prepress_folio,
                    mfg_press_offset=template.mfg_press_offset,
                    mfg_press_digital=template.mfg_press_digital,
                    mfg_postpress_finishing=template.mfg_postpress_finishing,
                    mfg_postpress_binding=template.mfg_postpress_binding,
                    mfg_default_delivery_days=template.mfg_default_delivery_days,
                )
                variant.attribute_values.set(combo)
                variant.save()  # Triggers display name generation
                created_count += 1
                
        return Response({
            "message": f"Se han creado {created_count} variantes. {skipped_count} ya existían.",
            "created": created_count,
            "skipped": skipped_count
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



class ProductAttributeViewSet(viewsets.ModelViewSet):
    queryset = ProductAttribute.objects.all()
    serializer_class = ProductAttributeSerializer

class ProductAttributeValueViewSet(viewsets.ModelViewSet):
    queryset = ProductAttributeValue.objects.all()
    serializer_class = ProductAttributeValueSerializer
    filterset_fields = ['attribute']

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

    @action(detail=False, methods=['get'])
    def allowed(self, request):
        """
        Returns allowed UoMs for a specific product and context.
        Query params: product_id (required), context (optional, default 'sale')
        """
        product_id = request.query_params.get('product_id')
        context = request.query_params.get('context', 'sale')

        if not product_id:
            return Response(
                {"error": "product_id is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        product = get_object_or_404(Product, id=product_id)
        
        try:
            queryset = UoMService.get_allowed_uoms_for_context(product, context)
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
