"""ERP ↔ TUU por pago: cada venta TUU se une al cobro que respalda (ADR-0138, spec §5.3).

La venta se cruza con un ``TreasuryMovement`` (mismo monto del cobro, ventana de
tiempo, dispositivo/tipo de pago), no con el total del documento: una factura
pagada con dos tarjetas espera dos ventas TUU. Al unirse, la venta pasa al grupo
del documento del cobro y el grupo huérfano que tenía se borra si queda vacío.
"""

from collections import Counter, defaultdict
from datetime import datetime, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from accounting.models import RCVDocument, RCVSettings
from tax.fiscal_match.candidates import (
    LinkResult,
    candidate_movements_where,
    local_midnight,
    payment_compatible,
    stamp_groups,
    terminals_by_device,
    tuu_type_fits,
)
from tax.models import FiscalMatch
from treasury.models import TerminalSale, TreasuryMovement

ANONYMOUS_SII_CODES = frozenset({39, 41, 48})


def _pair_fifo_anonymous(
    unmatched_sales: list[TerminalSale],
    candidates: dict[int, set[int]],
    by_id: dict[int, TreasuryMovement],
    taken_m_ids: set[int],
    rival_m_ids: set[int],
) -> dict[int, TreasuryMovement]:
    """Empareja ventas y cobros anónimos (39, 41, 48) homogéneos 1 a 1 por orden cronológico (FIFO).

    Solo aplica si el número de ventas es exactamente igual al número de cobros disponibles
    para ese día, monto, tipo DTE y dispositivo, y cada par resultante cae dentro de la ventana.
    """
    groups: dict[tuple, list[TerminalSale]] = defaultdict(list)
    for s in unmatched_sales:
        if s.document_type in ANONYMOUS_SII_CODES and (amount := _clp(s.sale_amount)) is not None:
            day = timezone.localdate(s.transaction_at)
            key = (day, amount, s.document_type, s.device_id)
            groups[key].append(s)

    fifo_matched: dict[int, TreasuryMovement] = {}
    for key, group_sales in groups.items():
        other_sale_cands = {
            m_id
            for other in unmatched_sales
            if other not in group_sales
            for m_id in candidates[other.id]
        }
        pool_ids = {
            m_id
            for s in group_sales
            for m_id in candidates[s.id]
            if m_id in by_id and m_id not in taken_m_ids and m_id not in rival_m_ids
        }
        if pool_ids & other_sale_cands:
            continue
        if len(group_sales) != len(pool_ids):
            continue
        sorted_sales = sorted(group_sales, key=lambda s: (s.transaction_at, s.id))
        sorted_movements = sorted([by_id[mid] for mid in pool_ids], key=lambda m: (m.created_at, m.id))
        if all(m.id in candidates[s.id] for s, m in zip(sorted_sales, sorted_movements)):
            for s, m in zip(sorted_sales, sorted_movements):
                fifo_matched[s.id] = m
                taken_m_ids.add(m.id)

    return fifo_matched


@transaction.atomic
def link_terminal_sales(lo: datetime, hi: datetime, *, rematch_ids: set[int]) -> LinkResult:
    """Une las ventas TUU huérfanas de [lo, hi) y las de ``rematch_ids`` con su cobro."""
    settings = RCVSettings.get_settings()
    if settings.fiscal_match_start_date is None:
        return LinkResult(0)
    window = timedelta(minutes=settings.terminal_match_window_minutes)
    lo = max(lo, local_midnight(settings.fiscal_match_start_date))

    in_range = Q(
        transaction_at__gte=lo,
        transaction_at__lt=hi,
        fiscal_match__isnull=False,
        fiscal_match__invoice__isnull=True,
    )
    sales = list(
        TerminalSale.objects.filter(
            in_range | Q(fiscal_match_id__in=rematch_ids),
            status=TerminalSale.Status.COMPLETED,
            linked_manually=False,
        ).select_related("fiscal_match")
    )
    if not sales:
        return LinkResult(0)
    selected = {s.id for s in sales}
    spans = _spans(lo, hi, sales, window)

    # Cobros ya tomados por ventas fuera de la selección (manuales u otro rango) no se reasignan.
    taken = set(
        TerminalSale.objects.filter(matched_movement__isnull=False)
        .exclude(id__in=selected)
        .values_list("matched_movement_id", flat=True)
    )
    movements = [
        m for m in candidate_movements_where(_within("created_at", spans)) if m.id not in taken
    ]
    # Ventas vecinas sin cobro compiten por los mismos cobros: se leen para detectar
    # ambigüedad (también en el borde del rango), pero no se escriben.
    competitors = list(
        TerminalSale.objects.filter(
            _within("transaction_at", spans),
            status=TerminalSale.Status.COMPLETED,
            linked_manually=False,
            matched_movement__isnull=True,
        ).exclude(id__in=selected)
    )
    terminals = terminals_by_device({s.device_id for s in sales + competitors if s.device_id})

    candidates = _candidates(sales, movements, window, terminals)
    rivals = _candidates(competitors, movements, window, terminals)
    uses: Counter[int] = Counter(
        m for cands in (*candidates.values(), *rivals.values()) for m in cands
    )
    # Una venta seleccionada que conserva su cobro sin tenerlo de candidato (cambió el
    # monto, o su nuevo cobro no tiene grupo) lo sigue ocupando: cuenta como un uso más.
    for s in sales:
        if s.matched_movement_id is not None and s.matched_movement_id not in candidates[s.id]:
            uses[s.matched_movement_id] += 1
    by_id = {m.id: m for m in movements}
    unique = {
        s.id: by_id[next(iter(cands))]
        for s in sales
        if len(cands := candidates[s.id]) == 1 and uses[next(iter(cands))] == 1
    }

    # Emparejamiento cronológico (FIFO) para documentos anónimos (39, 41, 48)
    taken_m_ids = {m.id for m in unique.values()}
    for s in sales:
        if s.matched_movement_id is not None and s.matched_movement_id not in candidates[s.id]:
            taken_m_ids.add(s.matched_movement_id)
    rival_m_ids = {m for cands in rivals.values() for m in cands}
    unmatched_sales = [s for s in sales if s.id not in unique]

    fifo_unique = _pair_fifo_anonymous(
        unmatched_sales, candidates, by_id, taken_m_ids, rival_m_ids
    )
    unique.update(fifo_unique)

    # Varios cobros, o un cobro que otra venta también reclama: no se elige por cercanía.
    ambiguous = {s.fiscal_match_id for s in sales if candidates[s.id] and s.id not in unique}
    return _attach(sales, unique, ambiguous)


def _spans(
    lo: datetime, hi: datetime, sales: list[TerminalSale], window: timedelta
) -> list[tuple[datetime, datetime]]:
    """Tramos de tiempo a leer: el rango ± ventana y cada venta re-cuadrada fuera de él ± ventana.

    Un grupo viejo en ``rematch_ids`` no estira la lectura a todo el intervalo entre
    su venta y el rango (las filas leídas no crecen con la distancia).
    """
    raw = sorted(
        [(lo - window, hi + window)]
        + [
            (s.transaction_at - window, s.transaction_at + window)
            for s in sales
            if not lo <= s.transaction_at < hi
        ]
    )
    merged = [raw[0]]
    for start, end in raw[1:]:
        if start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def _within(field: str, spans: list[tuple[datetime, datetime]]) -> Q:
    q = Q()
    for start, end in spans:
        q |= Q(**{f"{field}__gte": start, f"{field}__lte": end})
    return q


def _clp(amount: Decimal) -> int | None:
    """Monto en pesos enteros; ``None`` si trae decimales (tolerancia 0: nunca calza)."""
    return int(amount) if amount == amount.to_integral_value() else None


def _candidates(
    sales: list[TerminalSale],
    movements: list[TreasuryMovement],
    window: timedelta,
    terminals: dict[int, set[int]],
) -> dict[int, set[int]]:
    """sale_id → ids de cobros compatibles (monto del cobro, ventana y medio de pago)."""
    by_amount: dict[int, list[TreasuryMovement]] = defaultdict(list)
    for m in movements:
        if (key := _clp(m.amount)) is not None:
            by_amount[key].append(m)
    out: dict[int, set[int]] = {}
    for s in sales:
        key = _clp(s.sale_amount)
        compatible = [
            m
            for m in (by_amount.get(key, ()) if key is not None else ())
            if abs(m.created_at - s.transaction_at) <= window
            and payment_compatible(s, m, terminals)
        ]
        # The DTE type TUU reports breaks ties (a 39 and a 48 of the same amount are not
        # ambiguous), but it never discards the only candidate: a card boleta 41 that TUU
        # filed as 48 must still link, so the group shows the type DIFF instead of PENDING.
        fitting = [m for m in compatible if tuu_type_fits(s, m.invoice.sii_code)]
        out[s.id] = {m.id for m in (fitting or compatible)}
    return out


def _attach(
    sales: list[TerminalSale], unique: dict[int, TreasuryMovement], ambiguous: set[int]
) -> LinkResult:
    """Mueve cada venta con cobro único al grupo de su documento (con las boletas RCV de su huérfano)."""
    invoice_ids = {m.invoice_id for m in unique.values()}
    groups = dict(
        FiscalMatch.objects.filter(invoice_id__in=invoice_ids).values_list("invoice_id", "id")
    )
    orphan_ids = {
        s.fiscal_match_id for s in sales if s.id in unique and s.fiscal_match.invoice_id is None
    }
    rcv_docs = list(
        RCVDocument.objects.filter(fiscal_match_id__in=orphan_ids | set(groups.values())).only(
            "id", "fiscal_match_id"
        )
    )
    with_rcv = {d.fiscal_match_id for d in rcv_docs}
    rcv_by_group: dict[int, list[RCVDocument]] = defaultdict(list)
    for d in rcv_docs:
        rcv_by_group[d.fiscal_match_id].append(d)

    moved_sales: list[TerminalSale] = []
    moved_rcv: list[RCVDocument] = []
    touched: set[int] = set()
    for s in sales:
        m = unique.get(s.id)
        target = groups.get(m.invoice_id) if m else None
        if target is None or (s.fiscal_match_id == target and s.matched_movement_id == m.id):
            continue
        source = s.fiscal_match_id
        touched |= {source, target}
        if source in orphan_ids and target not in with_rcv:
            for d in rcv_by_group.pop(source, []):
                d.fiscal_match_id = target
                moved_rcv.append(d)
                with_rcv.add(target)
        s.fiscal_match_id, s.matched_movement = target, m
        moved_sales.append(s)

    # Una venta que deja su cobro y otra que lo toma en la misma corrida chocarían con
    # la unicidad de ``matched_movement``: primero se liberan, luego se asignan.
    TerminalSale.objects.filter(id__in=[s.id for s in moved_sales]).update(matched_movement=None)
    TerminalSale.objects.bulk_update(moved_sales, ["fiscal_match", "matched_movement"])
    RCVDocument.objects.bulk_update(moved_rcv, ["fiscal_match"])
    FiscalMatch.objects.filter(
        id__in=orphan_ids,
        invoice__isnull=True,
        terminal_sales__isnull=True,
        rcv_documents__isnull=True,
    ).delete()
    stamp_groups(touched)
    return LinkResult(len(moved_sales), ambiguous, touched)
