"""Búsqueda de candidatos «sin cuadrar» por parte, con puntaje (spec §5.2, §7b, §7c).

El universo y el orden se resuelven en SQL: el queryset anota un puntaje aproximado con
la misma ponderación que ``scoring`` (monto, distancia de días, RUT, tipo y folio) y
ordena por él, sin traer todo a memoria. El puntaje y las advertencias de cada fila de la
página salen de ``score_candidate``, con datos precargados: si difieren del SQL, prevalece
el de Python (el SQL solo ordena). Consultas fijas por página (ADR-0118).
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Literal

from django.db.models import (
    Case,
    Exists,
    Expression,
    IntegerField,
    OuterRef,
    Q,
    QuerySet,
    Value,
    When,
)
from django.utils import timezone

from accounting.integrations.rcv_normalizer import normalize_rut
from accounting.models import RCVDocument
from billing.models import Invoice
from tax.fiscal_match.candidates import (
    BOLETA_SII_CODES,
    PaymentOption,
    evaluable_invoice_q,
    free_inbound_movements,
    free_payments,
    local_midnight,
    payment_options,
    payments_assignable,
)
from tax.fiscal_match.codes import NO_FREE_PAYMENT, SECOND_RCV, TYPE_INCOMPATIBLE
from tax.fiscal_match.engine import SCAN_DAYS
from tax.fiscal_match.rcv import RCV_TO_FISCAL_DIRECTION, rut_body
from tax.fiscal_match.scoring import (
    DAY_BASE,
    DAY_STEP,
    FOLIO_SCORE,
    LABELS,
    W_AMOUNT,
    W_DAY,
    W_RUT,
    W_TYPE,
    CandidateFacts,
    MatchWarning,
    Reference,
    reference_for,
    score_candidate,
    type_warning,
)
from tax.fiscal_match.selectors import SETTLED, parse_search
from tax.fiscal_match.services import rcv_would_travel
from tax.models import FiscalMatch
from treasury.models import TerminalSale, TreasuryMovement

Part = Literal["erp", "tuu", "rcv"]
Ordering = Literal["score", "recent"]
Condition = Q | bool  # ``True``/``False``: el criterio no depende de la fila

# Días en que la distancia aún suma puntos: max(0, 15 − 3 × días) > 0.
_DAY_REACH = range(1, DAY_BASE // DAY_STEP)


@dataclass
class Search:
    """Universo ordenado de una parte y cómo armar los ítems de una página de él."""

    queryset: QuerySet
    build: Callable[[list], list[dict]] = field(default=lambda rows: [])


def _empty() -> Search:
    return Search(FiscalMatch.objects.none())


# --- referencia -----------------------------------------------------------------------


@dataclass(frozen=True)
class _Group:
    """Lo que la búsqueda lee del grupo, cargado una vez."""

    group: FiscalMatch
    ref: Reference | None
    own_sales: list[TerminalSale]  # ventas del huérfano (sin anuladas)
    free: list[TreasuryMovement]  # cobros libres del documento del grupo
    has_rcv: bool  # el grupo ya tiene algún registro del SII
    # Huérfano: una referencia por registro propio (ventas vivas y RCV); el tipo de una tarjeta
    # ERP se compara contra todos, como ``_link_invoice``.
    own_refs: tuple[Reference, ...] = ()


def _number_folio(number: str) -> int | None:
    return int(number) if number and number.isdigit() else None


def _load_group(group: FiscalMatch) -> _Group:
    """Llama a ``reference_for`` por registro: el documento, o las ventas TUU y RCV del huérfano."""
    if group.invoice_id is not None:
        free = free_inbound_movements(group.invoice)
        ref = reference_for(
            group,
            kind="erp",
            folio=_number_folio(group.invoice.number),
            free_payment_amounts=frozenset(Decimal(m.amount) for m in free),
        )
        has_rcv = RCVDocument.objects.filter(fiscal_match=group).exists()
        return _Group(group, ref, [], free, has_rcv=has_rcv)
    sales = list(TerminalSale.objects.filter(fiscal_match=group).order_by("transaction_at", "id"))
    live = [s for s in sales if s.status != TerminalSale.Status.REVERSED]
    docs = list(RCVDocument.objects.filter(fiscal_match=group).order_by("id"))
    own_refs = tuple(
        [reference_for(group, kind="tuu", sale=s) for s in live]
        + [reference_for(group, kind="rcv", rcv=d) for d in docs]
    )
    if sales:
        ref = reference_for(group, kind="tuu", sale=(live or sales)[0])
    elif docs:
        ref = own_refs[0]
    else:
        ref = None
    return _Group(group, ref, live, [], has_rcv=bool(docs), own_refs=own_refs)


# --- puntaje aproximado en SQL --------------------------------------------------------


@dataclass(frozen=True)
class _Columns:
    """Columnas de cada parte que entran al puntaje aproximado."""

    kind: Part
    sii: str
    day: Callable[[date], Q]
    amount: Callable[[Decimal], Q]
    amount_in: Callable[[frozenset[Decimal]], Q]
    folio: Callable[[int], Q] | None
    rut: Callable[[str], Q] | None  # mismo RUT normalizado («76123456-7»)
    no_rut: Q | None  # la fila no tiene RUT
    order_date: str


def _day_q(field_name: str) -> Callable[[date], Q]:
    return lambda day: Q(**{field_name: day})


def _local_day_q(day: date) -> Q:
    return Q(
        transaction_at__gte=local_midnight(day),
        transaction_at__lt=local_midnight(day + timedelta(days=1)),
    )


def _rcv_amount(amount: Decimal) -> Q:
    return Q(total_amount=amount) | Q(total_amount=-amount)


def _rcv_amount_in(amounts: frozenset[Decimal]) -> Q:
    return Q(total_amount__in=amounts) | Q(total_amount__in=[-a for a in amounts])


_ERP = _Columns(
    kind="erp",
    sii="dte_type",
    day=_day_q("issue_date"),
    amount=lambda a: Q(erp_amount=a),
    amount_in=lambda s: Q(erp_amount__in=s),
    folio=lambda f: Q(invoice__number__regex=rf"^0*{f}$"),  # como int(number) en Python
    rut=lambda r: Q(counterparty_rut=r),  # el grupo guarda el RUT normalizado
    no_rut=Q(counterparty_rut=""),
    order_date="issue_date",
)
_TUU = _Columns(
    kind="tuu",
    sii="document_type",
    day=_local_day_q,
    amount=lambda a: Q(sale_amount=a),
    amount_in=lambda s: Q(sale_amount__in=s),
    folio=None,
    rut=None,
    no_rut=None,
    order_date="transaction_at",
)
_RCV = _Columns(
    kind="rcv",
    sii="dte_type",
    day=_day_q("issue_date"),
    amount=_rcv_amount,
    amount_in=_rcv_amount_in,
    folio=lambda f: Q(folio=f),
    rut=lambda r: Q(rut_key=r.replace("-", "")),  # anotada en el universo RCV
    no_rut=Q(counterparty_rut=""),
    order_date="issue_date",
)


def _points(condition: Condition, weight: int) -> Expression:
    if isinstance(condition, bool):
        return Value(weight if condition else 0)
    return Case(When(condition, then=Value(weight)), default=Value(0), output_field=IntegerField())


def _type_q(ref: Reference, cols: _Columns) -> Condition:
    """Las reglas de ``scoring._type_warning`` (tipo TUU y efectivo solo en boletas) en SQL."""
    sii = cols.sii
    if cols.kind == "tuu":
        fits = Q(**{f"{sii}__isnull": True}) | Q(**{sii: ref.sii_code})
        if ref.sii_code in BOLETA_SII_CODES:
            return fits
        return fits & ~Q(payment_type=TerminalSale.PaymentType.CASH)
    if ref.kind == "tuu":
        cash = ref.payment_type == TerminalSale.PaymentType.CASH
        boleta = Q(**{f"{sii}__in": BOLETA_SII_CODES})
        if ref.sii_code is None:
            return boleta if cash else True
        same = Q(**{sii: ref.sii_code})
        return same & boleta if cash else same
    if ref.sii_code is None:
        return True
    return Q(**{f"{sii}__isnull": True}) | Q(**{sii: ref.sii_code})


def _amount_q(ref: Reference, cols: _Columns) -> Condition:
    if cols.kind == "tuu" and ref.free_payment_amounts:
        return cols.amount_in(ref.free_payment_amounts)
    if ref.amount is None:
        return False
    if cols.kind == "erp" and ref.kind == "tuu":  # la venta respalda un cobro libre del documento
        paid = free_payments(ref.amount).filter(invoice_id=OuterRef("invoice_id"))
        return cols.amount(ref.amount) | Q(Exists(paid))
    return cols.amount(ref.amount)


def _day_score(ref: Reference, cols: _Columns) -> Expression:
    if ref.date is None:
        return Value(0)
    whens = [When(cols.day(ref.date), then=Value(W_DAY))]
    for n in _DAY_REACH:
        near = cols.day(ref.date - timedelta(days=n)) | cols.day(ref.date + timedelta(days=n))
        whens.append(When(near, then=Value(DAY_BASE - DAY_STEP * n)))
    return Case(*whens, default=Value(0), output_field=IntegerField())


def _rut_q(ref: Reference, cols: _Columns) -> Condition:
    """Las reglas de ``scoring._rut_fits``: sin RUT (TUU, boletas, vacío) suma el criterio."""
    if cols.rut is None or ref.kind == "tuu" or not ref.rut or ref.sii_code in BOLETA_SII_CODES:
        return True
    return cols.no_rut | Q(**{f"{cols.sii}__in": BOLETA_SII_CODES}) | cols.rut(ref.rut)


def _approx_score(ref: Reference, cols: _Columns) -> Expression:
    type_q = _type_q(ref, cols)
    total = (
        _points(type_q, W_TYPE)
        + _points(_amount_q(ref, cols), W_AMOUNT)
        + _day_score(ref, cols)
        + _points(_rut_q(ref, cols), W_RUT)
    )
    if ref.folio is None or cols.folio is None or type_q is False:
        return total
    same = cols.folio(ref.folio) if type_q is True else cols.folio(ref.folio) & type_q
    return Case(When(same, then=Value(FOLIO_SCORE)), default=total, output_field=IntegerField())


def _ordered(qs: QuerySet, ref: Reference, cols: _Columns, ordering: Ordering) -> QuerySet:
    recent = (f"-{cols.order_date}", "-id")
    if ordering == "recent":
        return qs.order_by(*recent)
    return qs.annotate(approx_score=_approx_score(ref, cols)).order_by("-approx_score", *recent)


def _since() -> date:
    return timezone.localdate() - timedelta(days=SCAN_DAYS)


# --- erp ------------------------------------------------------------------------------


def _erp_q(term: str) -> Q:
    parsed = parse_search(term)
    q = (
        Q(invoice__number=parsed.text)
        | Q(invoice__partner_name_snapshot__icontains=parsed.text)
        | Q(invoice__contact__name__icontains=parsed.text)
        | Q(invoice__sale_order__customer__name__icontains=parsed.text)
        | Q(invoice__purchase_order__supplier__name__icontains=parsed.text)
    )
    if parsed.rut:
        q |= Q(counterparty_rut=parsed.rut)
    if parsed.number is not None:
        q |= Q(erp_amount=Decimal(parsed.number))
    return q


def _erp_search(g: _Group, q: str, ordering: Ordering) -> Search:
    """Documentos de la misma dirección, evaluables, cuyo grupo no está cuadrado ni excluido,
    que pueden recibir lo que trae el huérfano (Ruling G): con venta TUU, documentos con algún
    cobro libre; con RCV, facturas y notas sin registro del SII o boletas aunque ya tengan."""
    group = g.group
    if group.invoice_id is not None or g.ref is None:
        return _empty()
    if not g.own_sales and not g.has_rcv:  # solo ventas anuladas: no hay nada que unir
        return _empty()
    qs = (
        FiscalMatch.objects.filter(
            invoice__isnull=False,
            direction=group.direction,
            invoice__in=Invoice.objects.filter(evaluable_invoice_q()),
        )
        .exclude(status__in=SETTLED)
        .select_related(
            "invoice__contact",
            "invoice__sale_order__customer",
            "invoice__purchase_order__supplier",
        )
    )
    if g.own_sales:  # un documento admite varias ventas TUU: basta un cobro libre
        qs = qs.filter(Exists(free_payments().filter(invoice_id=OuterRef("invoice_id"))))
    if g.has_rcv:  # facturas y notas llevan un solo registro del SII; las boletas acumulan
        has_rcv = Exists(RCVDocument.objects.filter(fiscal_match=OuterRef("pk")))
        qs = qs.exclude(has_rcv & ~Q(dte_type__in=BOLETA_SII_CODES))
    qs = qs.filter(_erp_q(q)) if q else qs.filter(issue_date__gte=_since())
    return Search(_ordered(qs, g.ref, _ERP, ordering), lambda rows: _erp_items(g, rows))


def _erp_items(g: _Group, rows: list[FiscalMatch]) -> list[dict]:
    payments = _payments_by_invoice(g.own_sales, [r.invoice_id for r in rows])
    items = []
    for row in rows:
        invoice = row.invoice
        facts = CandidateFacts(
            kind="erp",
            direction=row.direction,
            sii_code=row.dte_type,
            date=row.issue_date,
            rut=row.counterparty_rut,
            amount=row.erp_amount,
            folio=_number_folio(invoice.number),
            free_payment_amounts=frozenset(Decimal(m.amount) for m in payments[invoice.pk]),
        )
        item = _item(g.ref, facts, invoice.pk, invoice.display_id, invoice.partner_display_name)
        _warn_other_types(item, g, facts)
        if g.own_sales:
            by_sale = {s.pk: payment_options(s, payments[invoice.pk]) for s in g.own_sales}
            item["payments_by_sale"] = by_sale
            if not payments_assignable({s: [o.movement.pk for o in opts] for s, opts in by_sale.items()}):
                _warn_no_payment(item)
        items.append(item)
    return items


def _warn_other_types(item: dict, g: _Group, facts: CandidateFacts) -> None:
    """El tipo de la tarjeta ERP contra cada registro del huérfano, no solo el de referencia."""
    if any(w.code == TYPE_INCOMPATIBLE for w in item["warnings"]):
        return
    for ref in g.own_refs:
        warning = type_warning(ref, facts)
        if warning is not None:
            item["warnings"].append(warning)
            return


def _warn_no_payment(item: dict) -> None:
    item["warnings"].append(MatchWarning(NO_FREE_PAYMENT, LABELS[NO_FREE_PAYMENT], True))


def _payments_by_invoice(
    sales: list[TerminalSale], invoice_ids: list[int]
) -> dict[int, list[TreasuryMovement]]:
    """Cobros libres de los documentos de la página, en una consulta (los ofrece cada venta propia)."""
    out: dict[int, list[TreasuryMovement]] = {i: [] for i in invoice_ids}
    if not sales or not invoice_ids:
        return out
    rows = (
        free_payments()
        .filter(invoice_id__in=invoice_ids)
        .select_related("payment_method_new")
        .order_by("created_at", "id")
    )
    for m in rows:
        out[m.invoice_id].append(m)
    return out


# --- tuu ------------------------------------------------------------------------------


def _tuu_q(term: str) -> Q:
    parsed = parse_search(term)
    q = (
        Q(sequence_number=parsed.text)
        | Q(sale_id=parsed.text)
        | Q(device__name__icontains=parsed.text)
    )
    if parsed.number is not None:
        q |= Q(sale_amount=Decimal(parsed.number))
    return q


def _tuu_search(g: _Group, q: str, ordering: Ordering) -> Search:
    """Ventas TUU completadas de grupos huérfanos; en un huérfano, solo las propias."""
    group = g.group
    if g.ref is None:
        return _empty()
    base = TerminalSale.objects.select_related("device")
    if group.invoice_id is None:
        qs = base.filter(fiscal_match=group).order_by("transaction_at", "id")
        return Search(qs, lambda rows: _tuu_items(g, rows))
    if group.direction != FiscalMatch.Direction.SALE:
        return _empty()
    qs = base.filter(
        status=TerminalSale.Status.COMPLETED,
        fiscal_match__isnull=False,
        fiscal_match__invoice__isnull=True,
    ).exclude(fiscal_match__status__in=SETTLED)
    qs = qs.filter(_tuu_q(q)) if q else qs.filter(transaction_at__gte=local_midnight(_since()))
    return Search(_ordered(qs, g.ref, _TUU, ordering), lambda rows: _tuu_items(g, rows))


def _carried_rcv(g: _Group, rows: list[TerminalSale]) -> dict[int, list[dict]]:
    """Registros del SII del huérfano de cada venta que viajarían con ella al documento (una consulta)."""
    by_group: dict[int, list[RCVDocument]] = {}
    for doc in RCVDocument.objects.filter(
        fiscal_match_id__in={s.fiscal_match_id for s in rows}
    ).order_by("id"):
        by_group.setdefault(doc.fiscal_match_id, []).append(doc)
    invoice = g.group.invoice
    return {
        gid: [{"id": d.pk, "folio": str(d.folio)} for d in docs]
        for gid, docs in by_group.items()
        if rcv_would_travel(g.group, invoice, docs)
    }


def _tuu_items(g: _Group, rows: list[TerminalSale]) -> list[dict]:
    with_document = g.group.invoice_id is not None
    carried = _carried_rcv(g, rows) if with_document and not g.has_rcv else {}
    items = []
    for sale in rows:
        at = timezone.localtime(sale.transaction_at)
        facts = CandidateFacts(
            kind="tuu",
            direction=FiscalMatch.Direction.SALE,
            sii_code=sale.document_type,
            date=at.date(),
            rut=None,
            amount=sale.sale_amount,
            folio=None,
            payment_type=sale.payment_type,
            status=sale.status,
            tuu_document_type=sale.document_type,
        )
        device = sale.device.name if sale.device else ""
        item = _item(g.ref, facts, sale.pk, f"Venta TUU #{sale.pk}", device)
        item["datetime"] = sale.transaction_at
        if with_document:
            options: list[PaymentOption] = payment_options(sale, g.free)
            item["compatible_movements"] = options
            if not options:
                _warn_no_payment(item)
            item["carried_rcv"] = carried.get(sale.fiscal_match_id, [])
        items.append(item)
    return items


# --- rcv ------------------------------------------------------------------------------


def _rcv_q(term: str) -> Q:
    parsed = parse_search(term)
    q = Q(counterparty_name__icontains=parsed.text)
    if parsed.rut:
        q |= Q(rut_key=parsed.rut.replace("-", ""))
    if parsed.number is not None:
        q |= Q(folio=parsed.number) | _rcv_amount(Decimal(parsed.number))
    return q


def _rcv_search(g: _Group, q: str, ordering: Ordering) -> Search:
    """Registros RCV de la misma dirección en huérfanos sin ventas TUU; en un huérfano, los propios."""
    group = g.group
    if g.ref is None:
        return _empty()
    if group.invoice_id is None:
        qs = RCVDocument.objects.filter(fiscal_match=group).order_by("issue_date", "id")
        return Search(qs, lambda rows: _rcv_items(g, rows))
    directions = [d for d, fiscal in RCV_TO_FISCAL_DIRECTION.items() if fiscal == group.direction]
    qs = (
        RCVDocument.objects.annotate(rut_key=rut_body("counterparty_rut"))
        .filter(
            direction__in=directions,
            fiscal_match__isnull=False,
            fiscal_match__invoice__isnull=True,
            missing_since_import__isnull=True,
        )
        .exclude(fiscal_match__status__in=SETTLED)
        .exclude(
            Exists(
                TerminalSale.objects.filter(
                    fiscal_match=OuterRef("fiscal_match"), status=TerminalSale.Status.COMPLETED
                )
            )
        )
    )
    qs = qs.filter(_rcv_q(q)) if q else qs.filter(issue_date__gte=_since())
    return Search(_ordered(qs, g.ref, _RCV, ordering), lambda rows: _rcv_items(g, rows))


def _rcv_items(g: _Group, rows: list[RCVDocument]) -> list[dict]:
    # Facturas y notas llevan un solo registro del SII: con uno ya unido, unir otro bloquea.
    full = g.group.invoice_id is not None and g.has_rcv and g.group.dte_type not in BOLETA_SII_CODES
    items = []
    for doc in rows:
        facts = CandidateFacts(
            kind="rcv",
            direction=RCV_TO_FISCAL_DIRECTION[doc.direction],
            sii_code=doc.dte_type,
            date=doc.issue_date,
            rut=doc.counterparty_rut,
            amount=abs(doc.total_amount),
            folio=doc.folio,
        )
        label = f"{doc.dte_type} N° {doc.folio}"
        counterparty = doc.counterparty_name or normalize_rut(doc.counterparty_rut)
        item = _item(g.ref, facts, doc.pk, label, counterparty)
        if full:
            item["warnings"].append(MatchWarning(SECOND_RCV, LABELS[SECOND_RCV], True))
        items.append(item)
    return items


# --- ítems ----------------------------------------------------------------------------


def _item(ref: Reference, facts: CandidateFacts, pk: int, label: str, counterparty: str) -> dict:
    score, warnings = score_candidate(ref, facts)
    return {
        "id": pk,
        "kind": facts.kind,
        "label": label,
        "counterparty": counterparty,
        "date": facts.date,
        "amount": facts.amount,
        "score": score,
        "warnings": warnings,
    }


_SEARCHES = {"erp": _erp_search, "tuu": _tuu_search, "rcv": _rcv_search}


def search_candidates(
    group: FiscalMatch, *, part: Part, q: str = "", ordering: Ordering = "score"
) -> Search:
    """Universo «sin cuadrar» de la parte frente al grupo, ordenado; ``build`` arma una página."""
    return _SEARCHES[part](_load_group(group), q.strip(), ordering)


_MATCH_GROUP = _Columns(
    kind="rcv",
    sii="dte_type",
    day=_day_q("issue_date"),
    amount=lambda a: Q(rcv_amount=a) | Q(tuu_amount=a),
    amount_in=lambda s: Q(rcv_amount__in=s) | Q(tuu_amount__in=s),
    folio=lambda f: Q(rcv_documents__folio=f),
    rut=lambda r: Q(counterparty_rut=r),
    no_rut=Q(counterparty_rut=""),
    order_date="issue_date",
)


def _match_group_q(term: str) -> Q:
    parsed = parse_search(term)
    q = Q(counterparty_rut__icontains=parsed.text) | Q(rcv_documents__counterparty_name__icontains=parsed.text)
    if parsed.rut:
        q |= Q(counterparty_rut__icontains=parsed.rut.replace("-", ""))
    if parsed.number is not None:
        q |= (
            Q(rcv_documents__folio=parsed.number)
            | Q(rcv_amount=Decimal(parsed.number))
            | Q(tuu_amount=Decimal(parsed.number))
        )
    return q


def candidates_for_context(
    *,
    invoice_id: int | None = None,
    direction: str | None = None,
    sii_code: int | None = None,
    counterparty_rut: str = "",
    amount: Decimal | None = None,
    date: date | None = None,
    q: str = "",
    ordering: Ordering = "score",
) -> Search:
    """Busca grupos FiscalMatch huérfanos ('sin cuadrar') compatibles con un documento o pre-contexto."""
    from billing.fiscal_key import fiscal_key
    from billing.models import Invoice

    ref_folio = None
    if invoice_id is not None:
        invoice = (
            Invoice.objects.select_related("contact")
            .filter(pk=invoice_id)
            .first()
        )
        if invoice is None:
            return _empty()
        fkey = fiscal_key(invoice)
        direction = fkey.direction
        sii_code = fkey.sii_code
        counterparty_rut = fkey.counterparty_rut
        amount = Decimal(invoice.total) if invoice.total is not None else None
        date = invoice.date
        ref_folio = fkey.folio
    else:
        counterparty_rut = normalize_rut(counterparty_rut) if counterparty_rut else ""

    ref = Reference(
        kind="erp",
        direction=direction,
        sii_code=sii_code,
        date=date,
        rut=counterparty_rut or None,
        amount=amount,
        folio=ref_folio,
        free_payment_amounts=frozenset(),
    )

    qs = (
        FiscalMatch.objects.filter(
            invoice__isnull=True,
            direction=direction,
        )
        .exclude(status__in=SETTLED)
        .prefetch_related("rcv_documents", "terminal_sales__device")
    )
    if sii_code is not None:
        qs = qs.filter(rcv_documents__dte_type=sii_code)

    # Solo mostrar grupos con al menos un RCV (excluir huérfanos solo-TUU)
    qs = qs.filter(rcv_documents__isnull=False).distinct()

    qs = qs.filter(_match_group_q(q)).distinct() if q else qs.filter(issue_date__gte=_since()).distinct()

    def _build(rows: list[FiscalMatch]) -> list[dict]:
        items = []
        for group in rows:
            rcvs = list(group.rcv_documents.all())
            doc = rcvs[0] if rcvs else None

            # Solo incluir grupos con RCV real del tipo solicitado
            if doc is None:
                continue
            if sii_code is not None and doc.dte_type != sii_code:
                continue

            if doc:
                kind = "rcv"
                f_sii = doc.dte_type
                f_date = doc.issue_date
                f_rut = doc.counterparty_rut
                f_amount = abs(doc.total_amount)
                f_folio = doc.folio
                f_name = doc.counterparty_name or normalize_rut(doc.counterparty_rut) or doc.counterparty_rut
                label = f"DTE {group.dte_type or doc.dte_type} N° {doc.folio}"
            elif sale:
                kind = "tuu"
                f_sii = sale.document_type
                at = timezone.localtime(sale.transaction_at)
                f_date = at.date()
                f_rut = None
                f_amount = sale.sale_amount
                f_folio = None
                f_name = sale.device.name if sale.device else "Venta TUU"
                label = f"Venta TUU #{sale.pk}"
            else:
                kind = "rcv"
                f_sii = group.dte_type
                f_date = group.issue_date
                f_rut = group.counterparty_rut
                f_amount = group.rcv_amount or group.tuu_amount or Decimal(0)
                f_folio = None
                f_name = group.counterparty_rut
                label = f"Grupo #{group.pk}"

            facts = CandidateFacts(
                kind=kind,
                direction=group.direction,
                sii_code=f_sii,
                date=f_date,
                rut=f_rut,
                amount=f_amount,
                folio=f_folio,
            )
            item = _item(ref, facts, group.pk, label, f_name)
            item["fiscal_match_id"] = group.pk
            item["carried_rcv"] = [{"id": d.pk, "folio": str(d.folio)} for d in rcvs]
            items.append(item)
        return items

    return Search(_ordered(qs, ref, _MATCH_GROUP, ordering), _build)

