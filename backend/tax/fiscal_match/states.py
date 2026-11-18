"""Estado de cada parte (ERP, TUU, RCV) y del grupo de cuadre (spec §5.2–§5.3).

``build_context`` carga en lote, con un número fijo de consultas, todo lo que la
derivación lee; ``evaluate`` no consulta la BD: muta los grupos en memoria y el
motor los persiste con ``bulk_update(groups, STATE_FIELDS)``.
"""

from collections import defaultdict
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone

from accounting.integrations.rcv_normalizer import normalize_rut
from accounting.models import RCVDocument, RCVImport, RCVSettings
from billing.fiscal_key import counterparty_rut
from billing.models import Invoice
from core.fiscal_match import FiscalMatchStatus, PartState, derive_group_status
from tax.fiscal_match.boletas import BOLETA_SII_CODES
from tax.fiscal_match.candidates import tuu_type_fits
from tax.models import FiscalMatch, TaxPeriod
from treasury.models import POSTerminal, TerminalSale, TerminalSyncRun, TreasuryMovement

# Tipos del RCV sin equivalente local: el grupo queda excluido (spec §5.2).
EXCLUDED_SII_CODES = frozenset({43, 46, 110, 111, 112, 914})
SUMMARY_SII_CODE = 48
SEVERAL_FOLIOS_NOTICE = "Varios folios en el SII"
# Meses de RCV de compras (el de emisión y los dos siguientes) antes de dar por faltante.
PURCHASE_RCV_MONTHS = 3

STATE_FIELDS: tuple[str, ...] = (
    "status",
    "erp_state",
    "tuu_state",
    "rcv_state",
    "erp_amount",
    "tuu_amount",
    "rcv_amount",
    "fiscal_period",
    "notice",
    "closed_period_alert",
    "evaluated_at",
)

_RCV_DIRECTION = {
    FiscalMatch.Direction.SALE: RCVImport.Direction.SALES,
    FiscalMatch.Direction.PURCHASE: RCVImport.Direction.PURCHASES,
}

SyncSpan = tuple[date, date, datetime]  # start_date, end_date, finished_at


@dataclass(frozen=True)
class EvalContext:
    """Todo lo que la derivación lee, cargado en lote por ``build_context``."""

    now: datetime
    start_date: date | None
    window: timedelta
    invoices: Mapping[int, Invoice]
    sales: Mapping[int, tuple[TerminalSale, ...]]  # group id →
    movements: Mapping[int, tuple[TreasuryMovement, ...]]  # invoice id → cobros INBOUND
    rcv_docs: Mapping[int, tuple[RCVDocument, ...]]  # group id →
    terminal_providers: Mapping[
        int, frozenset[int]
    ]  # POSTerminal id → proveedores TUU de sus métodos
    sync_runs: Mapping[int, tuple[SyncSpan, ...]]  # provider id → sincronizaciones exitosas
    rcv_imports: frozenset[tuple[str, int, int]]  # (RCVImport.Direction, año, mes) exitosas
    closed_periods: frozenset[str]  # AAAAMM de períodos tributarios cerrados
    tuu_ambiguous: frozenset[int]
    rcv_ambiguous: frozenset[int]


def _group_by(rows: Iterable, key: str) -> dict[int, tuple]:
    out: dict[int, list] = defaultdict(list)
    for row in rows:
        out[getattr(row, key)].append(row)
    return {k: tuple(v) for k, v in out.items()}


def _month(day: date) -> tuple[int, int]:
    return day.year, day.month


def _add_months(year: int, month: int, n: int) -> tuple[int, int]:
    index = year * 12 + (month - 1) + n
    return index // 12, index % 12 + 1


def _period_month(period: str) -> tuple[int, int] | None:
    if len(period) != 6 or not period.isdigit():
        return None
    return int(period[:4]), int(period[4:])


def _fiscal_period(group: FiscalMatch, docs: tuple[RCVDocument, ...]) -> str:
    if docs:
        return docs[0].period
    if group.issue_date is not None:
        return f"{group.issue_date:%Y%m}"
    return group.fiscal_period


def _rcv_months(group: FiscalMatch, fiscal_period: str) -> list[tuple[int, int]]:
    """Meses cuya importación RCV exitosa hace que la ausencia del registro sea una falta."""
    if group.direction == FiscalMatch.Direction.PURCHASE:
        if group.issue_date is None:
            return []
        first = _month(group.issue_date)
        return [_add_months(*first, n) for n in range(PURCHASE_RCV_MONTHS)]
    month = _period_month(fiscal_period)
    return [month] if month else []


def build_context(
    groups: list[FiscalMatch],
    *,
    tuu_ambiguous: Iterable[int] = frozenset(),
    rcv_ambiguous: Iterable[int] = frozenset(),
) -> EvalContext:
    """Carga en lote lo que ``evaluate`` necesita; consultas fijas, no crecen con los grupos."""
    settings = RCVSettings.get_settings()
    group_ids = [g.id for g in groups]
    invoice_ids = [g.invoice_id for g in groups if g.invoice_id is not None]

    invoices = {i.id: i for i in Invoice.objects.filter(id__in=invoice_ids).select_related("contact")}
    sales = _group_by(
        TerminalSale.objects.filter(fiscal_match_id__in=group_ids).order_by("id"), "fiscal_match_id"
    )
    movement_rows = list(
        TreasuryMovement.objects.filter(
            invoice_id__in=invoice_ids, movement_type=TreasuryMovement.Type.INBOUND
        )
        .select_related("payment_method_new__linked_terminal_device", "pos_session")
        .order_by("id")
    )
    movements = _group_by(movement_rows, "invoice_id")
    rcv_docs = _group_by(
        RCVDocument.objects.filter(fiscal_match_id__in=group_ids).order_by("id"), "fiscal_match_id"
    )

    terminal_ids = {
        m.pos_session.terminal_id for m in movement_rows if m.pos_session_id is not None
    }
    providers_of: dict[int, set[int]] = defaultdict(set)
    for terminal_id, provider_id in POSTerminal.allowed_payment_methods.through.objects.filter(
        posterminal_id__in=terminal_ids, paymentmethod__linked_terminal_device__isnull=False
    ).values_list("posterminal_id", "paymentmethod__linked_terminal_device__provider_id"):
        providers_of[terminal_id].add(provider_id)
    terminal_providers = {t: frozenset(p) for t, p in providers_of.items()}

    backed = {s.matched_movement_id for rows in sales.values() for s in _live(rows)}
    unbacked = [m for m in movement_rows if m.id not in backed]
    sync_runs = _sync_runs(unbacked, invoices, terminal_providers)

    periods = {g.id: _fiscal_period(g, rcv_docs.get(g.id, ())) for g in groups}
    import_months = {m for g in groups for m in _rcv_months(g, periods[g.id])}
    closed_months = {m for p in periods.values() if (m := _period_month(p))}
    return EvalContext(
        now=timezone.now(),
        start_date=settings.fiscal_match_start_date,
        window=timedelta(minutes=settings.terminal_match_window_minutes),
        invoices=invoices,
        sales=sales,
        movements=movements,
        rcv_docs=rcv_docs,
        terminal_providers=terminal_providers,
        sync_runs=sync_runs,
        rcv_imports=_rcv_imports(import_months),
        closed_periods=_closed_periods(closed_months),
        tuu_ambiguous=frozenset(tuu_ambiguous),
        rcv_ambiguous=frozenset(rcv_ambiguous),
    )


def _day_spans(days: set[date]) -> list[tuple[date, date]]:
    """Días agrupados en tramos de días consecutivos."""
    spans: list[tuple[date, date]] = []
    for day in sorted(days):
        if spans and day - spans[-1][1] <= timedelta(days=1):
            spans[-1] = (spans[-1][0], day)
        else:
            spans.append((day, day))
    return spans


def _sync_runs(
    movements: list[TreasuryMovement],
    invoices: Mapping[int, Invoice],
    terminal_providers: Mapping[int, frozenset[int]],
) -> dict[int, tuple[SyncSpan, ...]]:
    """Sincronizaciones TUU exitosas que cubren algún día de un cobro que aún espera su venta.

    Solo se leen las ejecuciones cuyo rango toca esos días: las filas no crecen con la
    frecuencia de sincronización a lo largo del historial.
    """
    providers: set[int] = set()
    days: set[date] = set()
    for m in movements:
        invoice = invoices.get(m.invoice_id)
        if invoice is None:
            continue
        found = _payment_providers(
            m, terminal_providers, cash_expected=invoice.sii_code in BOLETA_SII_CODES
        )
        if found:
            providers |= found
            days.add(timezone.localdate(m.created_at))
    if not providers:
        return {}
    overlaps = Q()
    for first, last in _day_spans(days):
        overlaps |= Q(start_date__lte=last, end_date__gte=first)
    rows = TerminalSyncRun.objects.filter(
        overlaps,
        status=TerminalSyncRun.Status.SUCCESS,
        provider_id__in=providers,
        finished_at__isnull=False,
    ).values_list("provider_id", "start_date", "end_date", "finished_at")
    out: dict[int, list[SyncSpan]] = defaultdict(list)
    for provider_id, start, end, finished in rows:
        out[provider_id].append((start, end, finished))
    return {p: tuple(v) for p, v in out.items()}


def _rcv_imports(months: set[tuple[int, int]]) -> frozenset[tuple[str, int, int]]:
    if not months:
        return frozenset()
    years = [y for y, _ in months]
    rows = (
        RCVImport.objects.filter(
            status=RCVImport.Status.SUCCESS, year__gte=min(years), year__lte=max(years)
        )
        .values_list("direction", "year", "month")
        .distinct()
    )
    return frozenset(r for r in rows if (r[1], r[2]) in months)


def _closed_periods(months: set[tuple[int, int]]) -> frozenset[str]:
    """Mismo criterio que ``TaxPeriodService.is_period_closed``, en una consulta por lote."""
    if not months:
        return frozenset()
    years = [y for y, _ in months]
    rows = TaxPeriod.objects.filter(
        status=TaxPeriod.Status.CLOSED, year__gte=min(years), year__lte=max(years)
    ).values_list("year", "month")
    return frozenset(f"{y}{m:02d}" for y, m in rows if (y, m) in months)


# --- derivación (sin consultas) -------------------------------------------------------


def _live(sales: Iterable[TerminalSale]) -> tuple[TerminalSale, ...]:
    """Ventas que cuentan: una venta anulada (o en otro estado) no respalda ningún cobro."""
    return tuple(s for s in sales if s.status == TerminalSale.Status.COMPLETED)


def _payment_providers(
    m: TreasuryMovement, terminal_providers: Mapping[int, frozenset[int]], *, cash_expected: bool
) -> frozenset[int]:
    """Proveedores TUU que deben registrar el cobro; vacío si el cobro no espera venta TUU.

    Tarjeta: el proveedor del dispositivo del medio de pago. Efectivo (solo boletas
    39/41, ``cash_expected``; una factura pagada en efectivo no deja registro TUU): los
    proveedores de los dispositivos del terminal de su sesión POS.
    """
    method = m.payment_method_new if m.payment_method_new_id is not None else None
    device = method.linked_terminal_device if method is not None else None
    if device is not None:
        return frozenset({device.provider_id})
    if (
        cash_expected
        and m.payment_method == Invoice.PaymentMethod.CASH
        and m.pos_session_id is not None
    ):
        return terminal_providers.get(m.pos_session.terminal_id, frozenset())
    return frozenset()


def _sync_covers(m: TreasuryMovement, providers: frozenset[int], ctx: EvalContext) -> bool:
    """Cada proveedor ya sincronizó el día del cobro y terminó después de cobro + ventana."""
    day = timezone.localdate(m.created_at)
    deadline = m.created_at + ctx.window
    return all(
        any(
            start <= day <= end and finished > deadline
            for start, end, finished in ctx.sync_runs.get(p, ())
        )
        for p in providers
    )


def _erp_state(
    invoice: Invoice | None,
    sales: tuple[TerminalSale, ...],
    docs: tuple[RCVDocument, ...],
    ctx: EvalContext,
) -> str:
    if invoice is not None:
        if invoice.status == Invoice.Status.POSTED:
            return PartState.MATCHED
        if invoice.status == Invoice.Status.CANCELLED:
            return PartState.NOT_APPLICABLE
        return PartState.PENDING
    if docs:
        return PartState.MISSING
    if sales and ctx.now > max(s.transaction_at for s in sales) + ctx.window:
        return PartState.MISSING
    return PartState.PENDING


def _tuu_state(
    group: FiscalMatch,
    invoice: Invoice | None,
    code: int | None,
    sales: tuple[TerminalSale, ...],
    ctx: EvalContext,
) -> str:
    if group.id in ctx.tuu_ambiguous:
        return PartState.AMBIGUOUS
    if invoice is None:
        return PartState.MATCHED if sales else PartState.NOT_APPLICABLE
    if group.direction == FiscalMatch.Direction.PURCHASE:
        return PartState.NOT_APPLICABLE
    expected = [
        (m, providers)
        for m in ctx.movements.get(invoice.id, ())
        if (
            providers := _payment_providers(
                m, ctx.terminal_providers, cash_expected=code in BOLETA_SII_CODES
            )
        )
    ]
    # Una venta de otro tipo es diferencia aunque ningún pago espere TUU (p. ej. una
    # boleta TUU en efectivo dentro de una factura pagada en efectivo).
    if not all(tuu_type_fits(s, code) for s in sales):
        return PartState.DIFF
    if not expected:
        return PartState.NOT_APPLICABLE
    backed = {s.matched_movement_id for s in sales}
    unbacked = [(m, p) for m, p in expected if m.id not in backed]
    if not unbacked:
        return PartState.MATCHED
    if all(_sync_covers(m, p, ctx) for m, p in unbacked):
        return PartState.MISSING
    return PartState.PENDING


def _same_rut(invoice: Invoice, docs: tuple[RCVDocument, ...]) -> bool:
    """Facturas y notas: el RUT del RCV debe ser el del documento (si ambos lo informan)."""
    expected = counterparty_rut(invoice)
    if not expected:
        return True
    return all(not (rut := normalize_rut(d.counterparty_rut)) or rut == expected for d in docs)


def _rcv_state(
    group: FiscalMatch,
    invoice: Invoice | None,
    code: int | None,
    docs: tuple[RCVDocument, ...],
    ctx: EvalContext,
) -> str:
    if group.id in ctx.rcv_ambiguous:
        return PartState.AMBIGUOUS
    if code == SUMMARY_SII_CODE:
        return PartState.SUMMARY_ONLY
    if group.direction == FiscalMatch.Direction.PURCHASE and code in BOLETA_SII_CODES:
        return PartState.NOT_APPLICABLE
    if docs:
        if invoice is None:
            return PartState.MATCHED
        if code in BOLETA_SII_CODES:
            ok = group.rcv_amount in (group.erp_amount, group.tuu_amount)
        else:
            ok = group.rcv_amount == invoice.total and _same_rut(invoice, docs)
        return PartState.MATCHED if ok else PartState.DIFF
    direction = _RCV_DIRECTION[group.direction]
    months = _rcv_months(group, group.fiscal_period)
    if months and all((direction, y, m) in ctx.rcv_imports for y, m in months):
        return PartState.MISSING
    return PartState.PENDING


def _excluded(
    group: FiscalMatch,
    invoice: Invoice | None,
    code: int | None,
    docs: tuple[RCVDocument, ...],
    sales: tuple[TerminalSale, ...],
    ctx: EvalContext,
) -> bool:
    if code in EXCLUDED_SII_CODES:
        return True
    if invoice is not None and invoice.status == Invoice.Status.CANCELLED:
        return True
    if invoice is None and docs and all(d.missing_since_import_id is not None for d in docs):
        return True
    if invoice is None and not docs and sales and not _live(sales):
        return True  # huérfano con solo ventas anuladas: nada que cuadrar
    return (
        ctx.start_date is not None
        and group.issue_date is not None
        and group.issue_date < ctx.start_date
    )


def _sum(values: Iterable[Decimal]) -> Decimal | None:
    values = list(values)
    return sum(values, Decimal(0)) if values else None


def _evaluate_one(group: FiscalMatch, ctx: EvalContext) -> None:
    invoice = ctx.invoices.get(group.invoice_id) if group.invoice_id is not None else None
    all_sales = ctx.sales.get(group.id, ())
    sales = _live(all_sales)
    docs = ctx.rcv_docs.get(group.id, ())
    code = invoice.sii_code if invoice is not None else group.dte_type

    group.erp_amount = invoice.total if invoice is not None else None
    group.tuu_amount = _sum(s.sale_amount for s in sales)
    group.rcv_amount = _sum(abs(d.total_amount) for d in docs)
    group.fiscal_period = _fiscal_period(group, docs)

    group.erp_state = _erp_state(invoice, sales, docs, ctx)
    group.tuu_state = _tuu_state(group, invoice, code, sales, ctx)
    group.rcv_state = _rcv_state(group, invoice, code, docs, ctx)

    previous = group.status
    group.status = derive_group_status(
        group.erp_state,
        group.tuu_state,
        group.rcv_state,
        has_invoice=invoice is not None,
        excluded=_excluded(group, invoice, code, docs, all_sales, ctx),
    )
    if group.status == FiscalMatchStatus.MATCHED:
        group.closed_period_alert = False
    elif previous == FiscalMatchStatus.MATCHED and group.fiscal_period in ctx.closed_periods:
        group.closed_period_alert = True

    if code in BOLETA_SII_CODES and len(docs) > 1:
        group.notice = SEVERAL_FOLIOS_NOTICE
    elif group.notice == SEVERAL_FOLIOS_NOTICE:
        group.notice = ""
    group.evaluated_at = ctx.now


def evaluate(groups: list[FiscalMatch], ctx: EvalContext) -> None:
    """Deriva en memoria los estados, montos y período de cada grupo; no consulta la BD."""
    for group in groups:
        _evaluate_one(group, ctx)
