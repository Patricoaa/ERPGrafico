class InvoiceSelectorExt:
    @staticmethod
    def get_queryset_from_request(view, request):
        from .models import Invoice
        qs = Invoice.objects.select_related('contact', 'journal_entry').prefetch_related('lines__product', 'lines__taxes', 'taxes')
        if view.action in ['list', 'debit_notes_list', 'credit_notes_list', 'unpaid_invoices', 'dashboard_stats']:
            d_type = request.query_params.get('document_type')
            inv_type = request.query_params.get('invoice_type')
            is_purch = request.query_params.get('is_purchase')
            stat = request.query_params.get('status')
            part = request.query_params.get('partner')
            df = request.query_params.get('date_from')
            dt = request.query_params.get('date_to')
            is_boleta = request.query_params.get('is_boleta')
            if d_type: qs = qs.filter(document_type=d_type)
            if inv_type: qs = qs.filter(invoice_type=inv_type)
            if is_purch: qs = qs.filter(is_purchase=is_purch.lower() == 'true')
            if stat: qs = qs.filter(status=stat)
            if part: qs = qs.filter(partner_id=part)
            if df: qs = qs.filter(date__gte=df)
            if dt: qs = qs.filter(date__lte=dt)
            if is_boleta: qs = qs.filter(document_type__in=['39', '41']) if is_boleta.lower() == 'true' else qs.exclude(document_type__in=['39', '41'])
        return qs.order_by('-date', '-id')

    @staticmethod
    def get_serialized_payments(invoice):
        from .serializers_common import InvoicePaymentLineSerializer
        from .models import InvoicePaymentLine
        lines = InvoicePaymentLine.objects.filter(invoice=invoice).select_related('payment_record', 'payment_record__account', 'payment_record__journal_entry').order_by('payment_record__date')
        return InvoicePaymentLineSerializer(lines, many=True).data

    @staticmethod
    def get_lines(invoice):
        from .serializers_common import InvoiceLineSerializer
        return InvoiceLineSerializer(invoice.lines.all(), many=True).data

    @staticmethod
    def get_related_documents(invoice):
        docs = []
        if invoice.is_purchase and hasattr(invoice, 'purchase_order') and invoice.purchase_order:
            docs.append({'type': 'purchase_order', 'id': invoice.purchase_order.id, 'name': invoice.purchase_order.name, 'url': f'/purchasing/orders/{invoice.purchase_order.id}'})
        if not invoice.is_purchase and hasattr(invoice, 'sale_order') and invoice.sale_order:
            docs.append({'type': 'sale_order', 'id': invoice.sale_order.id, 'name': invoice.sale_order.name, 'url': f'/sales/orders/{invoice.sale_order.id}'})
        for inv in invoice.related_invoices.all():
            if inv != invoice: docs.append({'type': 'invoice', 'id': inv.id, 'name': str(inv), 'url': f'/billing/{"purchases" if inv.is_purchase else "sales"}/{inv.id}'})
        for dn in invoice.debit_notes.all(): docs.append({'type': 'debit_note', 'id': dn.id, 'name': str(dn), 'url': f'/billing/{"purchases" if dn.is_purchase else "sales"}/{dn.id}'})
        for cn in invoice.credit_notes.all(): docs.append({'type': 'credit_note', 'id': cn.id, 'name': str(cn), 'url': f'/billing/{"purchases" if cn.is_purchase else "sales"}/{cn.id}'})
        return docs

    @staticmethod
    def get_related_stock_moves(invoice):
        moves = []
        if hasattr(invoice, 'sale_order') and invoice.sale_order:
            for m in invoice.sale_order.stock_moves.all():
                moves.append({'id': m.id, 'reference': m.reference, 'date': m.date, 'status': m.status})
        if hasattr(invoice, 'purchase_order') and invoice.purchase_order:
            for m in invoice.purchase_order.stock_moves.all():
                moves.append({'id': m.id, 'reference': m.reference, 'date': m.date, 'status': m.status})
        return moves

    @staticmethod
    def get_related_returns(invoice):
        from sales.models import SaleReturn
        from purchasing.models import PurchaseReturn
        returns = []
        if invoice.is_purchase:
            for r in PurchaseReturn.objects.filter(invoice=invoice):
                returns.append({'id': r.id, 'name': str(r), 'status': r.status})
        else:
            for r in SaleReturn.objects.filter(invoice=invoice):
                returns.append({'id': r.id, 'name': str(r), 'status': r.status})
        return returns
