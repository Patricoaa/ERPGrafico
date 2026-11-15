"""Cuadre de ventas TUU contra documentos POS emitidos (ADR-0138 D4).

Solo escribe `matched_invoice` / `match_status` en `TerminalSale`; nunca toca el
documento emitido (ADR-0091). Las filas con vínculo manual no se recalculan.
"""

from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from accounting.models import RCVSettings
from billing.models import Invoice
from core.fiscal_match import MatchStatus
from treasury.models import POSTerminal, TerminalSale, TreasuryMovement

SALE_DTE_TYPES = (
    Invoice.DTEType.BOLETA,
    Invoice.DTEType.BOLETA_EXENTA,
    Invoice.DTEType.COMPROBANTE_PAGO,
    Invoice.DTEType.FACTURA,
)


@transaction.atomic
def reconcile_terminal_sales(start: date, end: date) -> dict[str, int]:
    """Enlaza cada venta TUU del rango con su documento POS; devuelve conteos por estado."""
    settings = RCVSettings.get_settings()
    if settings.fiscal_match_start_date is None:
        return {}
    window = timedelta(minutes=settings.terminal_match_window_minutes)
    lo = _local_midnight(max(start, settings.fiscal_match_start_date))
    hi = _local_midnight(end + timedelta(days=1))
    if lo >= hi:
        return {}

    selection = TerminalSale.objects.filter(
        transaction_at__gte=lo, transaction_at__lt=hi, matched_manually=False
    )
    sales = list(selection)
    if not sales:
        return {}
    # Limpiar antes de leer los vínculos vigentes: lo que quede enlazado pertenece
    # a filas fuera de esta selección (manuales u otro rango) y no se reasigna.
    selection.update(matched_invoice=None, match_status="")
    taken = set(
        TerminalSale.objects.filter(matched_invoice__isnull=False).values_list("matched_invoice_id", flat=True)
    )
    movements = [m for m in _candidate_movements(lo - window, hi + window) if m.invoice_id not in taken]
    # Ventas vecinas fuera del rango (±w) compiten por las mismas facturas: se leen
    # para detectar ambigüedad en el borde, pero no se escriben ni se cuentan.
    competitors = _border_competitors(lo, hi, window)
    terminals = _terminals_by_device({s.device_id for s in sales + competitors if s.device_id})

    completed = [s for s in sales if s.status == TerminalSale.Status.COMPLETED]
    candidates = _candidates(completed, movements, window, terminals)
    rivals = _candidates(competitors, movements, window, terminals)
    _assign(sales, candidates, rivals, {m.invoice_id: m.invoice for m in movements})

    TerminalSale.objects.bulk_update(sales, ["matched_invoice", "match_status"])
    return dict(Counter(s.match_status for s in sales))


def _local_midnight(day: date) -> datetime:
    return timezone.make_aware(datetime.combine(day, time.min))


def _border_competitors(lo: datetime, hi: datetime, window: timedelta) -> list[TerminalSale]:
    near_border = Q(transaction_at__gte=lo - window, transaction_at__lt=lo) | Q(
        transaction_at__gte=hi, transaction_at__lt=hi + window
    )
    return list(
        TerminalSale.objects.filter(
            near_border, status=TerminalSale.Status.COMPLETED, matched_manually=False
        )
    )


def _candidate_movements(lo: datetime, hi: datetime) -> list[TreasuryMovement]:
    return list(
        TreasuryMovement.objects.filter(
            movement_type=TreasuryMovement.Type.INBOUND,
            invoice__status=Invoice.Status.POSTED,
            invoice__sale_order__isnull=False,
            invoice__dte_type__in=SALE_DTE_TYPES,
            created_at__gte=lo,
            created_at__lte=hi,
        ).select_related("invoice", "payment_method_new", "pos_session")
    )


def _terminals_by_device(device_ids: set[int]) -> dict[int, set[int]]:
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


def _candidates(
    sales: list[TerminalSale],
    movements: list[TreasuryMovement],
    window: timedelta,
    terminals: dict[int, set[int]],
) -> dict[int, set[int]]:
    """sale_id → ids de factura con algún movimiento compatible."""
    by_amount: dict[object, list[TreasuryMovement]] = defaultdict(list)
    for m in movements:
        by_amount[m.invoice.total].append(m)
    return {
        s.id: {
            m.invoice_id
            for m in by_amount.get(s.sale_amount, ())
            if abs(m.created_at - s.transaction_at) <= window and _payment_compatible(s, m, terminals)
        }
        for s in sales
    }


def _payment_compatible(sale: TerminalSale, m: TreasuryMovement, terminals: dict[int, set[int]]) -> bool:
    if sale.payment_type == TerminalSale.PaymentType.CASH:
        if m.payment_method != "CASH":
            return False
        if sale.device_id is None:
            return True
        return m.pos_session is not None and m.pos_session.terminal_id in terminals.get(sale.device_id, ())
    if sale.device_id is None:
        return True
    return m.payment_method_new is not None and m.payment_method_new.linked_terminal_device_id == sale.device_id


def _assign(
    sales: list[TerminalSale],
    candidates: dict[int, set[int]],
    rivals: dict[int, set[int]],
    invoices: dict[int, Invoice],
) -> None:
    sales_per_invoice: Counter[int] = Counter(
        inv for cands in (*candidates.values(), *rivals.values()) for inv in cands
    )
    for s in sales:
        if s.id not in candidates:
            s.matched_invoice, s.match_status = None, MatchStatus.EXCLUDED
            continue
        cands = candidates[s.id]
        if not cands:
            s.matched_invoice, s.match_status = None, MatchStatus.ONLY_EXTERNAL
        elif len(cands) > 1 or sales_per_invoice[next(iter(cands))] > 1:
            s.matched_invoice, s.match_status = None, MatchStatus.AMBIGUOUS
        else:
            invoice = invoices[next(iter(cands))]
            type_diff = s.document_type is not None and s.document_type != invoice.sii_code
            s.matched_invoice = invoice
            s.match_status = MatchStatus.TYPE_DIFF if type_diff else MatchStatus.MATCHED
