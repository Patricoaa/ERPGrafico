from rest_framework import serializers
from .models import Invoice
from treasury.serializers import PaymentSerializer
from sales.serializers import SaleOrderSerializer
from purchasing.serializers import PurchaseOrderSerializer
from core.serializers import AttachmentSerializer

class InvoiceSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True, read_only=True)
    dte_type_display = serializers.CharField(source='get_dte_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    
    sale_order_number = serializers.CharField(source='sale_order.number', read_only=True, allow_null=True)
    purchase_order_number = serializers.CharField(source='purchase_order.number', read_only=True, allow_null=True)
    po_receiving_status = serializers.CharField(source='purchase_order.receiving_status', read_only=True, allow_null=True)
    partner_name = serializers.SerializerMethodField()
    related_documents = serializers.SerializerMethodField()
    related_stock_moves = serializers.SerializerMethodField()
    related_returns = serializers.SerializerMethodField()
    lines = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    serialized_payments = serializers.SerializerMethodField()
    adjustments = serializers.SerializerMethodField()
    corrected_invoice = serializers.SerializerMethodField()
    order_delivery_status = serializers.SerializerMethodField()
    work_orders = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = '__all__'

    def get_serialized_payments(self, obj):
        return PaymentSerializer(obj.payments.all(), many=True).data

    def get_pending_amount(self, obj):
        total_paid = sum(p.amount for p in obj.payments.all())
        return obj.total - total_paid

    def get_lines(self, obj):
        # 1. Check for persistent lines linked to this Note
        is_sale = obj.sale_order is not None
        if is_sale:
            note_lines = obj.note_sale_lines.all()
            if note_lines.exists():
                from sales.serializers import SaleLineSerializer
                return SaleLineSerializer(note_lines, many=True).data
        else:
            note_lines = obj.note_purchase_lines.all()
            if note_lines.exists():
                from purchasing.serializers import PurchaseLineSerializer
                return PurchaseLineSerializer(note_lines, many=True).data

        # 2. Prioritize NoteWorkflow items for NC/ND (Legacy/No-anchor lines)
        if obj.dte_type in [Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO]:
            try:
                if hasattr(obj, 'workflow') and obj.workflow and obj.workflow.selected_items:
                    items = obj.workflow.selected_items
                    
                    # Augment items with processed quantity
                    is_sale = obj.sale_order is not None
                    is_credit = obj.dte_type == Invoice.DTEType.NOTA_CREDITO

                    processed_map = {} # product_id -> quantity
                    
                    if is_credit:
                        # Sum from returns
                        if is_sale:
                            from sales.models import SaleReturnLine
                            qs = SaleReturnLine.objects.filter(return_doc__credit_note=obj, return_doc__status='CONFIRMED')
                            for line in qs:
                                processed_map[line.product_id] = processed_map.get(line.product_id, 0) + float(line.quantity)
                        else:
                            from purchasing.models import PurchaseReturnLine
                            qs = PurchaseReturnLine.objects.filter(return_doc__credit_note=obj, return_doc__status='CONFIRMED')
                            for line in qs:
                                processed_map[line.product_id] = processed_map.get(line.product_id, 0) + float(line.quantity)
                    else:
                        # Sum from supplemental deliveries/receipts
                        if is_sale:
                            from sales.models import SaleDeliveryLine
                            qs = SaleDeliveryLine.objects.filter(delivery__related_note=obj, delivery__status='CONFIRMED')
                            for line in qs:
                                processed_map[line.product_id] = processed_map.get(line.product_id, 0) + float(line.quantity)
                        else:
                            from purchasing.models import PurchaseReceiptLine
                            qs = PurchaseReceiptLine.objects.filter(receipt__related_note=obj, receipt__status='CONFIRMED')
                            for line in qs:
                                processed_map[line.product_id] = processed_map.get(line.product_id, 0) + float(line.quantity_received)

                    # Update items
                    for item in items:
                        p_id = item.get('product_id')
                        processed_qty = processed_map.get(p_id, 0)
                        if is_sale:
                            item['quantity_delivered'] = processed_qty
                        else:
                            item['quantity_received'] = processed_qty
                    
                    return items
            except Exception as e:
                print(f"DEBUG: Error augmenting NC lines: {e}")
                pass

        # 2. Fallback to order lines
        if obj.sale_order:
            from sales.serializers import SaleLineSerializer
            return SaleLineSerializer(obj.sale_order.lines.all(), many=True).data
        if obj.purchase_order:
            from purchasing.serializers import PurchaseLineSerializer
            return PurchaseLineSerializer(obj.purchase_order.lines.all(), many=True).data
        return []

    def get_related_documents(self, obj):
        docs = None
        if obj.purchase_order:
            from purchasing.serializers import PurchaseOrderSerializer
            docs = PurchaseOrderSerializer().get_related_documents(obj.purchase_order)
        elif obj.sale_order:
            from sales.serializers import SaleOrderSerializer
            docs = SaleOrderSerializer().get_related_documents(obj.sale_order)
        
        # If it's a Note, augment with THIS note's specific logistics 
        # (Since OrderSerializer might exclude them to avoid duplicates in the main order view)
        if docs and obj.dte_type in [Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO]:
            if obj.dte_type == Invoice.DTEType.NOTA_DEBITO:
                # Add supplemental deliveries
                for dele in obj.sale_deliveries.all():
                    # Check if already in list to avoid duplicates
                    if not any(d['id'] == dele.id and d['docType'] == 'sale_delivery' for d in docs.get('deliveries', [])):
                        docs.setdefault('deliveries', []).append({
                            'id': dele.id,
                            'number': dele.number,
                            'display_id': dele.display_id,
                            'status': dele.status,
                            'date': dele.delivery_date,
                            'docType': 'sale_delivery'
                        })
                # Add supplemental receipts (purchase)
                if hasattr(obj, 'purchase_receipts'):
                    for rec in obj.purchase_receipts.all():
                         if not any(d['id'] == rec.id and d['docType'] == 'purchase_receipt' for d in docs.get('receipts', [])):
                            docs.setdefault('receipts', []).append({
                                'id': rec.id,
                                'number': rec.number,
                                'display_id': rec.display_id,
                                'status': rec.status,
                                'date': rec.receipt_date,
                                'docType': 'purchase_receipt'
                            })
        
        return docs

    def get_partner_name(self, obj):
        if obj.sale_order:
            return obj.sale_order.customer.name
        if obj.purchase_order:
            return obj.purchase_order.supplier.name
        if obj.contact:
            return obj.contact.name
        return ""

    def get_related_stock_moves(self, obj):
        moves = []
        
        # 1. Moves linked to the Note's JE (Direct)
        if obj.journal_entry:
            from inventory.models import StockMove
            moves.extend(list(StockMove.objects.filter(journal_entry=obj.journal_entry)))
            
        # 2. Moves linked to related Logistics Documents (Indirect)
        # Credit Notes -> Returns
        if hasattr(obj, 'sale_returns'):
            for ret in obj.sale_returns.all():
                for line in ret.lines.all():
                    if line.stock_move:
                        moves.append(line.stock_move)
        
        if hasattr(obj, 'purchase_returns'):
            for ret in obj.purchase_returns.all():
                for line in ret.lines.all():
                    if line.stock_move:
                        moves.append(line.stock_move)
                        
        # Debit Notes -> Supplemental Deliveries/Receipts
        if hasattr(obj, 'sale_deliveries'): # related_name='sale_deliveries' on SaleDelivery.related_note
            for dele in obj.sale_deliveries.all():
                 for line in dele.lines.all():
                     if line.stock_move:
                         moves.append(line.stock_move)
        
        if hasattr(obj, 'purchase_receipts'): # Check if PurchaseReceipt has related_note logic implemented
             # Assuming related_name='purchase_receipts' or similar if implemented
             # If not explicitly on model, we might skip or need to check model def.
             # Based on previous file reads, PurchasingService.create_receipt_from_note was mentioned.
             # Let's check if PurchaseReceipt has 'related_note'.
             # For safety, use getattr or filter if possible, but object iteration is safer if attribute exists.
             if hasattr(obj, 'purchase_receipts'):
                 for rec in obj.purchase_receipts.all():
                     for line in rec.lines.all():
                         if line.stock_move:
                             moves.append(line.stock_move)

        # Build response
        # Eliminate duplicates just in case
        unique_moves = {m.id: m for m in moves}.values()
        
        return [{
            'id': m.id,
            'display_id': f"MOV-{m.id:06d}",
            'date': m.date,
            'product': m.product.name,
            'quantity': m.quantity,
            'warehouse': m.warehouse.name,
            'move_type_display': m.get_move_type_display(),
            'state': 'DONE'
        } for m in unique_moves]

    def get_related_returns(self, obj):
        data = []
        # Check for linked Sale Returns
        if hasattr(obj, 'sale_returns'):
             for ret in obj.sale_returns.all():
                 data.append({
                     'id': ret.id,
                     'number': ret.number,
                     'display_id': ret.display_id,
                     'status': ret.status,
                     'type': 'Devolución Venta',
                     'docType': 'sale_return'
                 })
        
        # Check for linked Purchase Returns
        if hasattr(obj, 'purchase_returns'):
             for ret in obj.purchase_returns.all():
                 data.append({
                     'id': ret.id,
                     'number': ret.number,
                     'display_id': ret.display_id,
                     'status': ret.status,
                     'type': 'Devolución Compra',
                     'docType': 'purchase_return'
                 })
        return data

    def get_adjustments(self, obj):
        # Only Facturas/Boletas usually have adjustments (Notes correcting them)
        adjustments = obj.adjustments.all()
        return [{
            'id': a.id,
            'number': a.number,
            'dte_type': a.dte_type,
            'dte_type_display': a.get_dte_type_display(),
            'status': a.status,
            'total': float(a.total),
            'display_id': a.display_id
        } for a in adjustments]

    def get_corrected_invoice(self, obj):
        if not obj.corrected_invoice:
            return None
        return {
            'id': obj.corrected_invoice.id,
            'number': obj.corrected_invoice.number,
            'display_id': obj.corrected_invoice.display_id,
            'dte_type': obj.corrected_invoice.dte_type,
            'dte_type_display': obj.corrected_invoice.get_dte_type_display()
        }

    def get_order_delivery_status(self, obj):
        if obj.sale_order:
            return obj.sale_order.delivery_status
        if obj.purchase_order:
            return obj.purchase_order.receiving_status
        return None
    
    def get_work_orders(self, obj):
        # Only include Work Orders for Debit Notes
        if obj.dte_type == Invoice.DTEType.NOTA_DEBITO:
            from production.serializers import WorkOrderSerializer
            ots = obj.work_orders.all()
            return WorkOrderSerializer(ots, many=True).data
        return []

class CreateInvoiceSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    order_type = serializers.ChoiceField(choices=['sale', 'purchase'])
    dte_type = serializers.ChoiceField(choices=Invoice.DTEType.choices)
    payment_method = serializers.ChoiceField(choices=Invoice.PaymentMethod.choices, default='CREDIT')
    supplier_invoice_number = serializers.CharField(required=False, allow_blank=True)
    document_attachment = serializers.FileField(required=False, allow_null=True)
    issue_date = serializers.DateField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=Invoice.Status.choices, default=Invoice.Status.POSTED)

