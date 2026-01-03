from rest_framework import serializers
from .models import Supplier, PurchaseOrder, PurchaseLine, PurchaseReceipt, PurchaseReceiptLine
from treasury.serializers import PaymentSerializer
import math
from decimal import Decimal


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'

class PurchaseLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    quantity_pending = serializers.ReadOnlyField()
    id = serializers.IntegerField(required=False) # Helper for updates
    
    class Meta:
        model = PurchaseLine
        fields = ['id', 'product', 'product_name', 'quantity', 'unit_cost', 'tax_rate', 'subtotal', 'quantity_received', 'quantity_pending']
        read_only_fields = ['subtotal', 'quantity_received', 'quantity_pending']

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
                'total': inv.total
            }
            if inv.dte_type in [Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO]:
                docs['notes'].append(doc_info)
            else:
                docs['invoices'].append(doc_info)

        for rec in obj.receipts.all():
            docs['receipts'].append({
                'id': rec.id,
                'number': rec.number,
                'date': rec.receipt_date,
                # Link stock moves if they exist on lines
                'stock_move_ids': [l.stock_move.id for l in rec.lines.all() if l.stock_move]
            })

        for pay in obj.payments.all():
            docs['payments'].append({
                'id': pay.id,
                'amount': pay.amount,
                'date': pay.date,
                'method': pay.get_payment_method_display()
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
        self._update_totals(order)
        
        return order

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        
        # Update simple fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        if lines_data is not None:
            self._save_lines(instance, lines_data)
            self._update_totals(instance)
            
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

    def _update_totals(self, order):
        total_net = 0
        total_tax = 0
        
        # Refresh lines to calculate total
        for line in order.lines.all(): # .all() hits DB again to get fresh calculated subtotals
            line_net = line.subtotal
            line_tax = line_net * (line.tax_rate / 100)
            
            total_net += line_net
            total_tax += line_tax
            
        order.total_net = total_net
        order.total_tax = Decimal(str(math.ceil(total_tax)))
        order.total = Decimal(str(math.ceil(total_net + total_tax)))
        order.save()

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
