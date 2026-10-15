"""
InvoicingService — líneas propias de factura y contadores de facturación (ADR-0081).

M4a: cada factura principal nueva recibe líneas espejo de su orden (factura = orden
completa, como hasta ahora); `quantity_invoiced` e `invoicing_status` se recalculan tras
crear / cancelar / anular. La facturación parcial y multi-orden llega en M4b.
"""

from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum

from .models import Invoice, InvoiceLine

# Documentos que facturan la orden (las NC/ND la corrigen; no cuentan como facturado).
PRIMARY_DTE_TYPES = (
    Invoice.DTEType.FACTURA,
    Invoice.DTEType.FACTURA_EXENTA,
    Invoice.DTEType.BOLETA,
    Invoice.DTEType.BOLETA_EXENTA,
    Invoice.DTEType.COMPROBANTE_PAGO,
    Invoice.DTEType.PURCHASE_INV,
)


def _is_sale_order(order) -> bool:
    return order._meta.label_lower == "sales.saleorder"


class InvoicingService:
    @staticmethod
    def mirror_order_lines(invoice: Invoice, order) -> list[InvoiceLine]:
        """Crea líneas espejo de las líneas originales (no de notas) de la orden."""
        if invoice.lines.exists():
            return list(invoice.lines.all())
        is_sale = _is_sale_order(order)
        lines = []
        for line in order.lines.filter(related_note__isnull=True).select_related("product"):
            lines.append(InvoiceLine(
                invoice=invoice,
                sale_line=line if is_sale else None,
                purchase_line=None if is_sale else line,
                product=line.product,
                description=getattr(line, "description", "") or (line.product.name if line.product else ""),
                quantity=line.quantity,
                uom_id=line.uom_id,
                unit_price=line.unit_price if is_sale else line.unit_cost,
                unit_price_gross=getattr(line, "unit_price_gross", None),
                tax_rate=line.tax_rate or 0,
                discount_amount=getattr(line, "discount_amount", 0) or 0,
                subtotal=line.subtotal or 0,
            ))
        return InvoiceLine.objects.bulk_create(lines)

    @staticmethod
    def recompute_order(order) -> None:
        """quantity_invoiced por línea e invoicing_status de la orden (D1.4)."""
        is_sale = _is_sale_order(order)
        line_field = "sale_line" if is_sale else "purchase_line"
        invoiced = dict(
            InvoiceLine.objects.filter(
                **{f"{line_field}__order": order},
                invoice__dte_type__in=PRIMARY_DTE_TYPES,
            )
            .exclude(invoice__status=Invoice.Status.CANCELLED)
            .values_list(line_field)
            .annotate(total=Sum("quantity"))
        )
        line_model = order.lines.model
        total_quantity = Decimal("0")
        total_invoiced = Decimal("0")
        for line in order.lines.all():
            value = invoiced.get(line.id, Decimal("0"))
            if line.quantity_invoiced != value:
                line_model.objects.filter(pk=line.pk).update(quantity_invoiced=value)
            if line.related_note_id is None:
                total_quantity += line.quantity
                total_invoiced += min(value, line.quantity)
        status_enum = order.InvoicingStatus
        if total_invoiced <= 0:
            status = status_enum.PENDING
        elif total_invoiced >= total_quantity:
            status = status_enum.INVOICED
        else:
            status = status_enum.PARTIAL
        if order.invoicing_status != status:
            type(order).objects.filter(pk=order.pk).update(invoicing_status=status)
            order.invoicing_status = status

    @staticmethod
    def orders_of(invoice: Invoice) -> list:
        """Órdenes que factura la factura: las de sus líneas, o la FK principal (N:M, D1)."""
        orders = {}
        for line in invoice.lines.select_related("sale_line__order", "purchase_line__order"):
            order = line.sale_line.order if line.sale_line_id else (line.purchase_line.order if line.purchase_line_id else None)
            if order is not None:
                orders[(order._meta.label_lower, order.pk)] = order
        primary = invoice.sale_order or invoice.purchase_order
        if primary is not None:
            orders.setdefault((primary._meta.label_lower, primary.pk), primary)
        return list(orders.values())

    @staticmethod
    def invoices_of(order):
        """Facturas de la orden: FK principal ∪ facturas cuyas líneas facturan la orden (N:M, D1)."""
        line_field = "sale_line" if _is_sale_order(order) else "purchase_line"
        via_lines = Invoice.objects.filter(**{f"lines__{line_field}__order": order}).values_list("pk", flat=True)
        return Invoice.objects.filter(pk__in=set(order.invoices.values_list("pk", flat=True)) | set(via_lines)).order_by("id")

    @staticmethod
    def release_advances(invoice: Invoice, reverse_entry: bool) -> None:
        """
        Libera los anticipos imputados por importe a la factura (D2, M4b) para que vuelvan
        a estar disponibles en la orden. Al anular una factura publicada se revierte además
        el asiento de conciliación RECO; las facturas legacy (anticipo por FK) no se tocan.
        """
        from accounting.models import JournalEntry
        from accounting.services import JournalEntryService
        from treasury.models import PaymentAllocation

        released = PaymentAllocation.objects.filter(invoice=invoice).delete()[0]
        if not (released and reverse_entry):
            return
        for entry in JournalEntry.objects.filter(reference=f"RECO-{invoice.id}", status=JournalEntry.State.POSTED):
            JournalEntryService.reverse_entry(entry, description=f"Anulación conciliación {invoice.display_id}",
                                              allow_automatic=True)

    @staticmethod
    def recompute_invoice_orders(invoice: Invoice) -> None:
        for order in InvoicingService.orders_of(invoice):
            InvoicingService.recompute_order(order)
