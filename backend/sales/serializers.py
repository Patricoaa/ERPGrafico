from rest_framework import serializers
from .models import SaleOrder, SaleLine, SalesSettings, SaleDelivery, SaleDeliveryLine
from treasury.serializers import PaymentSerializer
from production.serializers import WorkOrderSerializer
from inventory.models import Product
from django.db.models import Sum
import math
from decimal import Decimal

class SalesSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesSettings
        fields = '__all__'

class SaleLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, allow_null=True)
    product_type = serializers.SerializerMethodField()
    track_inventory = serializers.SerializerMethodField()
    manufacturable_quantity = serializers.SerializerMethodField()
    
    quantity_pending = serializers.ReadOnlyField()
    uom_name = serializers.CharField(source='uom.name', read_only=True, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = SaleLine
        fields = [
            'id', 'product', 'product_name', 'product_type', 'track_inventory', 
            'manufacturable_quantity', 'description', 'quantity', 'uom', 'uom_name', 
            'unit_price', 'tax_rate', 'subtotal', 'quantity_delivered', 
            'quantity_pending', 'manufacturing_data', 'requires_advanced_manufacturing'
        ]

    def get_product_type(self, obj):
        return obj.product.product_type if obj.product else None

    def get_track_inventory(self, obj):
        return obj.product.track_inventory if obj.product else False

    def get_manufacturable_quantity(self, obj):
        if obj.product and obj.product.product_type == 'MANUFACTURABLE':
            qty = obj.product.get_manufacturable_quantity()
            return float(qty) if qty is not None else None
        return None
        
    requires_advanced_manufacturing = serializers.SerializerMethodField()
    
    def get_requires_advanced_manufacturing(self, obj):
        return obj.product.requires_advanced_manufacturing if obj.product else False

    def validate(self, data):
        product = data.get('product')
        uom = data.get('uom')
        
        if product and uom:
            from inventory.services import UoMService
            allowed_uoms = UoMService.get_allowed_uoms_for_context(product, 'sale')
            
            if uom.id not in allowed_uoms.values_list('id', flat=True):
                allowed_names = ', '.join(allowed_uoms.values_list('name', flat=True))
                raise serializers.ValidationError({
                    'uom': f"La unidad '{uom.name}' no está permitida para este producto. "
                           f"Unidades permitidas: {allowed_names}"
                })
        
        return data

class SaleOrderSerializer(serializers.ModelSerializer):
    lines = SaleLineSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    channel_display = serializers.CharField(source='get_channel_display', read_only=True)
    total_paid = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    serialized_payments = PaymentSerializer(source='payments', many=True, read_only=True)
    related_documents = serializers.SerializerMethodField()
    work_orders = WorkOrderSerializer(many=True, read_only=True)
    production_progress = serializers.SerializerMethodField()
    has_pending_work_orders = serializers.SerializerMethodField()

    class Meta:
        model = SaleOrder
        fields = '__all__'

    def get_related_documents(self, obj):
        from billing.models import Invoice
        docs = {
            'invoices': [],
            'notes': [],
            'payments': [],
            'deliveries': []
        }

        for inv in obj.invoices.all():
            doc_info = {
                'id': inv.id,
                'number': inv.number or 'Draft',
                'dte_type': inv.dte_type,
                'type_display': inv.get_dte_type_display(),
                'status': inv.status,
                'total': inv.total
            }
            if inv.dte_type in [Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO]:
                docs['notes'].append(doc_info)
            else:
                docs['invoices'].append(doc_info)

        for deliv in obj.deliveries.all():
            docs['deliveries'].append({
                'id': deliv.id,
                'number': deliv.id, # Deliveries might not have a public number yet
                'date': deliv.delivery_date
            })

        for pay in obj.payments.all():
            prefix = 'ING' if pay.payment_type == 'INBOUND' else 'EGR'
            code = f"{prefix}-{str(pay.id).zfill(5)}"
            docs['payments'].append({
                'id': pay.id,
                'amount': pay.amount,
                'date': pay.date,
                'method': pay.get_payment_method_display(),
                'invoice_id': pay.invoice_id,
                'code': code
            })

        return docs

    def get_has_pending_work_orders(self, obj):
        return obj.work_orders.exclude(status='FINISHED').exists()

    def get_total_paid(self, obj):
        return sum(p.amount for p in obj.payments.all())

    def get_pending_amount(self, obj):
        return obj.total - self.get_total_paid(obj)

    def get_production_progress(self, obj):
        wos = obj.work_orders.all()
        if not wos.exists():
            return 0
        total_progress = sum(WorkOrderSerializer(wo).data.get('production_progress', 0) for wo in wos)
        return total_progress / wos.count()

class CreateSaleOrderSerializer(serializers.ModelSerializer):
    """
    Serializer to handle nested creation of lines
    """
    lines = SaleLineSerializer(many=True)

    class Meta:
        model = SaleOrder
        fields = ['id', 'number', 'customer', 'notes', 'payment_method', 'lines']
        read_only_fields = ['id', 'number']

    def validate(self, attrs):
        settings = SalesSettings.objects.first()
        if settings and settings.restrict_stock_sales:
            for line in attrs.get('lines', []):
                product = line.get('product')
                quantity = line.get('quantity')
                if product and product.product_type == 'STORABLE':
                     current_stock = product.moves.aggregate(total=Sum('quantity'))['total'] or 0
                     if current_stock < quantity:
                         raise serializers.ValidationError(
                             f"Stock insuficiente para {product.name}. Disponible: {current_stock}, Solicitado: {quantity}"
                         )
        return attrs

    def create(self, validated_data):
        from .services import SalesService
        lines_data = validated_data.pop('lines')
        order = SaleOrder.objects.create(**validated_data)
        
        for line_data in lines_data:
            SaleLine.objects.create(order=order, **line_data)
        
        order.recalculate_totals()
        order.save()
        
        # Trigger confirmation logic (including OT creation)
        SalesService.confirm_sale(order)
        
        return order

class SaleDeliveryLineSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source='product.code', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    
    class Meta:
        model = SaleDeliveryLine
        fields = '__all__'

class SaleDeliverySerializer(serializers.ModelSerializer):
    lines = SaleDeliveryLineSerializer(many=True, read_only=True)
    sale_order_number = serializers.CharField(source='sale_order.number', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    
    class Meta:
        model = SaleDelivery
        fields = '__all__'
