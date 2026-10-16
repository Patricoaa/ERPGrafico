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
            "payment_allocations__treasury_movement",
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
    def get_document_summary(order: SaleOrder) -> dict:
        """
        Resumen tipado de los documentos de la OV que necesitan la ficha y sus acciones
        (ADR-0083 U6; reemplaza los buckets `related_documents`): facturas, notas y despachos.
        Los pagos van en `serialized_payments`; las relaciones completas, en el endpoint de
        relaciones (ADR-0080).
        """
        from billing.models import Invoice

        note_types = (Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO)
        summary: dict = {"invoices": [], "notes": [], "deliveries": []}
        for inv in order.invoices.all():
            summary["notes" if inv.dte_type in note_types else "invoices"].append(invoice_summary(inv))
        for deliv in order.deliveries.all():
            if getattr(deliv, "related_note_id", None) is not None:
                continue
            summary["deliveries"].append({
                "id": deliv.id,
                "display_id": deliv.display_id,
                "status": deliv.status,
                "date": deliv.delivery_date,
            })
        return summary


class DraftCartSelector:
    @staticmethod
    def get_draft_by_id(draft_id: int):
        from .models import DraftCart

        return DraftCart.objects.select_related(
            "customer", "created_by", "last_modified_by", "pos_session", "locked_by"
        ).get(id=draft_id)

    @staticmethod
    def get_queryset_for_session(pos_session_id: int | None):
        from .models import DraftCart

        if not pos_session_id:
            return DraftCart.objects.none()

        return DraftCart.objects.filter(pos_session_id=pos_session_id).select_related(
            "customer", "created_by", "last_modified_by", "pos_session", "locked_by"
        )


class SaleDeliverySelector:
    @staticmethod
    def get_base_queryset():
        from .models import SaleDelivery

        return SaleDelivery.objects.select_related(
            "sale_order__customer", "warehouse", "related_note"
        ).prefetch_related(
            "lines__product", "lines__uom", "lines__sale_line"
        ).all()


def invoice_summary(inv) -> dict:
    """Forma única de una factura/nota dentro del resumen de una orden (ADR-0083 U6)."""
    return {
        "id": inv.id,
        "display_id": inv.display_id,
        "number": inv.number or "",
        "dte_type": inv.dte_type,
        "dte_type_display": inv.get_dte_type_display(),
        "status": inv.status,
        "total": inv.total,
    }
