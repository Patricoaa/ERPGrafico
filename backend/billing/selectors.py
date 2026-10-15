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

        is_list = view.action in ['list', 'debit_notes_list', 'credit_notes_list', 'unpaid_invoices', 'dashboard_stats']

        if is_list:
            qs = Invoice.objects.select_related(
                'contact',
                'sale_order__customer',
                'purchase_order__supplier',
                'journal_entry',
            ).prefetch_related(
                'payments',
                'payment_allocations',
            )
        else:
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
        """
        Líneas de la factura (ADR-0081). Forma compatible con el contrato previo: cada ítem
        es la línea de orden que factura (`id` = id de la línea de OV/OC, lo usa el flujo de
        notas hasta GAP-14) con `quantity`/`subtotal` de la factura y `invoice_line_id`.
        """
        from purchasing.serializers import PurchaseLineSerializer
        from sales.serializers import SaleLineSerializer

        invoice_lines = list(invoice.lines.select_related("sale_line", "purchase_line"))
        if invoice_lines:
            data = []
            for il in invoice_lines:
                if il.sale_line_id:
                    item = dict(SaleLineSerializer(il.sale_line).data)
                elif il.purchase_line_id:
                    item = dict(PurchaseLineSerializer(il.purchase_line).data)
                else:
                    item = {"id": None, "product": il.product_id, "description": il.description,
                            "unit_price": il.unit_price, "tax_rate": il.tax_rate}
                item.update({
                    "invoice_line_id": il.id,
                    "quantity": il.quantity,
                    "subtotal": il.subtotal,
                    "delivery_line": il.delivery_line_id,
                    "receipt_line": il.receipt_line_id,
                })
                data.append(item)
            return data

        # Legacy (facturas aún sin backfill): notas → sus propias líneas; resto → orden completa.
        is_note = invoice.dte_type in (invoice.DTEType.NOTA_CREDITO, invoice.DTEType.NOTA_DEBITO)
        if invoice.sale_order_id:
            lines = invoice.sale_order.lines.all()
            lines = lines.filter(related_note=invoice) if is_note else lines.filter(related_note__isnull=True)
            return SaleLineSerializer(lines, many=True).data
        if invoice.purchase_order_id:
            lines = invoice.purchase_order.lines.all()
            lines = lines.filter(related_note=invoice) if is_note else lines.filter(related_note__isnull=True)
            return PurchaseLineSerializer(lines, many=True).data
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
                        moves.append({'id': m.id, 'reference': str(m), 'date': m.date, 'status': f"{getattr(m.source_location, 'name', '?')} → {getattr(m.destination_location, 'name', '?')}"})
        if invoice.purchase_order_id:
            for receipt in invoice.purchase_order.receipts.all():
                for line in receipt.lines.select_related('stock_move'):
                    if line.stock_move_id:
                        m = line.stock_move
                        moves.append({'id': m.id, 'reference': str(m), 'date': m.date, 'status': f"{getattr(m.source_location, 'name', '?')} → {getattr(m.destination_location, 'name', '?')}"})
        return moves

    @staticmethod
    def get_related_returns(invoice):
        from purchasing.models import PurchaseReturn
        from sales.models import SaleReturn
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


class InvoiceableLinesSelector:
    """
    Líneas pendientes de facturar (ADR-0081, M4b): por cliente/proveedor u órdenes, con las
    entregas confirmadas de cada línea y lo ya facturado contra ellas (D1.1, D1.2).
    """

    @staticmethod
    def list(side: str, partner_id=None, order_ids=None) -> list[dict]:
        from django.db.models import Sum

        from .invoicing import PRIMARY_DTE_TYPES
        from .models import Invoice, InvoiceLine

        is_sale = side == "sale"
        if is_sale:
            from sales.models import SaleDeliveryLine as FulfilLine
            from sales.models import SaleOrder as Order
            partner_field, line_field, fulfil_field, doc_field, qty_field = (
                "customer", "sale_line", "delivery_line", "delivery", "quantity")
        else:
            from purchasing.models import PurchaseOrder as Order
            from purchasing.models import PurchaseReceiptLine as FulfilLine
            partner_field, line_field, fulfil_field, doc_field, qty_field = (
                "supplier", "purchase_line", "receipt_line", "receipt", "quantity_received")

        orders = Order.objects.exclude(status__in=["DRAFT", "CANCELLED"]).exclude(
            invoicing_status=Order.InvoicingStatus.INVOICED
        )
        if partner_id:
            orders = orders.filter(**{f"{partner_field}_id": partner_id})
        if order_ids:
            orders = orders.filter(pk__in=order_ids)
        if not partner_id and not order_ids:
            return []

        active = InvoiceLine.objects.filter(invoice__dte_type__in=PRIMARY_DTE_TYPES).exclude(
            invoice__status=Invoice.Status.CANCELLED
        )
        result = []
        for order in orders.order_by("id"):
            lines = []
            for line in order.lines.filter(related_note__isnull=True).select_related("product"):
                pending = line.quantity - line.quantity_invoiced
                if pending <= 0:
                    continue
                invoiced_by_fulfil = dict(
                    active.filter(**{f"{fulfil_field}__{line_field}": line})
                    .values_list(fulfil_field).annotate(t=Sum("quantity"))
                )
                fulfillments = []
                for fulfil in FulfilLine.objects.filter(**{line_field: line, f"{doc_field}__status": "CONFIRMED"}).select_related(doc_field):
                    delivered = abs(getattr(fulfil, qty_field))
                    invoiced = invoiced_by_fulfil.get(fulfil.pk, 0)
                    fulfillments.append({
                        "id": fulfil.pk,
                        "document_id": getattr(fulfil, f"{doc_field}_id"),
                        "document_display": getattr(fulfil, doc_field).display_id,
                        "date": getattr(getattr(fulfil, doc_field), f"{doc_field}_date", None),
                        "delivered": delivered,
                        "invoiced": invoiced,
                        "pending": delivered - invoiced,
                    })
                lines.append({
                    "id": line.pk,
                    "product_id": line.product_id,
                    "description": getattr(line, "description", "") or (line.product.name if line.product else ""),
                    "quantity": line.quantity,
                    "quantity_invoiced": line.quantity_invoiced,
                    "pending": pending,
                    "deliverable": bool(line.product and line.product.product_type not in ("SERVICE", "SUBSCRIPTION")),
                    "fulfillments": fulfillments,
                })
            if lines:
                result.append({
                    "order_id": order.pk,
                    "display_id": order.display_id,
                    "partner_id": getattr(order, f"{partner_field}_id"),
                    "invoicing_status": order.invoicing_status,
                    "lines": lines,
                })
        return result
