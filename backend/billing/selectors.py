from .models import Invoice


class InvoiceSelector:
    @staticmethod
    def check_folio_uniqueness(
        *,
        number: str,
        dte_type: str,
        exclude_id: int | None = None,
        contact_id: int | None = None,
        is_purchase: bool = False,
    ) -> dict:
        """
        Validates folio uniqueness for a given document type.
        Returns a dict with is_unique, message, and optionally existing_invoice.
        """
        # Skip validation for empty or draft numbers
        if not number or number == "Draft" or number.strip() == "":
            return {"is_unique": True, "message": "OK"}

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
    def get_cancel_impact(invoice: Invoice) -> dict:
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
