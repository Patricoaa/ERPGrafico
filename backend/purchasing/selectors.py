from django.utils import timezone

from tax.services import AccountingPeriodService, TaxPeriodService


class PurchaseOrderSelector:
    @staticmethod
    def get_base_queryset():
        from .models import PurchaseOrder

        return PurchaseOrder.objects.select_related(
            "supplier", "warehouse", "work_order", "payment_method_ref"
        ).prefetch_related(
            "payments__invoice",
            "invoices",
            "lines__product",
            "lines__uom",
            "receipts__lines__stock_move__product",
            "receipts__lines__product",
        ).all()
    @staticmethod
    def get_cancel_impact(order) -> dict:
        """Returns a preview of what will happen when cancelling the purchase order."""
        action_kind = "soft_cancel" if order.status == "DRAFT" else "full_annul"
        impact = {
            "order_status": order.status,
            "invoices": [
                {"id": inv.id, "display_id": inv.display_id, "status": inv.status}
                for inv in order.invoices.all()
            ],
            "receipts": [{"id": r.id, "status": r.status} for r in order.receipts.all()],
            "payments": [
                {
                    "id": p.id,
                    "amount": str(p.amount),
                    "status": p.status if hasattr(p, "status") else "POSTED",
                }
                for p in order.payments.all()
            ],
            "has_confirmed_receipts": order.receipts.filter(status="CONFIRMED").exists(),
            "has_posted_payments": order.payments.filter(journal_entry__status="POSTED").exists(),
            "requires_reason": action_kind == "full_annul",
            "action": action_kind,
        }

        today = timezone.now().date()
        impact["period_open"] = not (
            TaxPeriodService.is_period_closed(today)
            or AccountingPeriodService.is_period_closed(today)
        )
        return impact

    @staticmethod
    def get_invoice_details(order) -> "dict | None":
        """Returns primary invoice metadata for the hub display."""
        from billing.models import Invoice

        _PRIMARY_TYPES = [
            Invoice.DTEType.FACTURA,
            Invoice.DTEType.BOLETA,
            Invoice.DTEType.PURCHASE_INV,
        ]
        invoices = list(order.invoices.all())
        invoice = next((inv for inv in invoices if inv.dte_type in _PRIMARY_TYPES), None)
        if not invoice and invoices:
            invoice = invoices[0]
        if not invoice:
            return None
        return {
            "id": invoice.id,
            "dte_type": invoice.dte_type,
            "number": invoice.number,
            "document_attachment": invoice.document_attachment.url
            if invoice.document_attachment
            else None,
        }

    @staticmethod
    def get_related_documents(order) -> dict:
        """Returns a summary of all documents related to this PO for UI linking."""
        from billing.models import Invoice

        _NOTE_TYPES = [Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO]

        docs: dict = {"invoices": [], "notes": [], "receipts": [], "payments": []}

        for inv in order.invoices.all():
            doc_info = {
                "id": inv.id,
                "number": inv.number or "Draft",
                "display_id": inv.display_id,
                "dte_type": inv.dte_type,
                "type_display": inv.get_dte_type_display(),
                "status": inv.status,
                "total": inv.total,
            }
            docs["notes" if inv.dte_type in _NOTE_TYPES else "invoices"].append(doc_info)

        receipts = [r for r in order.receipts.all() if getattr(r, "related_note_id", None) is None]
        for rec in receipts:
            processed_moves: set = set()
            lines = list(rec.lines.all())
            for line in lines:
                if line.stock_move and line.stock_move_id not in processed_moves:
                    move = line.stock_move
                    processed_moves.add(move.id)
                    docs["receipts"].append({
                        "id": move.id,
                        "number": move.display_id,
                        "display_id": move.display_id,
                        "date": rec.receipt_date,
                        "docType": "inventory",
                        "stock_moves": [{
                            "id": move.id,
                            "product": move.product.name,
                            "quantity": move.quantity,
                            "is_return": move.quantity < 0,
                        }],
                    })
            has_service = any(
                line.product and line.product.product_type in ["SERVICE", "SUBSCRIPTION"]
                for line in lines
            )
            if has_service:
                docs["receipts"].append({
                    "id": rec.id,
                    "number": rec.display_id,
                    "display_id": rec.display_id,
                    "date": rec.receipt_date,
                    "docType": "purchase_receipt",
                    "is_service": True,
                })

        for pay in order.payments.all():
            if pay.invoice and pay.invoice.dte_type in _NOTE_TYPES:
                continue
            docs["payments"].append({
                "id": pay.id,
                "amount": pay.amount,
                "date": pay.date,
                "method": pay.get_payment_method_display(),
                "payment_method": pay.payment_method,
                "transaction_number": pay.transaction_number,
                "is_pending_registration": pay.is_pending_registration,
                "invoice_id": pay.invoice_id,
                "payment_type": pay.movement_type,
                "display_id": pay.display_id,
                "code": pay.display_id,
            })

        return docs
