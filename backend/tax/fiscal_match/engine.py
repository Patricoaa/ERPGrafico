"""Motor único del cuadre: una corrida idempotente encadena todos los pasos (spec §5.4).

Orden: grupos → liberar anulados (documentos y ventas TUU) → ERP ↔ TUU → TUU ↔ RCV boletas → ERP ↔ RCV →
estados → emisión → ERP ↔ RCV y estados de los emitidos. Cada paso es su propia
transacción (salvo la emisión, que confirma documento por documento). Cada corrida
queda en un ``FiscalMatchRun``; su ``started_at`` es la marca para la siguiente.

Alcance (sin meses): grupos no cuadrados ni excluidos, los que la corrida tocó, los
que cambiaron desde la corrida anterior y los cuadrados con ventas automáticas que
una sincronización TUU reciente puede reabrir (ventas rivales que llegan tarde).
"""

import logging
from datetime import date, datetime, timedelta

from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from accounting.models import RCVDocument, RCVSettings
from billing.models import Invoice
from core.fiscal_match import FiscalMatchStatus, PartState
from tax.fiscal_match.boletas import pair_rcv_boletas
from tax.fiscal_match.candidates import local_midnight, stamp_groups
from tax.fiscal_match.groups import ensure_groups, rcv_orphan_group, tuu_orphan_group
from tax.fiscal_match.issuing import issuable_q, issue_fiscal_drafts, tuu_number
from tax.fiscal_match.rcv import link_rcv_documents, pair_orphan_tuu_rcv_facturas
from tax.fiscal_match.states import STATE_FIELDS, EvalContext, build_context, evaluate
from tax.fiscal_match.terminal import link_terminal_sales
from tax.models import FiscalMatch, FiscalMatchRun
from treasury.models import TerminalSale, TerminalSyncRun

logger = logging.getLogger(__name__)

# Días hacia atrás que se releen por fecha (ventas TUU y boletas): las filas leídas no
# crecen con el historial. Lo anterior entra por cambios o por ``rematch_ids``.
SCAN_DAYS = 62
_SETTLED = (FiscalMatchStatus.MATCHED, FiscalMatchStatus.EXCLUDED)


def _local_today() -> date:
    return timezone.localdate()


def run_fiscal_match() -> dict:
    """Corre el cuadre completo; ``{"skipped": True}`` sin fecha de inicio."""
    settings = RCVSettings.get_settings()
    start = settings.fiscal_match_start_date
    if start is None:
        return {"skipped": True}
    # Solo una corrida sin error avanza la marca: una fallida pudo revertir sus pasos.
    previous = FiscalMatchRun.latest_finished()
    since = previous.started_at if previous is not None else None
    run = FiscalMatchRun.objects.create()
    try:
        counts = _run(start, timedelta(minutes=settings.terminal_match_window_minutes), since)
    except Exception as exc:  # también SoftTimeLimitExceeded (subclase de Exception)
        run.error = f"{type(exc).__name__}: {exc}"[:2000] or type(exc).__name__
        run.finished_at = timezone.now()
        try:
            run.save(update_fields=["error", "finished_at"])
        except Exception:  # noqa: BLE001 — registrar el fallo no debe tapar el error original
            logger.exception("No se pudo registrar el fallo de la corrida de cuadre %s", run.pk)
        raise
    run.counts = counts
    run.finished_at = timezone.now()
    run.save(update_fields=["counts", "finished_at"])
    return counts


def _run(start: date, window: timedelta, since: datetime | None) -> dict:
    today = _local_today()
    lo = local_midnight(max(start, today - timedelta(days=SCAN_DAYS)))
    hi = local_midnight(today + timedelta(days=1))

    created = ensure_groups(start)
    released = release_cancelled(start) | release_reversed(start)
    rematch = rematch_ids(start, window, since)
    terminal = link_terminal_sales(lo, hi, rematch_ids=rematch)
    boletas = pair_rcv_boletas(lo, hi)
    rcv = link_rcv_documents(start)
    facturas_tuu = pair_orphan_tuu_rcv_facturas(lo, hi, exclude_group_ids=released)

    tuu_ambiguous = terminal.ambiguous_group_ids | facturas_tuu.ambiguous_group_ids
    rcv_ambiguous = rcv.ambiguous_group_ids | facturas_tuu.ambiguous_group_ids
    touched = (
        released
        | rematch
        | terminal.touched_group_ids
        | boletas.touched_group_ids
        | rcv.touched_group_ids
        | facturas_tuu.touched_group_ids
        | tuu_ambiguous
        | rcv_ambiguous
    )
    evaluated = _evaluate(_scope(start, since) | Q(id__in=touched), tuu_ambiguous, rcv_ambiguous)

    drafts = set(FiscalMatch.objects.filter(issuable_q()).values_list("id", flat=True))
    issued = issue_fiscal_drafts()
    rcv_after = link_rcv_documents(start)
    relinked = rcv_after.touched_group_ids | rcv_after.ambiguous_group_ids
    if issued["issued"] or relinked:
        _evaluate(Q(id__in=drafts | relinked), tuu_ambiguous, rcv_after.ambiguous_group_ids)

    return {
        "created": created,
        "released": len(released),
        "terminal": terminal.linked,
        "boletas": boletas.linked,
        "rcv": rcv.linked + rcv_after.linked,
        "facturas_tuu": facturas_tuu.linked,
        "evaluated": evaluated,
        "issued": issued,
    }


def _scope(start: date, since: datetime | None) -> Q:
    """Grupos desde ``start`` sin cuadrar, o con algo modificado desde la corrida anterior."""
    recent = Q(issue_date__gte=start)
    if since is None:
        return recent  # primera corrida: todo desde la fecha de inicio
    changed = (
        Q(updated_at__gt=since)
        | Q(invoice__updated_at__gt=since)
        | Exists(TerminalSale.objects.filter(fiscal_match=OuterRef("pk"), updated_at__gt=since))
        | Exists(RCVDocument.objects.filter(fiscal_match=OuterRef("pk"), updated_at__gt=since))
    )
    return recent & (~Q(status__in=_SETTLED) | changed)


@transaction.atomic
def _evaluate(where: Q, tuu_ambiguous: set[int], rcv_ambiguous: set[int]) -> int:
    groups = list(FiscalMatch.objects.filter(where).order_by("id"))
    if not groups:
        return 0
    ctx = build_context(groups, tuu_ambiguous=tuu_ambiguous, rcv_ambiguous=rcv_ambiguous)
    evaluate(groups, ctx)
    _flag_frozen_48(groups, ctx)
    FiscalMatch.objects.bulk_update(groups, STATE_FIELDS, batch_size=500)
    return len(groups)


def _flag_frozen_48(groups: list[FiscalMatch], ctx: EvalContext) -> None:
    """Un 48 ya emitido con el id TUU de su venta no suelta el vínculo ante un rival: se avisa."""
    for group in groups:
        if group.id not in ctx.tuu_ambiguous or group.invoice_id is None:
            continue
        invoice = ctx.invoices.get(group.invoice_id)
        if invoice is None or invoice.status != Invoice.Status.POSTED:
            continue
        if invoice.dte_type != Invoice.DTEType.COMPROBANTE_PAGO:
            continue
        if any(invoice.number == tuu_number(s) for s in ctx.sales.get(group.id, ())):
            group.closed_period_alert = True


def rematch_ids(start: date, window: timedelta, since: datetime | None) -> set[int]:
    """Grupos con ventas automáticas que una sincronización TUU reciente puede reabrir.

    Los ``MATCHED`` cuyo cobro cae en el rango (± ventana) de una sincronización terminada
    después de la corrida anterior, y los que ya están con TUU ambiguo: sin ellos la venta
    original no compite con la rival en la corrida siguiente y la ambigüedad se borraría.
    """
    automatic = TerminalSale.objects.filter(
        linked_manually=False,
        matched_movement__isnull=False,
        fiscal_match__issue_date__gte=start,
    )
    ambiguous = automatic.filter(
        fiscal_match__tuu_state=PartState.AMBIGUOUS, fiscal_match__invoice__isnull=False
    )
    ids = set(ambiguous.values_list("fiscal_match_id", flat=True))
    if since is None:
        return ids
    runs = TerminalSyncRun.objects.filter(
        status__in=(TerminalSyncRun.Status.SUCCESS, TerminalSyncRun.Status.PARTIAL),
        finished_at__gt=since,
    ).values_list("start_date", "end_date")
    spans = Q()
    for first, last in _merged_days(runs):
        spans |= Q(
            matched_movement__created_at__gte=local_midnight(first) - window,
            matched_movement__created_at__lt=local_midnight(last + timedelta(days=1)) + window,
        )
    if not spans:
        return ids
    matched = automatic.filter(spans, fiscal_match__status=FiscalMatchStatus.MATCHED)
    return ids | set(matched.values_list("fiscal_match_id", flat=True))


def _merged_days(ranges) -> list[tuple[date, date]]:
    """Rangos de días [desde, hasta] unidos cuando se traslapan o son contiguos."""
    merged: list[tuple[date, date]] = []
    for first, last in sorted(ranges):
        if merged and first <= merged[-1][1] + timedelta(days=1):
            merged[-1] = (merged[-1][0], max(merged[-1][1], last))
        else:
            merged.append((first, last))
    return merged


@transaction.atomic
def release_cancelled(start: date) -> set[int]:
    """Las ventas TUU y registros RCV de un documento anulado vuelven a grupos huérfanos.

    El vínculo manual deja de protegerlos: cada registro queda en su propio grupo
    automático y el grupo del documento anulado se evalúa como ``EXCLUDED``.
    Devuelve los grupos tocados (los del documento y los huérfanos nuevos).
    """
    cancelled = Q(
        fiscal_match__invoice__status=Invoice.Status.CANCELLED, fiscal_match__issue_date__gte=start
    )
    sales = list(TerminalSale.objects.filter(cancelled))
    docs = list(RCVDocument.objects.filter(cancelled))
    sources = {r.fiscal_match_id for r in (*sales, *docs)}
    manual_rcv = set(
        FiscalMatch.objects.filter(
            invoice__status=Invoice.Status.CANCELLED,
            issue_date__gte=start,
            rcv_linked_manually=True,
        ).values_list("id", flat=True)
    )
    if not sources and not manual_rcv:
        return set()
    sale_groups = [tuu_orphan_group(s) for s in sales]
    rcv_groups = [rcv_orphan_group(d) for d in docs]
    FiscalMatch.objects.bulk_create(sale_groups + rcv_groups)
    for sale, group in zip(sales, sale_groups, strict=True):
        sale.fiscal_match, sale.matched_movement, sale.linked_manually = group, None, False
    for doc, group in zip(docs, rcv_groups, strict=True):
        doc.fiscal_match = group
    TerminalSale.objects.bulk_update(sales, ["fiscal_match", "matched_movement", "linked_manually"])
    RCVDocument.objects.bulk_update(docs, ["fiscal_match"])
    FiscalMatch.objects.filter(id__in=sources | manual_rcv).update(rcv_linked_manually=False)
    touched = sources | manual_rcv | {g.id for g in sale_groups + rcv_groups}
    stamp_groups(touched)
    return touched


@transaction.atomic
def release_reversed(start: date) -> set[int]:
    """Una venta TUU anulada (o no completada) deja el grupo de su documento.

    La sincronización actualiza el estado en su lugar: sin esto la venta seguiría
    respaldando su cobro. Vuelve, sin cobro ni marca manual, a un grupo huérfano propio
    (que se evalúa ``EXCLUDED``); el grupo del documento queda esperando su venta.
    """
    sales = list(
        TerminalSale.objects.filter(
            fiscal_match__invoice__isnull=False, fiscal_match__issue_date__gte=start
        ).exclude(status=TerminalSale.Status.COMPLETED)
    )
    if not sales:
        return set()
    sources = {s.fiscal_match_id for s in sales}
    groups = [tuu_orphan_group(s) for s in sales]
    FiscalMatch.objects.bulk_create(groups)
    for sale, group in zip(sales, groups, strict=True):
        sale.fiscal_match, sale.matched_movement, sale.linked_manually = group, None, False
    TerminalSale.objects.bulk_update(sales, ["fiscal_match", "matched_movement", "linked_manually"])
    touched = sources | {g.id for g in groups}
    stamp_groups(touched)
    return touched
