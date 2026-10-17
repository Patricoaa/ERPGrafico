"""
Backfill de líneas propias de factura (ADR-0081, M4a).

Decisión D3: DRY-RUN por defecto (todo en una transacción que se revierte); --apply confirma.

    python manage.py backfill_invoice_lines            # informe
    python manage.py backfill_invoice_lines --apply

- Cada factura principal sin líneas recibe líneas espejo de las líneas originales de su
  orden: hoy toda factura es 1:1 con su orden por construcción.
- Las NC/ND no se tocan (sus líneas sobre líneas de factura llegan con GAP-14, M4c).
- Después recalcula quantity_invoiced e invoicing_status de todas las órdenes.
"""

from collections import Counter

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F

from billing.invoicing import PRIMARY_DTE_TYPES, InvoicingService
from billing.models import Invoice
from purchasing.models import PurchaseOrder
from sales.models import SaleOrder


class Command(BaseCommand):
    help = "Crea líneas propias para facturas existentes y recalcula el estado de facturación (dry-run por defecto)."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Aplica los cambios (por defecto solo informa).")

    def handle(self, *args, apply=False, **options):
        self.stdout.write(self.style.WARNING("MODO APLICAR") if apply else "DRY-RUN (no se escribe nada)")
        with transaction.atomic():
            self._run()
            if not apply:
                transaction.set_rollback(True)

    def _run(self):
        invoices = Invoice.objects.filter(dte_type__in=PRIMARY_DTE_TYPES, lines__isnull=True).select_related(
            "sale_order", "purchase_order"
        )
        mirrored = lines = without_order = 0
        for invoice in invoices.iterator():
            order = invoice.sale_order or invoice.purchase_order
            if order is None:
                without_order += 1
                continue
            lines += len(InvoicingService.mirror_order_lines(invoice, order))
            mirrored += 1
        self.stdout.write(
            f"\n== Líneas de factura\n  facturas con líneas espejo: {mirrored} · líneas creadas: {lines} · "
            f"facturas sin orden (omitidas): {without_order}"
        )

        self.stdout.write("\n== Estado de facturación")
        for model in (SaleOrder, PurchaseOrder):
            statuses = Counter()
            over_invoiced = []
            for order in model.objects.iterator(chunk_size=200):
                InvoicingService.recompute_order(order)
                statuses[str(order.invoicing_status)] += 1
                if order.lines.filter(quantity_invoiced__gt=F("quantity")).exists():
                    over_invoiced.append(order.number)
            self.stdout.write(f"  {model._meta.verbose_name}: {dict(statuses)}")
            if over_invoiced:
                self.stdout.write(self.style.WARNING(
                    f"    facturadas por sobre lo pedido (más de una factura activa): {len(over_invoiced)} "
                    f"→ {', '.join(over_invoiced[:20])}"
                ))
