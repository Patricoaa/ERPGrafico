"""Puntaje de coincidencia y advertencias de un candidato frente a un grupo (spec §5.2, §7b, §7c).

Módulo puro: no consulta la base. La búsqueda precarga los datos y arma ``Reference`` y
``CandidateFacts``; aquí solo se puntúa. Las reglas de tipo reutilizan los predicados de
``candidates`` (los mismos que aplican las uniones manuales), y los códigos de advertencia
son los de ``services`` cuando corresponden a una regla que bloquea el guardado.
"""

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Literal

from django.utils import timezone

from accounting.integrations.rcv_normalizer import normalize_rut
from tax.fiscal_match.candidates import BOLETA_SII_CODES, cash_sale_fits, tuu_type_fits
from tax.fiscal_match.services import NOT_COMPLETED, OTHER_DIRECTION, TYPE_INCOMPATIBLE
from treasury.models import TerminalSale

Kind = Literal["erp", "tuu", "rcv"]

OTHER_AMOUNT = "OTHER_AMOUNT"
OTHER_DAY = "OTHER_DAY"
OTHER_RUT = "OTHER_RUT"

W_AMOUNT = 40
W_DAY = 25
W_RUT = 20
W_TYPE = 15
DAY_BASE = 15
DAY_STEP = 3
FOLIO_SCORE = 100

LABELS = {
    OTHER_AMOUNT: "Otro monto",
    OTHER_DAY: "Otro día",
    OTHER_RUT: "Otro RUT",
    TYPE_INCOMPATIBLE: "Tipo distinto",
    OTHER_DIRECTION: "Otra dirección",
    NOT_COMPLETED: "Venta anulada",
}
CASH_ONLY_BOLETAS_LABEL = "Efectivo solo en boletas"


@dataclass(frozen=True)
class Reference:
    """Lo que se compara: el documento del grupo o, en un huérfano, su primer registro externo."""

    direction: str
    sii_code: int | None
    date: date | None
    rut: str
    amount: Decimal | None
    free_payment_amounts: frozenset[Decimal]
    folio: int | None
    kind: Kind = "erp"
    payment_type: str | None = None  # solo en una referencia TUU (efectivo)


@dataclass(frozen=True)
class CandidateFacts:
    kind: Kind
    direction: str
    sii_code: int | None
    date: date | None
    rut: str | None
    amount: Decimal | None
    folio: int | None
    payment_type: str | None = None
    status: str | None = None
    tuu_document_type: int | None = None  # tipo que informa TUU (solo kind="tuu")


@dataclass(frozen=True)
class MatchWarning:
    """Advertencia de un candidato. (Se llama ``MatchWarning`` para no tapar el builtin ``Warning``.)"""

    code: str
    label: str
    blocking: bool


@dataclass
class _Parts:
    score: int = 0
    warnings: list[MatchWarning] = field(default_factory=list)

    def warn(self, code: str, blocking: bool, label: str | None = None) -> None:
        self.warnings.append(MatchWarning(code, label or LABELS[code], blocking))


def reference_for(
    group,
    *,
    kind: Kind,
    sale=None,
    rcv=None,
    folio: int | None = None,
    free_payment_amounts: frozenset[Decimal] = frozenset(),
) -> Reference:
    """Referencia del grupo. Firma (la consume la búsqueda):

    - ``kind="erp"``: el grupo tiene documento; se usan los campos denormalizados del grupo
      (``direction``, ``dte_type``, ``issue_date``, ``counterparty_rut``, ``erp_amount``) más
      ``folio`` y ``free_payment_amounts`` (montos de los pagos libres), que el llamador precarga.
    - ``kind="tuu"``: huérfano; ``sale`` es su primera venta TUU.
    - ``kind="rcv"``: huérfano sin ventas; ``rcv`` es su primer registro del SII.
    """
    if kind == "tuu":
        return Reference(
            direction=group.direction,
            sii_code=sale.document_type,
            date=timezone.localtime(sale.transaction_at).date(),
            rut="",
            amount=sale.sale_amount,
            free_payment_amounts=frozenset(),
            folio=None,
            kind="tuu",
            payment_type=sale.payment_type,
        )
    if kind == "rcv":
        return Reference(
            direction=group.direction,
            sii_code=rcv.dte_type,
            date=rcv.issue_date,
            rut=normalize_rut(rcv.counterparty_rut),
            amount=rcv.total_amount,
            free_payment_amounts=frozenset(),
            folio=rcv.folio,
            kind="rcv",
        )
    return Reference(
        direction=group.direction,
        sii_code=group.dte_type,
        date=group.issue_date,
        rut=normalize_rut(group.counterparty_rut),
        amount=group.erp_amount,
        free_payment_amounts=free_payment_amounts,
        folio=folio,
        kind="erp",
    )


def _type_warning(ref: Reference, cand: CandidateFacts) -> tuple[str, str] | None:
    """(código, etiqueta) si el tipo no es compatible; reutiliza los predicados de la unión manual."""
    if cand.kind == "tuu" or ref.kind == "tuu":
        if cand.kind == "tuu":
            sale = TerminalSale(
                payment_type=cand.payment_type, document_type=cand.tuu_document_type
            )
            code = ref.sii_code
        else:
            sale = TerminalSale(payment_type=ref.payment_type, document_type=ref.sii_code)
            code = cand.sii_code
        if not tuu_type_fits(sale, code):
            return TYPE_INCOMPATIBLE, LABELS[TYPE_INCOMPATIBLE]
        if not cash_sale_fits(sale, code):
            return TYPE_INCOMPATIBLE, CASH_ONLY_BOLETAS_LABEL
        return None
    if ref.sii_code is not None and cand.sii_code is not None and ref.sii_code != cand.sii_code:
        return TYPE_INCOMPATIBLE, LABELS[TYPE_INCOMPATIBLE]
    return None


def _day_points(ref_day: date | None, cand_day: date | None) -> int:
    if ref_day is None or cand_day is None:
        return 0
    days = abs((ref_day - cand_day).days)
    return W_DAY if days == 0 else max(0, DAY_BASE - DAY_STEP * days)


def _rut_fits(ref: Reference, cand: CandidateFacts) -> bool:
    """TUU y boletas 39/41 no llevan RUT: suman el criterio completo."""
    cand_rut = normalize_rut(cand.rut)
    no_rut = (
        cand.kind == "tuu"
        or ref.kind == "tuu"
        or not cand_rut
        or not ref.rut
        or BOLETA_SII_CODES & {ref.sii_code, cand.sii_code}
    )
    return bool(no_rut) or cand_rut == ref.rut


def score_candidate(ref: Reference, cand: CandidateFacts) -> tuple[int, list[MatchWarning]]:
    """Puntaje 0–100 y advertencias (bloqueantes o no) del candidato frente a la referencia."""
    out = _Parts()
    direction_ok = cand.direction == ref.direction
    if not direction_ok:
        out.warn(OTHER_DIRECTION, True)
    if cand.kind == "tuu" and cand.status != TerminalSale.Status.COMPLETED:
        out.warn(NOT_COMPLETED, True)

    type_issue = _type_warning(ref, cand)
    if type_issue:
        out.warn(type_issue[0], True, type_issue[1])
    else:
        out.score += W_TYPE

    targets = (
        ref.free_payment_amounts
        if cand.kind == "tuu" and ref.free_payment_amounts
        else {ref.amount}
    )
    if cand.amount is not None and cand.amount in targets:
        out.score += W_AMOUNT
    else:
        out.warn(OTHER_AMOUNT, False)

    day_points = _day_points(ref.date, cand.date)
    out.score += day_points
    if day_points != W_DAY:
        out.warn(OTHER_DAY, False)

    if _rut_fits(ref, cand):
        out.score += W_RUT
    else:
        out.warn(OTHER_RUT, False)

    same_folio = ref.folio is not None and ref.folio == cand.folio
    if same_folio and direction_ok and type_issue is None:
        return FOLIO_SCORE, out.warnings
    return min(out.score, FOLIO_SCORE), out.warnings
