"""Unión manual del cuadre: vincular, quitar y devolver al cruce automático (spec §5.5).

Cada acción bloquea los grupos que toca, mueve los registros, borra el huérfano que
queda vacío y re-deriva en el acto el estado de los grupos tocados. Un registro que
se quita queda en un grupo huérfano marcado como manual: el motor no vuelve a crear
el mismo par en la corrida siguiente hasta que el usuario lo devuelve (``release``).
"""

from datetime import timedelta
from decimal import Decimal
from typing import Literal

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import Exists, OuterRef, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from accounting.integrations.rcv_normalizer import normalize_rut
from accounting.models import RCVDocument
from billing.fiscal_key import fiscal_direction_expression, sii_code_expression
from billing.models import Invoice
from tax.fiscal_match.candidates import local_midnight, sale_document_status_q, stamp_groups
from tax.fiscal_match.groups import (
    SALE_SII_CODES,
    group_for_invoice,
    rcv_orphan_group,
    tuu_orphan_group,
)
from tax.fiscal_match.issuing import issue_fiscal_drafts
from tax.fiscal_match.rcv import RCV_TO_FISCAL_DIRECTION, rcv_group_candidates, rut_body
from tax.fiscal_match.states import STATE_FIELDS, build_context, evaluate
from tax.models import FiscalMatch
from treasury.models import TerminalSale, TreasuryMovement

CANDIDATE_CAP = 20
PAYMENT_REQUIRED = "Indique el pago del documento al que corresponde la venta TUU."

LinkPart = Literal["erp", "tuu", "rcv"]
UnlinkPart = Literal["tuu", "rcv"]


# --- utilidades ---------------------------------------------------------------


def _lock(group: FiscalMatch) -> FiscalMatch:
    return FiscalMatch.objects.select_for_update().get(pk=group.pk)


def _rederive(group_ids: set[int]) -> None:
    """Deriva y guarda el estado de los grupos que aún existen, y marca su ``updated_at``."""
    groups = list(FiscalMatch.objects.filter(id__in=group_ids).order_by("id"))
    if groups:
        evaluate(groups, build_context(groups))
        FiscalMatch.objects.bulk_update(groups, STATE_FIELDS)
    stamp_groups({g.id for g in groups})


def _drop_empty(group_ids: set[int]) -> None:
    FiscalMatch.objects.filter(
        id__in=group_ids, invoice__isnull=True, terminal_sales__isnull=True, rcv_documents__isnull=True
    ).delete()


def _fresh(group_id: int) -> FiscalMatch:
    return FiscalMatch.objects.get(pk=group_id)


def _require_invoice_group(group: FiscalMatch) -> Invoice:
    if group.invoice_id is None:
        raise ValidationError("El grupo no tiene un documento del ERP.")
    return group.invoice


def _require_orphan(group: FiscalMatch) -> None:
    if group.invoice_id is not None:
        raise ValidationError("El grupo ya tiene un documento del ERP.")


def _orphan_of(record: TerminalSale | RCVDocument) -> FiscalMatch:
    """Grupo huérfano (bloqueado) donde está el registro; error si ya tiene documento."""
    if record.fiscal_match_id is None:
        raise ValidationError("El registro aún no tiene grupo de cuadre.")
    orphan = FiscalMatch.objects.select_for_update().get(pk=record.fiscal_match_id)
    if orphan.invoice_id is not None:
        raise ValidationError("El registro ya está vinculado a un documento del ERP.")
    return orphan


def _taken_movements(movement_ids: list[int], *, excluding: list[int] = ()) -> set[int]:
    return set(
        TerminalSale.objects.filter(matched_movement_id__in=movement_ids)
        .exclude(id__in=excluding)
        .values_list("matched_movement_id", flat=True)
    )


def _inbound(invoice: Invoice) -> list[TreasuryMovement]:
    return list(
        TreasuryMovement.objects.filter(invoice=invoice, movement_type=TreasuryMovement.Type.INBOUND).order_by("id")
    )


def _check_movement(sale: TerminalSale, movement: TreasuryMovement, invoice: Invoice) -> None:
    if movement.invoice_id != invoice.pk or movement.movement_type != TreasuryMovement.Type.INBOUND:
        raise ValidationError("El pago no es un cobro del documento del grupo.")
    if Decimal(movement.amount) != Decimal(sale.sale_amount):
        raise ValidationError("El monto del pago no coincide con el de la venta TUU.")
    if _taken_movements([movement.pk], excluding=[sale.pk]):
        raise ValidationError("El pago ya está respaldado por otra venta TUU.")


def _check_rcv(group: FiscalMatch, invoice: Invoice, doc: RCVDocument) -> None:
    if RCV_TO_FISCAL_DIRECTION[doc.direction] != group.direction:
        raise ValidationError("El registro del SII es de otra dirección (compra/venta).")
    if doc.dte_type != invoice.sii_code:
        raise ValidationError("El registro del SII es de otro tipo de documento.")
    if normalize_rut(doc.counterparty_rut) != group.counterparty_rut:
        raise ValidationError("El registro del SII es de otro RUT.")


# --- vincular -------------------------------------------------------------------


@transaction.atomic
def link_invoice(group: FiscalMatch, invoice: Invoice, movement: TreasuryMovement | None = None) -> FiscalMatch:
    """Une un grupo huérfano al documento ERP: sus registros pasan al grupo del documento."""
    orphan = _lock(group)
    _require_orphan(orphan)
    target = group_for_invoice(invoice)
    if target is None:
        raise ValidationError("El documento no entra al cuadre.")
    target = _lock(target)
    if target.direction != orphan.direction:
        raise ValidationError("El documento es de otra dirección (compra/venta).")

    sales = list(TerminalSale.objects.filter(fiscal_match=orphan).order_by("transaction_at", "id"))
    if sales:
        _assign_payments(sales, invoice, movement)
        for sale in sales:
            sale.fiscal_match, sale.linked_manually = target, True
        TerminalSale.objects.bulk_update(sales, ["fiscal_match", "matched_movement", "linked_manually"])
    if RCVDocument.objects.filter(fiscal_match=orphan).update(fiscal_match=target):
        target.rcv_linked_manually = True
        target.save(update_fields=["rcv_linked_manually"])
    _drop_empty({orphan.pk})
    _rederive({orphan.pk, target.pk})
    return _fresh(target.pk)


def _assign_payments(sales: list[TerminalSale], invoice: Invoice, movement: TreasuryMovement | None) -> None:
    """A cada venta su cobro del documento: el indicado o el único libre del mismo monto."""
    inbound = _inbound(invoice)
    taken = _taken_movements([m.pk for m in inbound], excluding=[s.pk for s in sales])
    free = [m for m in inbound if m.pk not in taken]
    for sale in sales:
        if movement is not None and Decimal(movement.amount) == Decimal(sale.sale_amount):
            _check_movement(sale, movement, invoice)
            chosen, movement = movement, None
        else:
            fits = [m for m in free if Decimal(m.amount) == Decimal(sale.sale_amount)]
            if len(fits) != 1:
                raise ValidationError(PAYMENT_REQUIRED)
            chosen = fits[0]
        free = [m for m in free if m.pk != chosen.pk]
        sale.matched_movement = chosen
    if movement is not None:
        raise ValidationError("El monto del pago no coincide con el de la venta TUU.")


@transaction.atomic
def link_terminal_sale(group: FiscalMatch, sale: TerminalSale, movement: TreasuryMovement) -> FiscalMatch:
    """Agrega al documento una venta TUU huérfana como respaldo de uno de sus cobros."""
    group = _lock(group)
    invoice = _require_invoice_group(group)
    if sale.status != TerminalSale.Status.COMPLETED:
        raise ValidationError("La venta TUU no está completada.")
    orphan = _orphan_of(sale)
    _check_movement(sale, movement, invoice)
    sale.fiscal_match, sale.matched_movement, sale.linked_manually = group, movement, True
    sale.save(update_fields=["fiscal_match", "matched_movement", "linked_manually"])
    # Como el cruce automático: las boletas RCV del huérfano acompañan a su venta si el
    # documento aún no tiene registro del SII.
    if not RCVDocument.objects.filter(fiscal_match=group).exists():
        RCVDocument.objects.filter(fiscal_match=orphan).update(fiscal_match=group)
    _drop_empty({orphan.pk})
    _rederive({orphan.pk, group.pk})
    return _fresh(group.pk)


@transaction.atomic
def link_rcv_document(group: FiscalMatch, doc: RCVDocument) -> FiscalMatch:
    """Agrega al documento un registro del SII huérfano del mismo tipo y RUT."""
    group = _lock(group)
    invoice = _require_invoice_group(group)
    _check_rcv(group, invoice, doc)
    orphan = _orphan_of(doc)
    if TerminalSale.objects.filter(fiscal_match=orphan).exists():
        raise ValidationError("El registro del SII está unido a una venta TUU; vincule la venta.")
    doc.fiscal_match = group
    doc.save(update_fields=["fiscal_match"])
    group.rcv_linked_manually = True
    group.save(update_fields=["rcv_linked_manually"])
    _drop_empty({orphan.pk})
    _rederive({orphan.pk, group.pk})
    return _fresh(group.pk)


def link(group: FiscalMatch, part: LinkPart, record_id: int, movement_id: int | None = None) -> FiscalMatch:
    """Despacha la unión pedida por la API; devuelve el grupo resultante."""
    movement = get_object_or_404(TreasuryMovement, pk=movement_id) if movement_id is not None else None
    if part == "erp":
        return link_invoice(group, get_object_or_404(Invoice, pk=record_id), movement)
    if part == "tuu":
        if movement is None:
            raise ValidationError(PAYMENT_REQUIRED)
        return link_terminal_sale(group, get_object_or_404(TerminalSale, pk=record_id), movement)
    return link_rcv_document(group, get_object_or_404(RCVDocument, pk=record_id))


# --- quitar y devolver ----------------------------------------------------------------


@transaction.atomic
def unlink(group: FiscalMatch, part: UnlinkPart, record_id: int) -> FiscalMatch:
    """Saca un registro a un grupo huérfano nuevo marcado como manual (Review Focus 2)."""
    group = _lock(group)
    if part == "tuu":
        sale = TerminalSale.objects.filter(fiscal_match=group, pk=record_id).first()
        if sale is None:
            raise ValidationError("La venta TUU no pertenece a este grupo.")
        orphan = tuu_orphan_group(sale)
        orphan.save()
        sale.fiscal_match, sale.matched_movement, sale.linked_manually = orphan, None, True
        sale.save(update_fields=["fiscal_match", "matched_movement", "linked_manually"])
    else:
        doc = RCVDocument.objects.filter(fiscal_match=group, pk=record_id).first()
        if doc is None:
            raise ValidationError("El registro del SII no pertenece a este grupo.")
        orphan = rcv_orphan_group(doc)
        orphan.rcv_linked_manually = True
        orphan.save()
        doc.fiscal_match = orphan
        doc.save(update_fields=["fiscal_match"])
        if group.rcv_linked_manually and not RCVDocument.objects.filter(fiscal_match=group).exists():
            group.rcv_linked_manually = False
            group.save(update_fields=["rcv_linked_manually"])
    _drop_empty({group.pk})
    _rederive({group.pk, orphan.pk})
    return FiscalMatch.objects.filter(pk=group.pk).first() or _fresh(orphan.pk)


@transaction.atomic
def release(group: FiscalMatch) -> FiscalMatch:
    """Devuelve un huérfano al cruce automático: borra sus marcas manuales."""
    group = _lock(group)
    _require_orphan(group)
    TerminalSale.objects.filter(fiscal_match=group).update(linked_manually=False, updated_at=timezone.now())
    group.rcv_linked_manually = False
    group.save(update_fields=["rcv_linked_manually"])
    _rederive({group.pk})
    return _fresh(group.pk)


@transaction.atomic
def retry_issue(group: FiscalMatch) -> dict[str, int]:
    """Reintenta, sin esperar, la emisión del borrador del grupo (spec §5.5)."""
    group = _lock(group)
    invoice = _require_invoice_group(group)
    if invoice.status != Invoice.Status.DRAFT or invoice.number:
        raise ValidationError("El documento no está pendiente de emisión.")
    result = issue_fiscal_drafts(group_ids=[group.pk], retry_failed=True)
    _rederive({group.pk})
    return result


# --- candidatos -----------------------------------------------------------------------


def group_candidates(group: FiscalMatch, part: LinkPart) -> list[models.Model]:
    """Candidatos para la unión manual (máx. ``CANDIDATE_CAP``), con consultas fijas."""
    if part == "erp":
        _require_orphan(group)
        return _erp_candidates(group)
    invoice = _require_invoice_group(group)
    if part == "tuu":
        return _tuu_candidates(invoice)
    return _rcv_candidates(group, invoice)


def _erp_candidates(group: FiscalMatch) -> list[Invoice]:
    doc = RCVDocument.objects.filter(fiscal_match=group).order_by("id").first()
    if doc is not None:
        return list(rcv_group_candidates(doc))
    sale = TerminalSale.objects.filter(fiscal_match=group).order_by("transaction_at", "id").first()
    if sale is None:
        return []
    free_payment = TreasuryMovement.objects.filter(
        invoice=OuterRef("pk"), movement_type=TreasuryMovement.Type.INBOUND, amount=sale.sale_amount
    ).filter(~Exists(TerminalSale.objects.filter(matched_movement=OuterRef("pk"))))
    evaluable = Q(status=Invoice.Status.POSTED) | (sale_document_status_q() & Q(sale_order__isnull=False))
    return list(
        Invoice.objects.annotate(fiscal_direction=fiscal_direction_expression(), sii=sii_code_expression())
        .filter(
            evaluable,
            Exists(free_payment),
            fiscal_direction=FiscalMatch.Direction.SALE,
            sii__in=SALE_SII_CODES,
            date=timezone.localdate(sale.transaction_at),
            fiscal_match_set__isnull=False,
        )
        .order_by("id")[:CANDIDATE_CAP]
    )


def _tuu_candidates(invoice: Invoice) -> list[TerminalSale]:
    """Ventas huérfanas del día de algún cobro, con el monto de un cobro libre del documento."""
    inbound = _inbound(invoice)
    taken = _taken_movements([m.pk for m in inbound])
    free = [m for m in inbound if m.pk not in taken]
    if not free:
        return []
    days = Q()
    for day in {timezone.localdate(m.created_at) for m in inbound}:
        days |= Q(transaction_at__gte=local_midnight(day), transaction_at__lt=local_midnight(day + timedelta(days=1)))
    sales = list(
        TerminalSale.objects.filter(
            days,
            status=TerminalSale.Status.COMPLETED,
            fiscal_match__isnull=False,
            fiscal_match__invoice__isnull=True,
            sale_amount__in={m.amount for m in free},
        ).order_by("transaction_at", "id")[:CANDIDATE_CAP]
    )
    for sale in sales:
        sale.compatible_movements = [m.pk for m in free if Decimal(m.amount) == Decimal(sale.sale_amount)]
    return sales


def _rcv_candidates(group: FiscalMatch, invoice: Invoice) -> list[RCVDocument]:
    """Registros del SII huérfanos (sin venta TUU) de la misma dirección, tipo y RUT."""
    if not group.counterparty_rut:
        return []
    directions = [d for d, fiscal in RCV_TO_FISCAL_DIRECTION.items() if fiscal == group.direction]
    rows = (
        RCVDocument.objects.annotate(rut=rut_body("counterparty_rut"))
        .filter(
            ~Exists(TerminalSale.objects.filter(fiscal_match_id=OuterRef("fiscal_match_id"))),
            direction__in=directions,
            dte_type=invoice.sii_code,
            rut=group.counterparty_rut.replace("-", "").upper(),
            fiscal_match__isnull=False,
            fiscal_match__invoice__isnull=True,
        )
        .order_by("issue_date", "id")
    )
    out: list[RCVDocument] = []
    for doc in rows:
        if normalize_rut(doc.counterparty_rut) == group.counterparty_rut:
            out.append(doc)
            if len(out) == CANDIDATE_CAP:
                break
    return out
