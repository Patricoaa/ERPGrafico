from django.utils import timezone

from tax.services import AccountingPeriodService, TaxPeriodService
from .models import SaleOrder

class SaleOrderSelector:
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
