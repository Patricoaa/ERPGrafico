from django.utils import timezone

from tax.services import AccountingPeriodService, TaxPeriodService
from .models import SaleOrder


class SaleOrderSelector:
    @staticmethod
    def get_base_queryset():
        from .models import SaleOrder

        return SaleOrder.objects.select_related(
            "customer", "credit_approval_task", "pos_session"
        ).prefetch_related(
            "lines",
            "lines__product",
            "lines__product__manufacturing_profile",
            "lines__work_orders",
            "invoices",
            "deliveries",
            "payments",
            "work_orders",
        ).order_by("-date", "-id")

    @staticmethod
    def get_customer_name_suggestions(q):
        from .models import SaleOrder

        names = (
            SaleOrder.objects.filter(customer__name__icontains=q)
            .values_list("customer__name", flat=True)
            .distinct()
            .order_by("customer__name")[:10]
        )
        return list(names)

    @staticmethod
    def get_credit_history_queryset():
        from .models import SaleOrder

        return SaleOrder.objects.filter(credit_assignment_origin__isnull=False).order_by(
            "-date", "-created_at"
        )
    @staticmethod
    def get_cancel_impact(order: SaleOrder) -> dict:
        action_kind = "soft_cancel" if order.status == "DRAFT" else "full_annul"
        impact = {
            "order_status": order.status,
            "invoices": [
                {"id": inv.id, "display_id": inv.display_id, "status": inv.status}
                for inv in order.invoices.all()
            ],
            "deliveries": [{"id": d.id, "status": d.status} for d in order.deliveries.all()],
            "payments": [
                {
                    "id": p.id,
                    "amount": str(p.amount),
                    "status": p.status if hasattr(p, "status") else "POSTED",
                }
                for p in order.payments.all()
            ],
            "work_orders": [
                {"id": w.id, "number": w.number, "status": w.status, "stage": w.current_stage}
                for w in order.work_orders.exclude(status="CANCELLED")
            ],
            "has_confirmed_deliveries": order.deliveries.filter(status="CONFIRMED").exists(),
            "has_posted_payments": order.payments.filter(journal_entry__status="POSTED").exists(),
            "has_folio_invoices": order.invoices.exclude(number="")
            .exclude(number="Draft")
            .exclude(number__isnull=True)
            .exists(),
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
    def get_related_documents(order: SaleOrder) -> dict:
        """Returns a summary of all documents related to this sale order for UI linking."""
        from billing.models import Invoice

        _NOTE_TYPES = [Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO]
        docs: dict = {"invoices": [], "notes": [], "payments": [], "deliveries": []}

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

        for deliv in order.deliveries.all():
            if getattr(deliv, "related_note_id", None) is not None:
                continue
            docs["deliveries"].append({
                "id": deliv.id,
                "number": deliv.number,
                "display_id": deliv.display_id,
                "status": deliv.status,
                "date": deliv.delivery_date,
                "docType": "sale_delivery",
            })

        for pay in order.payments.all():
            docs["payments"].append({
                "id": pay.id,
                "amount": pay.amount,
                "date": pay.date,
                "payment_method": pay.payment_method,
                "payment_method_display": pay.get_payment_method_display(),
                "method": pay.get_payment_method_display(),
                "transaction_number": pay.transaction_number,
                "is_pending_registration": pay.is_pending_registration,
                "reference": pay.reference,
                "invoice_id": pay.invoice_id,
                "display_id": pay.display_id,
                "code": pay.display_id,
            })

        return docs
