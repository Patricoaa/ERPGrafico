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
            "payment_allocations__treasury_movement",
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
    def get_document_summary(order) -> dict:
        """
        Resumen tipado de los documentos de la OC para la ficha y sus acciones (ADR-0083 U6;
        reemplaza los buckets `related_documents`): facturas, notas y recepciones. Los pagos van
        en `serialized_payments`; las relaciones completas, en el endpoint de relaciones.
        """
        from billing.models import Invoice
        from sales.selectors import invoice_summary

        note_types = (Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO)
        summary: dict = {"invoices": [], "notes": [], "receipts": []}
        for inv in order.invoices.all():
            summary["notes" if inv.dte_type in note_types else "invoices"].append(invoice_summary(inv))
        # Una entrada por recepción; `id` es siempre el de la recepción (GAP-07).
        for rec in order.receipts.all():
            if getattr(rec, "related_note_id", None) is not None:
                continue
            lines = list(rec.lines.all())
            summary["receipts"].append({
                "id": rec.id,
                "display_id": rec.display_id,
                "status": rec.status,
                "date": rec.receipt_date,
                "is_service": any(
                    line.product and line.product.product_type in ["SERVICE", "SUBSCRIPTION"]
                    for line in lines
                ),
            })
        return summary


class PurchaseReceiptSelector:
    @staticmethod
    def get_base_queryset():
        from .models import PurchaseReceipt

        return PurchaseReceipt.objects.select_related(
            "purchase_order__supplier", "warehouse", "related_note"
        ).prefetch_related(
            "lines__product", "lines__uom", "lines__stock_move"
        ).all()
