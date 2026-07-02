class NoteWorkflowSelector:
    @staticmethod
    def get_queryset_from_request(view, request):
        from billing.note_workflow import NoteWorkflow

        qs = NoteWorkflow.objects.select_related(
            "invoice", "corrected_invoice", "sale_order", "purchase_order", "created_by"
        ).all()

        sale_order_id = request.query_params.get("sale_order_id")
        purchase_order_id = request.query_params.get("purchase_order_id")
        stage = request.query_params.get("stage")

        if sale_order_id:
            qs = qs.filter(sale_order_id=sale_order_id)
        if purchase_order_id:
            qs = qs.filter(purchase_order_id=purchase_order_id)
        if stage:
            qs = qs.filter(current_stage=stage)

        return qs


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
        if invoice.sale_order_id:
            for delivery in invoice.sale_order.deliveries.all():
                for line in delivery.lines.select_related('stock_move'):
                    if line.stock_move_id:
                        m = line.stock_move
                        moves.append({'id': m.id, 'reference': str(m), 'date': m.date, 'status': m.move_type})
        if invoice.purchase_order_id:
            for receipt in invoice.purchase_order.receipts.all():
                for line in receipt.lines.select_related('stock_move'):
                    if line.stock_move_id:
                        m = line.stock_move
                        moves.append({'id': m.id, 'reference': str(m), 'date': m.date, 'status': m.move_type})
        return moves

    @staticmethod
    def get_related_returns(invoice):
        from sales.models import SaleReturn
        from purchasing.models import PurchaseReturn
        returns = []
        if invoice.purchase_order_id:
            for r in PurchaseReturn.objects.filter(credit_note=invoice):
                returns.append({'id': r.id, 'name': str(r), 'status': r.status})
        else:
            for r in SaleReturn.objects.filter(credit_note=invoice):
                returns.append({'id': r.id, 'name': str(r), 'status': r.status})
        return returns

    @staticmethod
    def check_folio_uniqueness(
        *,
        number: str,
        dte_type: str,
        exclude_id: int | None = None,
        contact_id: int | None = None,
        is_purchase: bool = False,
    ) -> dict:
        if not number or number == "Draft" or number.strip() == "":
            return {"is_unique": True, "message": "OK"}

        from .models import Invoice

        query = Invoice.objects.filter(number=number, dte_type=dte_type)

        if exclude_id:
            query = query.exclude(id=exclude_id)

        if is_purchase:
            query = query.filter(purchase_order__isnull=False)
            if contact_id:
                query = query.filter(contact_id=contact_id)
        else:
            query = query.filter(sale_order__isnull=False)

        existing = query.first()

        if existing:
            doc_origin = "compra" if is_purchase else "venta"
            partner_name = (
                existing.contact.name
                if existing.contact
                else (existing.sale_order.customer.name if existing.sale_order else "Unknown")
            )

            return {
                "is_unique": False,
                "message": f"El folio {number} ya ha sido utilizado en otro documento de {doc_origin}.",
                "existing_invoice": {
                    "id": existing.id,
                    "number": existing.number,
                    "date": existing.date.isoformat() if existing.date else None,
                    "partner_name": partner_name,
                    "total": float(existing.total),
                },
            }

        return {"is_unique": True, "message": "Folio disponible"}

    @staticmethod
    def get_cancel_impact(invoice) -> dict:
        from .models import Invoice

        is_purchase_doc = invoice.purchase_order_id is not None or not invoice.is_sale_document()
        return {
            "invoice_status": invoice.status,
            "has_folio": bool(invoice.number and invoice.number != "Draft"),
            "is_sale_document": not is_purchase_doc,
            "journal_entry_status": invoice.journal_entry.status if invoice.journal_entry else None,
            "payments": [
                {"id": p.id, "amount": str(p.amount), "status": p.status}
                for p in invoice.payments.all()
            ],
            "action": "cancel" if invoice.status == Invoice.Status.DRAFT else "annul",
        }
