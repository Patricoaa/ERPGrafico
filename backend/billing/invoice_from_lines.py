"""
Facturación parcial y multi-orden por cantidad (ADR-0081, etapa M4b).

Reglas (decisiones D1.1–D1.4, D2):
- Por cantidad sobre líneas originales de OV/OC; nunca más de lo pendiente de facturar.
- Factura parcial de productos entregables → cada línea indica su línea de despacho/recepción
  confirmada, y no se factura más de lo entregado en ella.
- Varias órdenes en una factura: mismo cliente/proveedor.
- Anticipos: se imputan por importe a la factura (`PaymentAllocation`); lo no facturado
  queda disponible para la siguiente factura.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .invoicing import PRIMARY_DTE_TYPES, InvoicingService
from .models import Invoice, InvoiceLine

NON_DELIVERABLE_TYPES = ("SERVICE", "SUBSCRIPTION")


@dataclass(frozen=True)
class _Side:
    is_sale: bool

    @property
    def line_model(self):
        if self.is_sale:
            from sales.models import SaleLine
            return SaleLine
        from purchasing.models import PurchaseLine
        return PurchaseLine

    @property
    def fulfil_model(self):
        if self.is_sale:
            from sales.models import SaleDeliveryLine
            return SaleDeliveryLine
        from purchasing.models import PurchaseReceiptLine
        return PurchaseReceiptLine

    line_field = property(lambda self: "sale_line" if self.is_sale else "purchase_line")
    fulfil_field = property(lambda self: "delivery_line" if self.is_sale else "receipt_line")
    fulfil_doc = property(lambda self: "delivery" if self.is_sale else "receipt")
    fulfil_qty = property(lambda self: "quantity" if self.is_sale else "quantity_received")
    partner_field = property(lambda self: "customer" if self.is_sale else "supplier")
    order_field = property(lambda self: "sale_order" if self.is_sale else "purchase_order")


def _q(value) -> Decimal:
    return Decimal(str(value))


def _round(value: Decimal) -> Decimal:
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def _line_amount(side: _Side, line, quantity: Decimal) -> Decimal:
    """Subtotal de `quantity` unidades de la línea, con la misma semántica que line.subtotal."""
    if side.is_sale and line.unit_price_gross:
        discount = (line.discount_amount or Decimal("0")) * quantity / line.quantity if line.quantity else 0
        return _round(max(Decimal("0"), quantity * line.unit_price_gross - discount))
    unit = line.unit_price if side.is_sale else line.unit_cost
    return _round(quantity * unit)


class InvoiceFromLinesService:
    @staticmethod
    @transaction.atomic
    def create(*, side: str, dte_type: str, items: list[dict], status: str = Invoice.Status.DRAFT,
               number: str = "", date=None, payment_method: str = "CREDIT",
               document_attachment=None) -> Invoice:
        """
        items: [{"order_line_id": int, "quantity": Decimal, "fulfillment_line_id": int | None}]
        (`fulfillment_line_id` = línea de despacho en ventas / de recepción en compras)
        """
        s = _Side(is_sale=(side == "sale"))
        if side not in ("sale", "purchase"):
            raise ValidationError("side debe ser 'sale' o 'purchase'.")
        if dte_type not in PRIMARY_DTE_TYPES:
            raise ValidationError(f"Tipo de documento no facturable por líneas: {dte_type}.")
        if not items:
            raise ValidationError("Debe indicar al menos una línea a facturar.")
        if status == Invoice.Status.POSTED and not s.is_sale and not number:
            raise ValidationError("El número de folio es obligatorio para publicar la factura.")

        lines_by_id, fulfil_by_id = InvoiceFromLinesService._load(s, items)
        orders = InvoiceFromLinesService._validate(s, items, lines_by_id, fulfil_by_id)

        primary = orders[0]
        partner = getattr(primary, s.partner_field)
        invoice = Invoice.objects.create(
            dte_type=dte_type, number=number or "", date=date or timezone.now().date(),
            status=status, payment_method=payment_method, contact=partner,
            document_attachment=document_attachment,
            **{s.order_field: primary},
        )
        InvoiceFromLinesService._create_lines(s, invoice, items, lines_by_id)
        InvoiceFromLinesService._totals(s, invoice, orders)
        InvoiceFromLinesService._journal_entry(s, invoice, status)
        InvoiceFromLinesService._allocate_advances(s, invoice, orders)

        for order in orders:
            if order.status == order.Status.CONFIRMED or str(order.status) == "RECEIVED":
                type(order).objects.filter(pk=order.pk).update(status=order.Status.INVOICED)
            InvoicingService.recompute_order(order)
        if status == Invoice.Status.POSTED:
            from workflow.services import WorkflowService

            for order in orders:
                WorkflowService.sync_hub_tasks(order)
        return invoice

    # ── carga y validación ─────────────────────────────────────────────────
    @staticmethod
    def _load(s: _Side, items):
        line_ids = [int(i["order_line_id"]) for i in items]
        # of=("self",): solo se bloquean las líneas; product es nullable (LEFT JOIN) y PostgreSQL
        # no permite FOR UPDATE sobre el lado nullable de un outer join.
        lines = s.line_model.objects.select_for_update(of=("self",)).filter(pk__in=line_ids).select_related("order", "product")
        lines_by_id = {line.pk: line for line in lines}
        missing = set(line_ids) - set(lines_by_id)
        if missing:
            raise ValidationError(f"Líneas de orden inexistentes: {sorted(missing)}.")
        fulfil_ids = [int(i["fulfillment_line_id"]) for i in items if i.get("fulfillment_line_id")]
        fulfil = s.fulfil_model.objects.filter(pk__in=fulfil_ids).select_related(s.fulfil_doc)
        return lines_by_id, {f.pk: f for f in fulfil}

    @staticmethod
    def _validate(s: _Side, items, lines_by_id, fulfil_by_id):
        orders = {}
        requested = defaultdict(Decimal)
        for item in items:
            line = lines_by_id[int(item["order_line_id"])]
            qty = _q(item["quantity"])
            if qty <= 0:
                raise ValidationError("Las cantidades a facturar deben ser mayores a cero.")
            if line.related_note_id:
                raise ValidationError("Las líneas de notas no se facturan; use la nota correspondiente.")
            requested[line.pk] += qty
            orders[line.order_id] = line.order

        order_list = sorted(orders.values(), key=lambda o: o.pk)
        partners = {getattr(o, f"{s.partner_field}_id") for o in order_list}
        if len(partners) > 1:
            raise ValidationError("Todas las órdenes de una factura deben ser del mismo cliente/proveedor.")
        for order in order_list:
            if order.status in ("DRAFT", "CANCELLED"):
                raise ValidationError(f"La orden {order.display_id} no admite facturación (estado {order.status}).")

        # D1.1: nunca más de lo pendiente de facturar
        for line_id, qty in requested.items():
            line = lines_by_id[line_id]
            pending = line.quantity - line.quantity_invoiced
            if qty > pending:
                raise ValidationError(
                    f"{line.description or line.product}: se intenta facturar {qty} y quedan {pending} por facturar."
                )

        # ¿La factura completa todas las órdenes involucradas?
        completes = all(
            all(
                ol.quantity - ol.quantity_invoiced - requested.get(ol.pk, Decimal("0")) <= 0
                for ol in o.lines.filter(related_note__isnull=True)
            )
            for o in order_list
        )

        # D1.2: factura parcial de entregables → atada a la entrega, sin superar lo entregado
        per_fulfil = defaultdict(Decimal)
        for item in items:
            line = lines_by_id[int(item["order_line_id"])]
            fid = item.get("fulfillment_line_id")
            deliverable = line.product is not None and line.product.product_type not in NON_DELIVERABLE_TYPES
            if not fid:
                if deliverable and not completes:
                    raise ValidationError(
                        f"{line.description or line.product}: una factura parcial debe indicar la "
                        f"{'línea de despacho' if s.is_sale else 'línea de recepción'} que factura (D1.2)."
                    )
                continue
            fulfil = fulfil_by_id.get(int(fid))
            if fulfil is None or getattr(fulfil, f"{s.line_field}_id") != line.pk:
                raise ValidationError(f"La línea de entrega {fid} no corresponde a la línea de orden {line.pk}.")
            if getattr(fulfil, s.fulfil_doc).status != "CONFIRMED":
                raise ValidationError(f"La entrega de la línea {fid} no está confirmada.")
            per_fulfil[fulfil.pk] += _q(item["quantity"])

        for fid, qty in per_fulfil.items():
            fulfil = fulfil_by_id[fid]
            already = (
                InvoiceLine.objects.filter(**{s.fulfil_field: fulfil}, invoice__dte_type__in=PRIMARY_DTE_TYPES)
                .exclude(invoice__status=Invoice.Status.CANCELLED)
                .aggregate(total=Sum("quantity"))["total"] or Decimal("0")
            )
            delivered = abs(_q(getattr(fulfil, s.fulfil_qty)))
            if already + qty > delivered:
                raise ValidationError(
                    f"No se puede facturar más de lo entregado: entrega {fid} tiene {delivered}, "
                    f"ya facturado {already}, se intenta facturar {qty}."
                )
        return order_list

    # ── creación ───────────────────────────────────────────────────────────
    @staticmethod
    def _create_lines(s: _Side, invoice, items, lines_by_id):
        rows = []
        for item in items:
            line = lines_by_id[int(item["order_line_id"])]
            qty = _q(item["quantity"])
            rows.append(InvoiceLine(
                invoice=invoice,
                **{s.line_field: line},
                **({f"{s.fulfil_field}_id": int(item["fulfillment_line_id"])} if item.get("fulfillment_line_id") else {}),
                product=line.product,
                description=getattr(line, "description", "") or (line.product.name if line.product else ""),
                quantity=qty,
                uom_id=line.uom_id,
                unit_price=line.unit_price if s.is_sale else line.unit_cost,
                unit_price_gross=getattr(line, "unit_price_gross", None),
                tax_rate=line.tax_rate or 0,
                discount_amount=_round((getattr(line, "discount_amount", 0) or 0) * qty / line.quantity) if line.quantity else 0,
                subtotal=_line_amount(s, line, qty),
            ))
        InvoiceLine.objects.bulk_create(rows)

    @staticmethod
    def _totals(s: _Side, invoice, orders):
        if s.is_sale:
            invoice.total_discount_amount = sum(
                (InvoiceFromLinesService._discount_share(invoice, order) for order in orders), Decimal("0")
            )
            from core.strategies.totals import GrossFirstTotals
            GrossFirstTotals().compute(invoice, commit=False)
        else:
            from core.strategies.totals import NetFirstTotals
            NetFirstTotals().compute(invoice, commit=False)
        invoice.save()

    @staticmethod
    def _discount_share(invoice, order) -> Decimal:
        """Descuento global de la orden prorrateado por el bruto facturado; la factura que completa la orden toma el resto."""
        discount = getattr(order, "total_discount_amount", None) or Decimal("0")
        if discount <= 0:
            return Decimal("0")
        original = order.lines.filter(related_note__isnull=True)
        gross_total = sum((ol.subtotal for ol in original), Decimal("0"))
        if gross_total <= 0:
            return Decimal("0")

        def share(inv) -> Decimal:
            gross = inv.lines.filter(sale_line__order=order).aggregate(t=Sum("subtotal"))["t"] or Decimal("0")
            return _round(discount * gross / gross_total)

        completes = all(ol.quantity_invoiced + (
            invoice.lines.filter(sale_line=ol).aggregate(t=Sum("quantity"))["t"] or 0) >= ol.quantity for ol in original)
        if not completes:
            return share(invoice)
        previous = (
            Invoice.objects.filter(lines__sale_line__order=order, dte_type__in=PRIMARY_DTE_TYPES)
            .exclude(pk=invoice.pk).exclude(status=Invoice.Status.CANCELLED).distinct()
        )
        return discount - sum((share(inv) for inv in previous), Decimal("0"))

    @staticmethod
    def _journal_entry(s: _Side, invoice, status):
        from accounting.models import AccountingSettings, JournalEntry
        from accounting.services import AccountingMapper, JournalEntryService

        settings = AccountingSettings.get_solo()
        mapper = AccountingMapper.get_entries_for_sale_invoice if s.is_sale else AccountingMapper.get_entries_for_purchase_bill
        description, _reference, items = mapper(invoice, settings)
        entry = JournalEntryService.create_entry(
            {
                "date": invoice.date, "description": description, "status": JournalEntry.State.DRAFT,
                "is_manual": False, "source_content_type": ContentType.objects.get_for_model(invoice),
                "source_object_id": invoice.id,
            },
            items,
        )
        if status == Invoice.Status.POSTED:
            JournalEntryService.post_entry(entry)
        invoice.journal_entry = entry
        invoice.save(update_fields=["journal_entry"])

    # ── anticipos (D2) ─────────────────────────────────────────────────────
    @staticmethod
    def _allocate_advances(s: _Side, invoice, orders):
        from accounting.glosa_builder import GlosaBuilder, Roles
        from accounting.models import AccountingSettings, JournalEntry, JournalItem
        from accounting.services import JournalEntryService
        from treasury.models import PaymentAllocation, TreasuryMovement

        remaining = invoice.total
        direction = TreasuryMovement.Type.INBOUND if s.is_sale else TreasuryMovement.Type.OUTBOUND
        allocated_total = Decimal("0")
        for order in orders:
            advances = order.payments.filter(invoice__isnull=True, movement_type=direction).exclude(
                status=TreasuryMovement.MovementStatus.CANCELLED
            ).order_by("date", "id")
            for payment in advances:
                if remaining <= 0:
                    break
                used = PaymentAllocation.objects.filter(treasury_movement=payment).aggregate(t=Sum("amount"))["t"] or 0
                available = payment.amount - used
                amount = min(available, remaining)
                if amount <= 0:
                    continue
                PaymentAllocation.objects.create(treasury_movement=payment, invoice=invoice, amount=amount,
                                                 notes=f"Anticipo imputado a {invoice.display_id} (D2)")
                remaining -= amount
                allocated_total += amount
        if allocated_total <= 0:
            return

        settings = AccountingSettings.get_solo()
        partner = invoice.contact
        partner_name = partner.name if partner else ""
        doc_id = invoice.display_id
        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description=GlosaBuilder.build(GlosaBuilder.CONCILIACION_ANTICIPOS, doc_id, partner_name, allocated_total),
            reference=f"RECO-{invoice.id}", status=JournalEntry.State.DRAFT,
            source_content_type=ContentType.objects.get_for_model(Invoice), source_object_id=invoice.id,
        )
        if s.is_sale:
            receivable = settings.default_receivable_account
            advance = settings.default_advance_payment_account or receivable
            debit, credit, debit_role, credit_role = advance, receivable, Roles.ANTICIPO, Roles.CXC
        else:
            payable = settings.default_payable_account
            prepayment = settings.default_prepayment_account or payable
            debit, credit, debit_role, credit_role = payable, prepayment, Roles.CXP, Roles.ANTICIPO
        JournalItem.objects.create(entry=entry, account=debit, debit=allocated_total, credit=0, partner=partner,
                                   partner_name=partner_name, label=GlosaBuilder.item(debit_role, partner_name, doc_id))
        JournalItem.objects.create(entry=entry, account=credit, debit=0, credit=allocated_total, partner=partner,
                                   partner_name=partner_name, label=GlosaBuilder.item(credit_role, partner_name, doc_id))
        JournalEntryService.post_entry(entry)
