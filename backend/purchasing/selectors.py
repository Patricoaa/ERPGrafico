from django.utils import timezone

from tax.services import AccountingPeriodService, TaxPeriodService


class PurchaseOrderSelector:
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
