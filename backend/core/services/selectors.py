from core.models import ActionLog


class CoreSelector:
    @staticmethod
    def get_background_jobs_for_user(user):
        from core.models import BackgroundJob

        qs = BackgroundJob.objects.all()
        if not user.is_superuser:
            qs = qs.filter(user=user)
        return qs

    @staticmethod
    def get_global_audit_log(limit):
        from accounting.models import JournalEntry
        from billing.models import Invoice
        from contacts.models import Contact
        from inventory.models import Product, StockMove
        from production.models import WorkOrder
        from purchasing.models import PurchaseOrder
        from sales.models import SaleOrder
        from treasury.models import TreasuryMovement

        from .serializers import ActionLogSerializer, HistoricalRecordSerializer

        logs = ActionLogSerializer(ActionLog.objects.all()[:limit], many=True).data
        for l in logs:
            l.update(
                {
                    "source": "action_log",
                    "entity_type": "system",
                    "date": l["timestamp"],
                    "type_label": l["action_type_display"],
                }
            )

        models = [
            (Product, "product", "Producto"),
            (SaleOrder, "sale_order", "Nota de Venta"),
            (PurchaseOrder, "purchase_order", "Orden de Compra"),
            (Contact, "contact", "Contacto"),
            (Invoice, "invoice", "Factura"),
            (TreasuryMovement, "treasury_movement", "Movimiento de Tesorería"),
            (WorkOrder, "work_order", "Orden de Trabajo"),
            (StockMove, "stock_move", "Movimiento Stock"),
            (JournalEntry, "journal_entry", "Asiento Contable"),
        ]

        all_hist = []
        for m, t_slug, t_lbl in models:
            if hasattr(m, "history"):
                for r in HistoricalRecordSerializer(m.history.all()[:limit], many=True).data:
                    verb = (
                        "creó"
                        if r["history_type"] == "+"
                        else "editó"
                        if r["history_type"] == "~"
                        else "eliminó"
                    )
                    obj_name = str(
                        next(
                            (
                                r.get(f)
                                for f in ["number", "name", "internal_code", "display_id", "id"]
                                if r.get(f)
                            ),
                            "",
                        )
                    )
                    r.update(
                        {
                            "source": "history",
                            "entity_type": t_slug,
                            "entity_label": t_lbl,
                            "date": r["history_date"],
                            "description": f"{verb.capitalize()} {t_lbl.lower()} {obj_name}".strip(),
                            "user_name": r["history_user_username"],
                        }
                    )
                    all_hist.append(r)

        combined = logs + all_hist
        combined.sort(key=lambda x: x["date"], reverse=True)
        return combined[:limit]
