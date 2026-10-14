"""
Backfill de vínculos documentales históricos (M1: GAP-01, GAP-02, GAP-03, INT-04).

Decisión D3: por defecto es un DRY-RUN: ejecuta todo dentro de una transacción que se
revierte al final, de modo que el informe refleja el efecto encadenado de los pasos sin
persistir nada. Con --apply la misma transacción se confirma.

    python manage.py backfill_document_links            # informe, no escribe
    python manage.py backfill_document_links --apply    # aplica lo informado

Reglas:
- Solo se enlaza cuando el candidato es ÚNICO; los casos ambiguos se informan y no se tocan.
- GAP-03: detalle de inventario → StockMove por (descripción del documento, producto, |cantidad|).
- GAP-02: línea de despacho/recepción → StockMove por (asiento o documento, producto, |cantidad base|).
- INT-04: el documento de inventario del despacho pasa a apuntar al despacho.
- GAP-01: quantity_delivered = Σ líneas de despachos confirmados; se omiten las OV con
  devoluciones o notas de crédito (su cantidad no es reconstruible sin GAP-15).
"""

from collections import defaultdict
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from billing.models import Invoice
from core.prefix_registry import EntityPrefix
from inventory.models import InventoryDocument, InventoryDocumentDetail, StockMove
from inventory.services import UoMService
from purchasing.models import PurchaseReceiptLine
from sales.models import SaleDelivery, SaleDeliveryLine, SaleLine, SaleOrder


class Command(BaseCommand):
    help = "Repara vínculos documentales históricos (dry-run por defecto)."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Aplica los cambios (por defecto solo informa).")

    def handle(self, *args, apply=False, **options):
        self.apply = apply
        self.stdout.write(self.style.WARNING("MODO APLICAR") if apply else "DRY-RUN (no se escribe nada)")
        with transaction.atomic():
            self.link_details_to_moves()
            self.link_lines_to_moves()
            self.repoint_delivery_documents()
            self.recompute_quantity_delivered()
            if not apply:
                transaction.set_rollback(True)

    # ── helpers ──────────────────────────────────────────────────────────────
    def _section(self, title):
        self.stdout.write(f"\n== {title}")

    def _linked_move_ids(self):
        return set(
            InventoryDocumentDetail.objects.filter(stock_move__isnull=False).values_list("stock_move_id", flat=True)
        )

    # ── GAP-03 ───────────────────────────────────────────────────────────────
    def link_details_to_moves(self):
        self._section("GAP-03 · detalle de inventario → StockMove")
        taken = self._linked_move_ids()
        linked = ambiguous = 0
        docs = InventoryDocument.objects.filter(
            status=InventoryDocument.Status.CONFIRMED, details__stock_move__isnull=True
        ).distinct()
        for doc in docs.iterator():
            description = f"{doc.get_document_type_display()} Doc: {doc.reference or doc.id}"
            moves = list(StockMove.objects.filter(description=description).exclude(id__in=taken))
            for detail in doc.details.filter(stock_move__isnull=True):
                candidates = [
                    m for m in moves
                    if m.product_id == detail.product_id and m.quantity == abs(detail.quantity) and m.id not in taken
                ]
                if len(candidates) != 1:
                    ambiguous += 1
                    continue
                move = candidates[0]
                taken.add(move.id)
                linked += 1
                InventoryDocumentDetail.objects.filter(pk=detail.pk).update(stock_move=move)
        self.stdout.write(f"  enlazables: {linked} · ambiguos/sin candidato: {ambiguous}")

    # ── GAP-02 ───────────────────────────────────────────────────────────────
    def _candidate_moves(self, journal_entry_id, doc_reference, doc_date, product_id, quantity, taken):
        """Por asiento del documento si existe; si no, por el documento de inventario (GAP-03)."""
        qs = StockMove.objects.filter(product_id=product_id, quantity=quantity).exclude(id__in=taken)
        qs = qs.filter(sale_delivery_line__isnull=True, purchase_receipt_line__isnull=True)
        if journal_entry_id:
            qs = qs.filter(journal_entry_id=journal_entry_id)
        else:
            qs = qs.filter(
                inventory_document_detail__document__reference=doc_reference,
                inventory_document_detail__document__date=doc_date,
            )
        return list(qs[:2])

    def link_lines_to_moves(self):
        self._section("GAP-02 · líneas de despacho/recepción → StockMove")
        taken = set()
        for label, lines, qty_of, je_of, ref_of, date_of in (
            (
                "despacho",
                SaleDeliveryLine.objects.filter(
                    delivery__status="CONFIRMED", product__track_inventory=True, stock_move__isnull=True
                ).select_related("delivery__sale_order", "product__uom", "uom", "sale_line__uom"),
                lambda ln: UoMService.convert_quantity(ln.quantity, from_uom=ln.uom or ln.sale_line.uom, to_uom=ln.product.uom),
                lambda ln: ln.delivery.journal_entry_id,
                lambda ln: f"Despacho {EntityPrefix.SALE_ORDER}-{ln.delivery.sale_order.number}",
                lambda ln: ln.delivery.delivery_date,
            ),
            (
                "recepción",
                PurchaseReceiptLine.objects.filter(
                    receipt__status="CONFIRMED", product__track_inventory=True, stock_move__isnull=True
                ).select_related("receipt__purchase_order", "product__uom", "uom", "purchase_line__uom"),
                lambda ln: abs(UoMService.convert_quantity(
                    ln.quantity_received, from_uom=ln.uom or ln.purchase_line.uom, to_uom=ln.product.uom)),
                lambda ln: ln.receipt.journal_entry_id,
                lambda ln: f"Recepción {ln.receipt.purchase_order.display_id}",
                lambda ln: ln.receipt.receipt_date,
            ),
        ):
            linked = ambiguous = 0
            for line in lines.iterator():
                candidates = self._candidate_moves(
                    je_of(line), ref_of(line), date_of(line), line.product_id, qty_of(line), taken
                )
                if len(candidates) != 1:
                    ambiguous += 1
                    continue
                taken.add(candidates[0].id)
                linked += 1
                line.stock_move = candidates[0]
                line.save(update_fields=["stock_move"])
            self.stdout.write(f"  {label}: enlazables {linked} · ambiguos/sin candidato {ambiguous}")

    # ── INT-04 ───────────────────────────────────────────────────────────────
    def repoint_delivery_documents(self):
        self._section("INT-04 · documento de inventario del despacho → despacho")
        changes = ambiguous = 0
        docs = InventoryDocument.objects.filter(
            document_type=InventoryDocument.Type.DELIVERY, source_document_type="sales.saleorder"
        )
        for doc in docs.iterator():
            delivery_ids = set(
                SaleDeliveryLine.objects.filter(
                    stock_move__inventory_document_detail__document=doc
                ).values_list("delivery_id", flat=True)
            )
            if not delivery_ids:
                # Sin líneas enlazadas (p. ej. explosión de BOM): único despacho confirmado de la OV en esa fecha
                delivery_ids = set(
                    SaleDelivery.objects.filter(
                        sale_order_id=doc.source_document_id,
                        status=SaleDelivery.Status.CONFIRMED,
                        delivery_date=doc.date,
                    ).values_list("id", flat=True)
                )
            if len(delivery_ids) != 1:
                ambiguous += 1
                continue
            changes += 1
            InventoryDocument.objects.filter(pk=doc.pk).update(
                source_document_type="sales.saledelivery", source_document_id=delivery_ids.pop()
            )
        self.stdout.write(f"  reapuntables: {changes} · sin despacho único: {ambiguous}")

    # ── GAP-01 (D3) ──────────────────────────────────────────────────────────
    def recompute_quantity_delivered(self):
        self._section("GAP-01 · quantity_delivered y estado de entrega de OV (D3: revisar antes de --apply)")
        orders_with_returns = set(
            SaleOrder.objects.filter(returns__isnull=False).values_list("id", flat=True)
        ) | set(
            Invoice.objects.filter(
                dte_type=Invoice.DTEType.NOTA_CREDITO, sale_order__isnull=False
            ).values_list("sale_order_id", flat=True)
        )
        delivered = defaultdict(Decimal)
        for sale_line_id, qty in SaleDeliveryLine.objects.filter(
            delivery__status=SaleDelivery.Status.CONFIRMED
        ).values_list("sale_line_id", "quantity"):
            delivered[sale_line_id] += qty

        changed_lines = 0
        touched_orders = set()
        skipped_orders = set()
        lines = SaleLine.objects.filter(order__status__in=["CONFIRMED", "INVOICED", "PAID"]).select_related("order")
        for line in lines.iterator():
            target = delivered.get(line.id, Decimal("0"))
            if line.quantity_delivered == target:
                continue
            if line.order_id in orders_with_returns:
                skipped_orders.add(line.order_id)
                continue
            changed_lines += 1
            touched_orders.add(line.order_id)
            self.stdout.write(
                f"  OV {line.order.number} línea {line.id}: {line.quantity_delivered} → {target}"
            )
            line.quantity_delivered = target
            line.save()

        status_changes = 0
        for order in SaleOrder.objects.filter(id__in=touched_orders):
            original = order.lines.filter(related_note__isnull=True)
            total = sum(sl.quantity for sl in original)
            done = sum(sl.quantity_delivered for sl in original)
            new_status = (
                SaleOrder.DeliveryStatus.PENDING if done == 0
                else SaleOrder.DeliveryStatus.DELIVERED if done >= total
                else SaleOrder.DeliveryStatus.PARTIAL
            )
            if new_status != order.delivery_status:
                status_changes += 1
                self.stdout.write(f"  OV {order.number}: estado {order.delivery_status} → {new_status}")
                SaleOrder.objects.filter(pk=order.pk).update(delivery_status=new_status)

        self.stdout.write(
            f"  líneas a corregir: {changed_lines} · OV con cambio de estado: {status_changes} · "
            f"OV omitidas por devoluciones/NC: {len(skipped_orders)}"
        )
