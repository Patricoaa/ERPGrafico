"""Qué documentos entran al cuadre y utilidades de rango compartidas (ADR-0138)."""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.db.models import Exists, OuterRef, Q, QuerySet
from django.utils import timezone

from billing.models import Invoice
from billing.sale_documents import FOLIO_EXEMPT_DTE_TYPES
from tax.models import FiscalMatch
from treasury.models import POSTerminal, TerminalSale, TreasuryMovement

# Boletas 39/41: las únicas cuyo pago en efectivo en una caja con TUU espera una venta TUU,
# y las que acumulan varios registros del SII por grupo.
BOLETA_SII_CODES = frozenset({39, 41})

SALE_DTE_TYPES = (
    Invoice.DTEType.BOLETA,
    Invoice.DTEType.BOLETA_EXENTA,
    Invoice.DTEType.COMPROBANTE_PAGO,
    Invoice.DTEType.FACTURA,
    Invoice.DTEType.FACTURA_EXENTA,
)


def sale_document_status_q(prefix: str = "") -> Q:
    """Estado de un documento de venta que el cuadre considera (ADR-0140 D2).

    Los emitidos, y los borradores 39/41/48 sin número: el proveedor del terminal
    emite su folio y el ERP lo recibe después. ``prefix`` es la ruta hasta la
    factura (p. ej. ``"invoice__"``).
    """
    return Q(**{f"{prefix}status": Invoice.Status.POSTED}) | Q(
        **{
            f"{prefix}status": Invoice.Status.DRAFT,
            f"{prefix}dte_type__in": FOLIO_EXEMPT_DTE_TYPES,
            f"{prefix}number": "",
        }
    )


def local_midnight(day: date) -> datetime:
    return timezone.make_aware(datetime.combine(day, time.min))


@dataclass
class LinkResult:
    """Resultado de un paso de vínculo.

    ``linked`` cuenta las partes que esta corrida unió o volvió a unir a otro grupo o
    cobro (un re-cuadre que no cambia nada no suma); ``ambiguous_group_ids`` son los
    grupos con más de un candidato o con un candidato que otro registro reclama;
    ``touched_group_ids`` son los grupos que ganaron o perdieron una parte (el motor
    los reevalúa). No entra en la igualdad: dos resultados con los mismos conteos son
    iguales aunque hayan movido grupos distintos.
    """

    linked: int
    ambiguous_group_ids: set[int] = field(default_factory=set)
    touched_group_ids: set[int] = field(default_factory=set, compare=False)


def stamp_groups(group_ids: set[int]) -> None:
    """Marca ``updated_at`` de los grupos que un paso tocó, dentro de su transacción.

    ``bulk_update``/``update`` no tocan ``auto_now``: sin la marca, si la corrida cae
    antes de evaluar, un grupo cuadrado que perdió una parte quedaría fuera del alcance
    de la corrida siguiente.
    """
    if group_ids:
        FiscalMatch.objects.filter(id__in=group_ids).update(updated_at=timezone.now())


def border_competitors(lo: datetime, hi: datetime, window: timedelta) -> list[TerminalSale]:
    near_border = Q(transaction_at__gte=lo - window, transaction_at__lt=lo) | Q(
        transaction_at__gte=hi, transaction_at__lt=hi + window
    )
    return list(
        TerminalSale.objects.filter(
            near_border, status=TerminalSale.Status.COMPLETED, linked_manually=False
        )
    )


def candidate_movements(lo: datetime, hi: datetime) -> list[TreasuryMovement]:
    return candidate_movements_where(Q(created_at__gte=lo, created_at__lte=hi))


def candidate_movements_where(when: Q) -> list[TreasuryMovement]:
    """Cobros de venta POS que pueden respaldar una venta TUU, filtrados por ``when``."""
    return list(
        TreasuryMovement.objects.filter(
            when,
            sale_document_status_q("invoice__"),
            movement_type=TreasuryMovement.Type.INBOUND,
            invoice__sale_order__isnull=False,
            invoice__dte_type__in=SALE_DTE_TYPES,
        ).select_related("invoice", "payment_method_new", "pos_session")
    )


def terminals_by_device(device_ids: set[int]) -> dict[int, set[int]]:
    """device_id → ids de POSTerminal que permiten algún método ligado a ese dispositivo."""
    if not device_ids:
        return {}
    rows = POSTerminal.allowed_payment_methods.through.objects.filter(
        paymentmethod__linked_terminal_device_id__in=device_ids
    ).values_list("paymentmethod__linked_terminal_device_id", "posterminal_id")
    out: dict[int, set[int]] = defaultdict(set)
    for device_id, terminal_id in rows:
        out[device_id].add(terminal_id)
    return out


def cash_sale_fits(sale: TerminalSale, sii_code: int | None) -> bool:
    """Solo una boleta 39/41 pagada en efectivo espera venta TUU (una factura en efectivo
    no deja registro TUU): la venta en efectivo no respalda otro documento."""
    return sale.payment_type != TerminalSale.PaymentType.CASH or sii_code in BOLETA_SII_CODES


def sii_type_fits(a: int | None, b: int | None) -> bool:
    """Dos registros con tipo SII son compatibles si es el mismo; sin tipo, no se descarta."""
    return a is None or b is None or a == b


def tuu_type_fits(sale: TerminalSale, sii_code: int | None) -> bool:
    """El tipo que informa TUU (si lo informa) es el del documento: un 33 de TUU es una factura 33."""
    return sale.document_type is None or sale.document_type == sii_code


def payment_type_fits(sale: TerminalSale, movement: TreasuryMovement) -> bool:
    """Una venta TUU en efectivo solo respalda un cobro en efectivo (unión manual y búsqueda)."""
    return sale.payment_type != TerminalSale.PaymentType.CASH or movement.payment_method == "CASH"


def payment_compatible(
    sale: TerminalSale, m: TreasuryMovement, terminals: dict[int, set[int]]
) -> bool:
    if sale.payment_type == TerminalSale.PaymentType.CASH:
        if m.payment_method != "CASH" or not cash_sale_fits(sale, m.invoice.sii_code):
            return False
        if sale.device_id is None:
            return True
        return m.pos_session is not None and m.pos_session.terminal_id in terminals.get(
            sale.device_id, ()
        )
    if sale.device_id is None:
        return True
    return (
        m.payment_method_new is not None
        and m.payment_method_new.linked_terminal_device_id == sale.device_id
    )


# --- compatibilidad de cobros y documentos (la usan las uniones y la búsqueda) -----------


def evaluable_invoice_q() -> Q:
    """Documentos de venta que el cuadre puede evaluar: emitidos, o borradores POS sin folio."""
    return Q(status=Invoice.Status.POSTED) | (
        sale_document_status_q() & Q(sale_order__isnull=False)
    )


def inbound_movements(invoice: Invoice) -> list[TreasuryMovement]:
    """Cobros del documento, con su medio de pago, en orden de id."""
    return list(
        TreasuryMovement.objects.filter(
            invoice=invoice, movement_type=TreasuryMovement.Type.INBOUND
        )
        .select_related("payment_method_new")
        .order_by("id")
    )


def taken_movements(movement_ids: list[int], *, excluding: list[int] = ()) -> set[int]:
    """De los cobros dados, los que ya respalda alguna venta TUU (salvo las de ``excluding``)."""
    return set(
        TerminalSale.objects.filter(matched_movement_id__in=movement_ids)
        .exclude(id__in=excluding)
        .values_list("matched_movement_id", flat=True)
    )


def free_inbound_movements(invoice: Invoice) -> list[TreasuryMovement]:
    """Cobros del documento que ninguna venta TUU respalda."""
    inbound = inbound_movements(invoice)
    taken = taken_movements([m.pk for m in inbound])
    return [m for m in inbound if m.pk not in taken]


def free_payments(*amounts: Decimal) -> "QuerySet[TreasuryMovement]":
    """Cobros que ninguna venta TUU respalda; con ``amounts``, solo los de esos montos."""
    qs = TreasuryMovement.objects.filter(movement_type=TreasuryMovement.Type.INBOUND).filter(
        ~Exists(TerminalSale.objects.filter(matched_movement=OuterRef("pk")))
    )
    return qs.filter(amount__in=set(amounts)) if amounts else qs


@dataclass(frozen=True)
class PaymentOption:
    """Cobro libre del documento que una venta TUU puede respaldar; ``same_amount``: es de su monto."""

    movement: TreasuryMovement
    same_amount: bool


def payment_options(sale: TerminalSale, free: list[TreasuryMovement]) -> list[PaymentOption]:
    """Los cobros libres de un medio compatible con la venta, los de su mismo monto primero
    (Ruling K): otro monto se puede elegir y deja la parte TUU con advertencia (spec §7c)."""
    options = [
        PaymentOption(m, Decimal(m.amount) == Decimal(sale.sale_amount))
        for m in free
        if payment_type_fits(sale, m)
    ]
    return sorted(options, key=lambda o: not o.same_amount)


def payments_assignable(options: dict[int, list[int]]) -> bool:
    """Cada venta (clave) puede quedarse con un cobro distinto de sus opciones (emparejamiento)."""
    owner: dict[int, int] = {}

    def place(sale: int, seen: set[int]) -> bool:
        for m in options[sale]:
            if m in seen:
                continue
            seen.add(m)
            if m not in owner or place(owner[m], seen):
                owner[m] = sale
                return True
        return False

    return all(place(sale, set()) for sale in options)
