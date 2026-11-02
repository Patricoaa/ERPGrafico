"""
Libro de caja POS (ADR-0109).

El efectivo esperado de una sesión con libro de caja se deriva de los
movimientos de la cuenta de tesorería de la caja, no de los contadores de la
sesión. Cuenta todo lo que tocó la caja dentro de la ventana de la sesión:

- movimientos creados en la ventana (con o sin ``pos_session``), y
- anulaciones hechas en la ventana (``cancelled_at``), que restan el efecto del
  movimiento original aunque este se haya creado antes de abrir.

Ventana: ``[ledger_baseline_at, audit.created_at)``; mientras la sesión está
abierta no tiene fin. El ajuste de apertura queda antes del inicio y los
movimientos del cierre (diferencia de arqueo, retiro) quedan después del arqueo.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db.models import DecimalField, OuterRef, Q, QuerySet, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from .models import POSSession, POSSessionAudit, TreasuryMovement

ZERO = Decimal("0")

# Clases de evento del libro de caja
SALE = "SALE"
REFUND = "REFUND"
MANUAL_IN = "MANUAL_IN"
MANUAL_OUT = "MANUAL_OUT"
EXTERNAL_IN = "EXTERNAL_IN"
EXTERNAL_OUT = "EXTERNAL_OUT"
ANNULMENT = "ANNULMENT"


@dataclass(frozen=True)
class CashLedgerEntry:
    movement: TreasuryMovement
    kind: str
    signed_amount: Decimal
    at: object  # datetime del evento (creación o anulación)


def _sum_subquery(account_field: str, timestamp_field: str) -> Coalesce:
    movements = (
        TreasuryMovement.objects.filter(
            **{
                account_field: OuterRef("treasury_account"),
                f"{timestamp_field}__gte": OuterRef("ledger_baseline_at"),
            },
            is_pending_registration=False,
        )
        .order_by()
        .values(account_field)
        .annotate(total=Sum("amount"))
        .values("total")
    )
    output = DecimalField(max_digits=14, decimal_places=2)
    return Coalesce(Subquery(movements, output_field=output), Value(ZERO), output_field=output)


def annotate_ledger_cash_net(qs: QuerySet[POSSession]) -> QuerySet[POSSession]:
    """
    Anota ``ledger_cash_net`` (neto de la caja desde la apertura) para sesiones
    abiertas. Las cerradas usan el valor congelado del arqueo; las legacy no lo
    leen. ``POSSession.expected_cash`` consume la anotación si está presente.
    """
    return qs.annotate(
        ledger_cash_net=(
            _sum_subquery("to_account", "created_at")
            - _sum_subquery("from_account", "created_at")
            - _sum_subquery("to_account", "cancelled_at")
            + _sum_subquery("from_account", "cancelled_at")
        )
    )


def ledger_net(session: POSSession) -> Decimal:
    """Neto de la caja desde la apertura para una sesión abierta (una consulta)."""
    if not session.uses_cash_ledger or not session.treasury_account_id:
        return ZERO
    value = (
        annotate_ledger_cash_net(POSSession.objects.filter(pk=session.pk))
        .values_list("ledger_cash_net", flat=True)
        .first()
    )
    return value or ZERO


def _window_end(session: POSSession):
    try:
        return session.audit.created_at
    except POSSessionAudit.DoesNotExist:
        return None


def _in_window(ts, start, end) -> bool:
    return ts is not None and ts >= start and (end is None or ts < end)


def _classify(movement: TreasuryMovement, session: POSSession, signed: Decimal) -> str:
    inflow = signed > 0
    if movement.pos_session_id != session.id:
        return EXTERNAL_IN if inflow else EXTERNAL_OUT
    document = movement.invoice or movement.sale_order or movement.purchase_order
    if document is not None and document.is_sale_document():
        return SALE if inflow else REFUND
    return MANUAL_IN if inflow else MANUAL_OUT


def ledger_entries(session: POSSession) -> list[CashLedgerEntry]:
    """Eventos de la caja dentro de la ventana de la sesión, en orden cronológico."""
    account_id = session.treasury_account_id
    if not session.uses_cash_ledger or not account_id:
        return []

    start = session.ledger_baseline_at
    end = _window_end(session)

    created_q = Q(created_at__gte=start)
    cancelled_q = Q(cancelled_at__gte=start)
    if end is not None:
        created_q &= Q(created_at__lt=end)
        cancelled_q &= Q(cancelled_at__lt=end)

    movements = (
        TreasuryMovement.objects.filter(Q(from_account_id=account_id) | Q(to_account_id=account_id))
        .filter(is_pending_registration=False)
        .filter(created_q | cancelled_q)
        .select_related("invoice", "sale_order", "purchase_order", "created_by", "contact")
    )

    entries: list[CashLedgerEntry] = []
    for mv in movements:
        signed = mv.amount if mv.to_account_id == account_id else -mv.amount
        if _in_window(mv.created_at, start, end):
            entries.append(CashLedgerEntry(mv, _classify(mv, session, signed), signed, mv.created_at))
        if _in_window(mv.cancelled_at, start, end):
            entries.append(CashLedgerEntry(mv, ANNULMENT, -signed, mv.cancelled_at))

    entries.sort(key=lambda e: (e.at, e.movement.id))
    return entries


def ledger_breakdown(entries: list[CashLedgerEntry]) -> dict[str, Decimal]:
    """Totales por clase (montos positivos, salvo ``annulments`` que es neto con signo)."""
    totals = {kind: ZERO for kind in (SALE, REFUND, MANUAL_IN, MANUAL_OUT, EXTERNAL_IN, EXTERNAL_OUT, ANNULMENT)}
    for entry in entries:
        amount = entry.signed_amount if entry.kind == ANNULMENT else abs(entry.signed_amount)
        totals[entry.kind] += amount
    return {
        "cash_sales": totals[SALE],
        "cash_refunds": totals[REFUND],
        "manual_inflow": totals[MANUAL_IN],
        "manual_outflow": totals[MANUAL_OUT],
        "external_inflow": totals[EXTERNAL_IN],
        "external_outflow": totals[EXTERNAL_OUT],
        "annulments": totals[ANNULMENT],
        "net": sum((e.signed_amount for e in entries), ZERO),
    }


def _document_label(movement: TreasuryMovement) -> str:
    document = movement.invoice or movement.sale_order or movement.purchase_order
    if document is None:
        return ""
    return getattr(document, "display_id", "") or str(document)


def serialize_out_of_session_entries(entries: list[CashLedgerEntry]) -> list[dict]:
    """Movimientos externos y anulaciones, para la sección del informe X/Z."""
    rows = []
    for entry in entries:
        if entry.kind not in (EXTERNAL_IN, EXTERNAL_OUT, ANNULMENT):
            continue
        mv = entry.movement
        user = mv.created_by
        rows.append(
            {
                "id": mv.id,
                "display_id": mv.display_id,
                "event": "ANNULMENT" if entry.kind == ANNULMENT else "EXTERNAL",
                "direction": "IN" if entry.signed_amount > 0 else "OUT",
                "amount": abs(entry.signed_amount),
                "signed_amount": entry.signed_amount,
                "at": entry.at,
                "movement_type": mv.movement_type,
                "document": _document_label(mv),
                "contact_name": mv.contact.name if mv.contact else "",
                "notes": mv.notes,
                "reason": mv.pos_external_reason,
                "pos_session_id": mv.pos_session_id,
                "created_by_name": (user.get_full_name() or user.username) if user else "",
            }
        )
    return rows
