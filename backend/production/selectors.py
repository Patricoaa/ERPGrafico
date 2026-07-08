class ProductionSelectorExt:
    @staticmethod
    def get_bom_queryset(request):
        from django.db.models import Q
        from .models import BillOfMaterials

        qs = BillOfMaterials.objects.all()
        pid = request.query_params.get("product_id")
        parent = request.query_params.get("parent_id")
        if pid:
            qs = qs.filter(product_id=pid)
        elif parent:
            qs = qs.filter(Q(product_id=parent) | Q(product__parent_template_id=parent))
        return qs.select_related(
            "product", "product__parent_template", "yield_uom"
        ).prefetch_related(
            "lines", "lines__component", "lines__component__uom", "lines__uom", "lines__supplier"
        )
    @staticmethod
    def get_stock_available(obj, context):
        from django.db.models import Sum
        from inventory.services import UoMService
        c = obj.component
        if c.product_type == 'SERVICE': return 999999
        if c.strategy.can_have_bom and not c.requires_advanced_manufacturing: return c.get_manufacturable_quantity() or 0.0
        w = obj.work_order.warehouse
        if not w: return 0.0
        
        sbp = context.get('stocks_by_product')
        req = context.get('request')
        
        if sbp is not None: stock = sbp.get(c.id, 0.0)
        else:
            if req:
                if not hasattr(req, '_stock_cache'): req._stock_cache = {}
                key = (w.id, c.id)
                if key in req._stock_cache: stock = req._stock_cache[key]
                else:
                    stock = req._stock_cache[key] = c.stock_moves.filter(warehouse=w).aggregate(t=Sum('quantity'))['t'] or 0.0
            else:
                stock = c.stock_moves.filter(warehouse=w).aggregate(t=Sum('quantity'))['t'] or 0.0

        try:
            if c.uom and obj.uom and c.uom != obj.uom: stock = UoMService.convert_quantity(stock, c.uom, obj.uom)
        except Exception: pass
        return float(stock)

    @staticmethod
    def get_total_cost(obj):
        from decimal import Decimal
        from inventory.services import UoMService
        total = Decimal('0.00')
        for line in obj.lines.all():
            qty = line.quantity
            if line.is_outsourced: total += qty * line.unit_price
            else:
                if line.uom and line.component.uom and line.uom != line.component.uom:
                    try: qty = UoMService.convert_quantity(line.quantity, line.uom, line.component.uom)
                    except Exception: pass
                total += qty * line.component.cost_price
        if obj.yield_quantity and obj.yield_quantity > 0: total = total / obj.yield_quantity
        return float(total)
