from rest_framework import serializers
from .models import PurchaseOrder, PurchaseLine, PurchaseReceipt, PurchaseReceiptLine
from treasury.serializers import PaymentSerializer
import math
from decimal import Decimal


class PurchaseLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    quantity_pending = serializers.ReadOnlyField()
    id = serializers.IntegerField(required=False) # Helper for updates
    uom_name = serializers.CharField(source='uom.name', read_only=True, allow_null=True)
    
    class Meta:
        model = PurchaseLine
        fields = ['id', 'product', 'product_name', 'quantity', 'uom', 'uom_name', 'unit_cost', 'tax_rate', 'subtotal', 'quantity_received', 'quantity_pending']
        read_only_fields = ['subtotal', 'quantity_received', 'quantity_pending']

    def validate(self, data):
        product = data.get('product')
        uom = data.get('uom')
        
        if product and uom:
            from inventory.services import UoMService
            
            # COMPRAS: Permite toda la categoría del UoM base (flexible)
            if not product.uom:
                raise serializers.ValidationError({
                    'product': f"El producto '{product.name}' debe tener una UoM base asignada."
                })
            
            if not UoMService.validate_uom_compatibility(product.uom, uom):
                raise serializers.ValidationError({
                    'uom': f"La unidad '{uom.name}' no es compatible con la categoría "
                           f"del producto ('{product.uom.category.name}'). "
                           f"Solo puede usar unidades de la misma categoría."
                })
        
        return data

class PurchaseOrderSerializer(serializers.ModelSerializer):
    lines = PurchaseLineSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    total_paid = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    is_invoiced = serializers.SerializerMethodField()
    invoice_details = serializers.SerializerMethodField()
    serialized_payments = PaymentSerializer(source='payments', many=True, read_only=True)
    related_documents = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = '__all__'

    def get_total_paid(self, obj):
        return sum(p.amount for p in obj.payments.all())

    def get_pending_amount(self, obj):
        return obj.effective_total - self.get_total_paid(obj)

    def get_is_invoiced(self, obj):
        from billing.models import Invoice
        return obj.invoices.filter(dte_type__in=[
            Invoice.DTEType.FACTURA, 
            Invoice.DTEType.BOLETA, 
            Invoice.DTEType.PURCHASE_INV
        ]).exists()
    
    def get_invoice_details(self, obj):
        from billing.models import Invoice
        invoice = obj.invoices.filter(dte_type__in=[
            Invoice.DTEType.FACTURA, 
            Invoice.DTEType.BOLETA, 
            Invoice.DTEType.PURCHASE_INV
        ]).first()
        
        if not invoice:
            # Fallback to any linked document (like a Note) if no primary exists
            invoice = obj.invoices.first()

        if invoice:
            return {
                'id': invoice.id,
                'dte_type': invoice.dte_type,
                'number': invoice.number,
                'document_attachment': invoice.document_attachment.url if invoice.document_attachment else None
            }
        return None

    def get_related_documents(self, obj):
        """Returns a summary of all documents related to this PO for UI linking"""
        docs = {
            'invoices': [], # Primary bills
            'notes': [],    # NC / ND
            'receipts': [], # Stock receipts
            'payments': []  # Payments
        }

        from billing.models import Invoice
        for inv in obj.invoices.all():
            doc_info = {
                'id': inv.id,
                'number': inv.number or 'Draft',
                'type': inv.dte_type,
                'type_display': inv.get_dte_type_display(),
                'status': inv.status,
                'total': inv.total
            }
            if inv.dte_type in [Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO]:
                docs['notes'].append(doc_info)
            else:
                docs['invoices'].append(doc_info)

        for rec in obj.receipts.all():
            for line in rec.lines.all():
                if line.stock_move:
                    move = line.stock_move
                    move_code = f"MOV-{str(move.id).zfill(6)}"
                    docs['receipts'].append({
                        'id': move.id,
                        'number': move_code,
                        'date': rec.receipt_date,
                        'stock_moves': [{
                            'id': move.id,
                            'product': move.product.name,
                            'quantity': move.quantity,
                            'is_return': move.quantity < 0
                        }]
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

class WritePurchaseOrderSerializer(serializers.ModelSerializer):
    lines = PurchaseLineSerializer(many=True)

    class Meta:
        model = PurchaseOrder
        fields = ['id', 'supplier', 'warehouse', 'notes', 'lines', 'supplier_reference', 'payment_method']
        read_only_fields = ['id']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        order = PurchaseOrder.objects.create(**validated_data)
        
        self._save_lines(order, lines_data)
        order.recalculate_totals()
        
        return order

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        
        # Update simple fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        if lines_data is not None:
            self._save_lines(instance, lines_data)
            instance.recalculate_totals()
            
        instance.save()
        return instance

    def _save_lines(self, order, lines_data):
        # Current lines mapping
        current_lines = {line.id: line for line in order.lines.all()}
        incoming_line_ids = [item.get('id') for item in lines_data if item.get('id')]
        
        # 1. Delete lines not in request
        for line_id, line in current_lines.items():
            if line_id not in incoming_line_ids:
                line.delete()

        # 2. Create or Update
        for line_data in lines_data:
            line_id = line_data.get('id')
            
            if line_id and line_id in current_lines:
                # Update existing
                line = current_lines[line_id]
                for attr, value in line_data.items():
                    if attr != 'id': 
                        setattr(line, attr, value)
                line.save()
            else:
                # Create new
                if 'id' in line_data:
                    del line_data['id'] # Avoid passing explicit ID for creation
                PurchaseLine.objects.create(order=order, **line_data)


class PurchaseReceiptLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
    
    class Meta:
        model = PurchaseReceiptLine
        fields = '__all__'

class PurchaseReceiptSerializer(serializers.ModelSerializer):
    lines = PurchaseReceiptLineSerializer(many=True, read_only=True)
    purchase_order_number = serializers.CharField(source='purchase_order.number', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    
    class Meta:
        model = PurchaseReceipt
        fields = '__all__'

class NoteCreationSerializer(serializers.Serializer):
    note_type = serializers.ChoiceField(choices=[('NOTA_CREDITO', 'Nota de Crédito'), ('NOTA_DEBITO', 'Nota de Débito')])
    amount_net = serializers.DecimalField(max_digits=14, decimal_places=2)
    amount_tax = serializers.DecimalField(max_digits=14, decimal_places=2)
    document_number = serializers.CharField(max_length=50)
    original_invoice_id = serializers.IntegerField(required=False, allow_null=True)
    return_items = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        allow_empty=True
    )
    
    def validate(self, data):
        if data['amount_net'] < 0 or data['amount_tax'] < 0:
            raise serializers.ValidationError("Los montos no pueden ser negativos.")
        return data
