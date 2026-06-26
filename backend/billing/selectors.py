class InvoiceSelectorExt:
    @staticmethod
    def get_queryset_from_request(view, request):
        from .models import Invoice
        qs = Invoice.objects.select_related('contact', 'journal_entry')
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
            if is_purch:
                if is_purch.lower() == 'true':
                    qs = qs.filter(purchase_order__isnull=False)
                else:
                    qs = qs.filter(sale_order__isnull=False)
            if stat: qs = qs.filter(status=stat)
            if part: qs = qs.filter(partner_id=part)
            if df: qs = qs.filter(date__gte=df)
            if dt: qs = qs.filter(date__lte=dt)
            if is_boleta: qs = qs.filter(document_type__in=['39', '41']) if is_boleta.lower() == 'true' else qs.exclude(document_type__in=['39', '41'])
        return qs.order_by('-date', '-id')

    @staticmethod
    def get_serialized_payments(invoice):
        from treasury.serializers import TreasuryMovementSerializer
        payments = invoice.payments.select_related('journal_entry', 'account').order_by('date')
        return TreasuryMovementSerializer(payments, many=True).data

    @staticmethod
    def get_lines(invoice):
        if invoice.sale_order_id:
            from sales.serializers import SaleLineSerializer
            return SaleLineSerializer(invoice.sale_order.lines.all(), many=True).data
        if invoice.purchase_order_id:
            from purchasing.serializers import PurchaseLineSerializer
            return PurchaseLineSerializer(invoice.purchase_order.lines.all(), many=True).data
        return []

    @staticmethod
    def get_related_documents(invoice):
        docs = []
        if invoice.purchase_order_id and hasattr(invoice, 'purchase_order') and invoice.purchase_order:
            po = invoice.purchase_order
            docs.append({'type': 'purchase_order', 'id': po.id, 'name': str(po), 'url': f'/purchasing/orders/{po.id}'})
        if invoice.sale_order_id and hasattr(invoice, 'sale_order') and invoice.sale_order:
            so = invoice.sale_order
            docs.append({'type': 'sale_order', 'id': so.id, 'name': str(so), 'url': f'/sales/orders/{so.id}'})
        for adj in invoice.adjustments.filter(dte_type__in=['NOTA_DEBITO', 'NOTA_CREDITO']):
            doc_type = 'debit_note' if adj.dte_type == 'NOTA_DEBITO' else 'credit_note'
            docs.append({'type': doc_type, 'id': adj.id, 'name': str(adj), 'url': f'/billing/{"purchases" if adj.purchase_order_id else "sales"}/{adj.id}'})
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
        if invoice.purchase_order_id:
            for r in PurchaseReturn.objects.filter(invoice=invoice):
                returns.append({'id': r.id, 'name': str(r), 'status': r.status})
        else:
            for r in SaleReturn.objects.filter(invoice=invoice):
                returns.append({'id': r.id, 'name': str(r), 'status': r.status})
        return returns
