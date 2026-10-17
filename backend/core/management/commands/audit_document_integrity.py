"""
Auditoría de integridad documental — SOLO LECTURA (decisión D5, auditoría documental).

Ejecuta únicamente SELECTs y compara contra los umbrales del plan
(docs/50-audit/documental/document-migration-roadmap.md §5). Debe pasar antes de
cualquier carga de datos reales o puesta en marcha.

    python manage.py audit_document_integrity           # informe
    python manage.py audit_document_integrity --strict  # exit 1 si algún umbral falla
"""

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from billing.models import Invoice
from inventory.models import StockMove
from purchasing.models import PurchaseReceiptLine
from sales.models import SaleDeliveryLine, SaleLine
from treasury.models import PaymentAllocation, TreasuryMovement

NON_STOCK_TYPES = ("SERVICE", "SUBSCRIPTION")


def _stock_moves_without_document():
    return StockMove.objects.filter(
        inventory_document_detail__isnull=True,
        sale_delivery_line__isnull=True,
        purchase_receipt_line__isnull=True,
        sale_return_line__isnull=True,
        purchase_return_line__isnull=True,
        production_consumption__isnull=True,
    )


class Command(BaseCommand):
    help = "Informe de integridad del modelo documental (solo lectura)."

    def add_arguments(self, parser):
        parser.add_argument("--strict", action="store_true", help="Termina con error si algún umbral falla.")

    def handle(self, *args, strict=False, **options):
        # Servicios y suscripciones no mueven stock (track_inventory vale True por defecto
        # incluso para ellos, por eso se filtra por tipo de producto).
        delivery_lines = SaleDeliveryLine.objects.filter(
            delivery__status="CONFIRMED", product__track_inventory=True
        ).exclude(product__product_type__in=NON_STOCK_TYPES)
        receipt_lines = PurchaseReceiptLine.objects.filter(
            receipt__status="CONFIRMED", product__track_inventory=True
        ).exclude(product__product_type__in=NON_STOCK_TYPES)
        delivered_lines = SaleLine.objects.filter(
            order__delivery_status="DELIVERED", related_note__isnull=True
        )
        total_moves = StockMove.objects.count()
        orphan_moves = _stock_moves_without_document().count()
        orphan_pct = (orphan_moves * 100 / total_moves) if total_moves else 0

        # (métrica, valor, umbral, ok)
        checks = [
            (
                "GAP-01 líneas de OV DELIVERED con 0 entregado",
                delivered_lines.filter(quantity_delivered=0).count(), "= 0", None,
            ),
            (
                "GAP-02 líneas de despacho inventariables sin stock_move",
                delivery_lines.filter(stock_move__isnull=True).count(), "= 0", None,
            ),
            (
                "GAP-02 líneas de recepción inventariables sin stock_move",
                receipt_lines.filter(stock_move__isnull=True).count(), "= 0", None,
            ),
            ("GAP-03 % StockMove sin documento", round(orphan_pct, 1), "≤ 5", orphan_pct <= 5),
            (
                # ADR-0084: emitida = con folio; sin folio debe estar en borrador
                "ADR-0084 facturas emitidas (POSTED) sin folio",
                Invoice.objects.filter(status=Invoice.Status.POSTED)
                .filter(Q(number__isnull=True) | Q(number__in=["", "Draft"])).count(), "= 0", None,
            ),
            (
                # Asiento de devolución duplicado por anulación anterior al fix INT-15
                "INT-15 devoluciones por anulación con asiento propio",
                TreasuryMovement.objects.filter(
                    notes__startswith="Devolución por anulación:", journal_entry__isnull=False
                ).count(), "= 0", None,
            ),
        ]
        checks = [(n, v, t, (v == 0) if ok is None else ok) for n, v, t, ok in checks]

        info = [
            ("StockMove total", total_moves),
            ("StockMove sin documento", orphan_moves),
            ("Facturas", Invoice.objects.count()),
            ("Facturas sin OV ni OC", Invoice.objects.filter(sale_order__isnull=True, purchase_order__isnull=True).count()),
            ("Movimientos de tesorería con factura y OV", TreasuryMovement.objects.filter(
                invoice__isnull=False, sale_order__isnull=False).count()),
            ("PaymentAllocation", PaymentAllocation.objects.count()),
        ]

        self.stdout.write("Umbrales:")
        for name, value, threshold, ok in checks:
            mark = self.style.SUCCESS("OK  ") if ok else self.style.ERROR("FALLA")
            self.stdout.write(f"  {mark} {name}: {value} (umbral {threshold})")
        self.stdout.write("Informativo:")
        for name, value in info:
            self.stdout.write(f"  {name}: {value}")

        failed = [c for c in checks if not c[3]]
        if strict and failed:
            raise CommandError(f"{len(failed)} umbral(es) de integridad documental no se cumplen.")
