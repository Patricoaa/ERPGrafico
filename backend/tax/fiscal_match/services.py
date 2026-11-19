"""Unión manual del cuadre: vincular, quitar, guardar la ficha y devolver al cruce automático.

Cada acción bloquea los grupos que toca, mueve los registros, borra el huérfano que
queda vacío y re-deriva en el acto el estado de los grupos tocados. Un registro que
se quita queda en un grupo huérfano marcado como manual: el motor no vuelve a crear
el mismo par en la corrida siguiente hasta que el usuario lo devuelve (``release``).

``apply_changes`` guarda de una vez los cambios en espera de la ficha en columnas
(spec §5.3): todo o nada, con el índice del cambio que rompe una regla.
"""

from collections.abc import Callable, Collection, Iterator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass, field
from decimal import Decimal
from functools import wraps
from typing import Literal, NotRequired, ParamSpec, TypedDict, TypeVar

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from accounting.models import RCVDocument
from billing.models import Invoice
from core.exceptions import ERPGraficoError
from core.fiscal_match import FiscalMatchStatus
from tax.fiscal_match.candidates import (
    BOLETA_SII_CODES,
    cash_sale_fits,
    inbound_movements,
    payment_type_fits,
    sii_type_fits,
    stamp_groups,
    taken_movements,
    tuu_type_fits,
)
from tax.fiscal_match.codes import (  # se re-exportan: los importan las pruebas y otros módulos
    DUPLICATE_CHANGE,
    GONE,
    IGNORED_PAYMENT,
    MOVED,
    NOT_ALLOWED,
    NOT_COMPLETED,
    NOT_FOUND,
    OTHER_DIRECTION,
    OTHER_DOCUMENT_PAYMENT,
    PAYMENT_REQUIRED,
    PAYMENT_TAKEN,
    RCV_HAS_SALES,
    SECOND_DOCUMENT,
    SECOND_RCV,
    TYPE_INCOMPATIBLE,
)
from tax.fiscal_match.groups import (
    group_for_invoice,
    rcv_orphan_group,
    tuu_orphan_group,
)
from tax.fiscal_match.issuing import issue_fiscal_drafts
from tax.fiscal_match.rcv import RCV_TO_FISCAL_DIRECTION
from tax.fiscal_match.selectors import SETTLED
from tax.fiscal_match.states import STATE_FIELDS, build_context, evaluate
from tax.models import FiscalMatch
from tax.tasks import fiscal_match_lock
from treasury.models import TerminalSale, TreasuryMovement

MANUAL_LOCK_TIMEOUT = 60  # s: una acción manual dura segundos; si se cae, el candado expira pronto
BUSY_MESSAGE = "El cuadre automático se está ejecutando. Reintente en unos segundos."
NOTHING_TO_ISSUE = "No hay nada para emitir en este grupo."

# Mensajes de las reglas (los códigos viven en ``codes``).
RULE_MESSAGES = {
    TYPE_INCOMPATIBLE: "El registro es de otro tipo de documento.",
    OTHER_DIRECTION: "El registro es de otra dirección (compra/venta).",
    PAYMENT_TAKEN: "El pago ya está respaldado por otra venta TUU.",
    SECOND_DOCUMENT: "El registro ya está vinculado a un documento del ERP.",
    SECOND_RCV: "El documento ya tiene un registro del SII; quítelo antes de unir otro.",
    NOT_COMPLETED: "La venta TUU no está completada.",
    MOVED: "El registro cambió de grupo mientras tanto; actualice la ficha y reintente.",
    PAYMENT_REQUIRED: "Indique el pago del documento al que corresponde la venta TUU.",
    NOT_ALLOWED: "La acción no está permitida en este grupo.",
    OTHER_DOCUMENT_PAYMENT: "El pago no es un cobro del documento del grupo.",
    GONE: "El grupo de cuadre ya no existe; actualice la ficha.",
    NOT_FOUND: "El registro no existe.",
    IGNORED_PAYMENT: "El pago indicado solo aplica al vincular una venta TUU.",
    RCV_HAS_SALES: "El registro del SII está unido a una venta TUU; vincule la venta.",
    DUPLICATE_CHANGE: "El cambio está repetido en el guardado.",
}
CASH_ONLY_BOLETAS = "Una venta TUU en efectivo solo respalda boletas 39/41."
CASH_ONLY_CASH = "Una venta TUU en efectivo solo respalda un cobro en efectivo."
ERP_STAYS = "El documento ERP no se quita del cuadre"
NO_DOCUMENT = "El grupo no tiene un documento del ERP."
NOT_IN_MATCH = "El documento no entra al cuadre."
SETTLED_GROUP = "El grupo está cuadrado o excluido: no admite esta unión."
EXCLUDED_GROUP = "El cuadre está excluido: no admite cambios."

P = ParamSpec("P")
R = TypeVar("R")

LinkPart = Literal["erp", "tuu", "rcv"]
Record = TerminalSale | RCVDocument


class Change(TypedDict):
    """Un cambio en espera de la ficha (spec §5.3). ``payments``: ``{sale_id: movement_id}``."""

    op: Literal["link", "unlink"]
    part: LinkPart
    id: int
    movement: NotRequired[int | None]
    payments: NotRequired[dict[int, int] | None]


# --- utilidades ---------------------------------------------------------------


class FiscalMatchRuleError(ValidationError, ERPGraficoError):
    """Una unión manual rompe una regla del cuadre (400 con ``error.code``; spec §7c).

    ``change_index`` es el índice, en la lista enviada, del cambio de ``apply_changes``
    que la rompió (``None`` fuera de ese guardado).
    """

    def __init__(
        self, code: str, message: str | None = None, *, change_index: int | None = None
    ) -> None:
        text = message or RULE_MESSAGES[code]
        ValidationError.__init__(self, text, code=code)
        # Para el manejador global (400 con ``error.code`` y ``error.details.change_index``).
        self.details = {} if change_index is None else {"change_index": change_index}
        self.status_code = 400
        self.timestamp = timezone.now()
        self.change_index = change_index

    def at(self, index: int) -> "FiscalMatchRuleError":
        return FiscalMatchRuleError(self.code, self.message, change_index=index)


class FiscalMatchBusy(ERPGraficoError):
    """El motor tiene el candado del cuadre: la acción manual no espera (409)."""

    def __init__(self) -> None:
        super().__init__(BUSY_MESSAGE, code="FISCAL_MATCH_BUSY", status_code=409)


def _exclusive(fn: Callable[P, R]) -> Callable[P, R]:
    """Corre la acción con el candado del motor y en una transacción; sin candado, 409.

    El motor lee y reescribe ventas y registros sin bloqueo de filas: sin el candado,
    una unión manual confirmada a mitad de corrida podría pisarse o hacerla fallar.
    """

    @wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        with fiscal_match_lock(MANUAL_LOCK_TIMEOUT) as acquired:
            if not acquired:
                raise FiscalMatchBusy()
            with transaction.atomic():
                return fn(*args, **kwargs)

    return wrapper


def _lock_groups(*group_ids: int | None) -> dict[int, FiscalMatch]:
    """Bloquea los grupos en orden ascendente de id (sin interbloqueos entre acciones)."""
    ids = sorted({i for i in group_ids if i is not None})
    return {
        g.pk: g for g in FiscalMatch.objects.select_for_update().filter(id__in=ids).order_by("id")
    }


def _locked(groups: dict[int, FiscalMatch], group_id: int) -> FiscalMatch:
    group = groups.get(group_id)
    if group is None:
        raise FiscalMatchRuleError(GONE)
    return group


def _lock_record(model: type[TerminalSale] | type[RCVDocument], record: Record) -> Record:
    """Relee el registro bloqueado; error si dejó el grupo en que se leyó."""
    fresh = model.objects.select_for_update().filter(pk=record.pk).first()
    if (
        fresh is None
        or fresh.fiscal_match_id is None
        or fresh.fiscal_match_id != record.fiscal_match_id
    ):
        raise FiscalMatchRuleError(MOVED)
    return fresh


def _get(model: type[models.Model], pk: int, label: str):
    obj = model.objects.filter(pk=pk).first()
    if obj is None:
        raise FiscalMatchRuleError(NOT_FOUND, f"{label} no existe.")
    return obj


def _rederive(group_ids: set[int]) -> None:
    """Deriva y guarda el estado de los grupos que aún existen, y marca su ``updated_at``."""
    groups = list(FiscalMatch.objects.filter(id__in=group_ids).order_by("id"))
    if groups:
        evaluate(groups, build_context(groups))
        FiscalMatch.objects.bulk_update(groups, STATE_FIELDS)
    stamp_groups({g.id for g in groups})


def _drop_empty(group_ids: set[int]) -> None:
    FiscalMatch.objects.filter(
        id__in=group_ids,
        invoice__isnull=True,
        terminal_sales__isnull=True,
        rcv_documents__isnull=True,
    ).delete()


def _fresh(group_id: int) -> FiscalMatch:
    return FiscalMatch.objects.get(pk=group_id)


def _finish(touched: set[int], *result_ids: int) -> FiscalMatch:
    """Borra los huérfanos vacíos, re-deriva y devuelve el primero de ``result_ids`` que sigue."""
    _drop_empty(touched)
    _rederive(touched)
    found = FiscalMatch.objects.in_bulk(list(result_ids))
    for i in result_ids:
        if i in found:
            return found[i]
    raise FiscalMatchRuleError(GONE)


def _require_invoice_group(group: FiscalMatch) -> Invoice:
    if group.invoice_id is None:
        raise FiscalMatchRuleError(NOT_ALLOWED, NO_DOCUMENT)
    return group.invoice


def _require_orphan(group: FiscalMatch) -> None:
    if group.invoice_id is not None:
        raise FiscalMatchRuleError(SECOND_DOCUMENT, "El grupo ya tiene un documento del ERP.")


def _require_record_orphan(orphan: FiscalMatch) -> None:
    if orphan.invoice_id is not None:
        raise FiscalMatchRuleError(SECOND_DOCUMENT)


def _target_of(invoice: Invoice) -> FiscalMatch:
    target = group_for_invoice(invoice)
    if target is None:
        raise FiscalMatchRuleError(NOT_ALLOWED, NOT_IN_MATCH)
    return target


def _check_direction(target: FiscalMatch, direction: str) -> None:
    if direction != target.direction:
        raise FiscalMatchRuleError(OTHER_DIRECTION)


def _check_sale(target: FiscalMatch, invoice: Invoice, sale: TerminalSale) -> None:
    """Venta TUU ↔ documento: dirección, venta completada y tipo (incluye el efectivo)."""
    _check_direction(target, FiscalMatch.Direction.SALE)
    if sale.status != TerminalSale.Status.COMPLETED:
        raise FiscalMatchRuleError(NOT_COMPLETED)
    if not tuu_type_fits(sale, invoice.sii_code):
        raise FiscalMatchRuleError(TYPE_INCOMPATIBLE)
    if not cash_sale_fits(sale, invoice.sii_code):
        raise FiscalMatchRuleError(TYPE_INCOMPATIBLE, CASH_ONLY_BOLETAS)


def _check_payment(sale: TerminalSale, movement: TreasuryMovement, invoice: Invoice) -> None:
    """Cobro ↔ venta TUU, sin consultar: cobro del documento y de un medio compatible.

    El monto distinto no bloquea: la parte TUU queda con advertencia (spec §7c).
    """
    if movement.invoice_id != invoice.pk or movement.movement_type != TreasuryMovement.Type.INBOUND:
        raise FiscalMatchRuleError(OTHER_DOCUMENT_PAYMENT)
    if not payment_type_fits(sale, movement):
        raise FiscalMatchRuleError(TYPE_INCOMPATIBLE, CASH_ONLY_CASH)


def _check_movement(sale: TerminalSale, movement: TreasuryMovement, invoice: Invoice) -> None:
    _check_payment(sale, movement, invoice)
    if taken_movements([movement.pk], excluding=[sale.pk]):
        raise FiscalMatchRuleError(PAYMENT_TAKEN)


def _check_rcv(group: FiscalMatch, invoice: Invoice, doc: RCVDocument) -> None:
    """RCV ↔ documento: misma dirección y mismo tipo. El RUT distinto no bloquea: el grupo
    queda con advertencias (spec §7c)."""
    _check_direction(group, RCV_TO_FISCAL_DIRECTION[doc.direction])
    if not sii_type_fits(doc.dte_type, invoice.sii_code):
        raise FiscalMatchRuleError(
            TYPE_INCOMPATIBLE, "El registro del SII es de otro tipo de documento."
        )


def _check_rcv_room(invoice: Invoice, incoming: int, *, group: FiscalMatch) -> None:
    """Facturas y notas llevan un solo registro del SII por grupo; las boletas se acumulan."""
    if invoice.sii_code in BOLETA_SII_CODES or not incoming:
        return
    present = RCVDocument.objects.filter(fiscal_match=group).count()
    if present + incoming > 1:
        raise FiscalMatchRuleError(SECOND_RCV)


# --- vincular -------------------------------------------------------------------
#
# Las variantes ``_link_*`` y ``_unlink`` reciben grupos y registros ya bloqueados, no
# abren transacción ni re-derivan: las orquesta ``apply_changes`` (única vía de escritura).


def _link_invoice(
    orphan: FiscalMatch,
    target: FiscalMatch,
    invoice: Invoice,
    *,
    payments: Mapping[int, TreasuryMovement] | None = None,
    reserved: Collection[int] = (),
) -> None:
    """Pasa los registros del huérfano al grupo del documento.

    Las ventas anuladas no se unen: quedan en el huérfano y el motor las libera.
    """
    _require_orphan(orphan)
    _check_direction(target, orphan.direction)

    held = list(
        TerminalSale.objects.select_for_update()
        .filter(fiscal_match=orphan)
        .order_by("transaction_at", "id")
    )
    sales = [s for s in held if s.status != TerminalSale.Status.REVERSED]
    docs = list(RCVDocument.objects.select_for_update().filter(fiscal_match=orphan).order_by("id"))
    if held and not sales and not docs:
        raise FiscalMatchRuleError(NOT_COMPLETED)
    for sale in sales:
        _check_sale(target, invoice, sale)
    for doc in docs:
        _check_rcv(target, invoice, doc)
    _check_rcv_room(invoice, len(docs), group=target)
    _assign_payments(sales, invoice, payments or {}, reserved)
    if sales:
        for sale in sales:
            sale.fiscal_match, sale.linked_manually = target, True
        TerminalSale.objects.bulk_update(
            sales, ["fiscal_match", "matched_movement", "linked_manually"]
        )
    if docs:
        RCVDocument.objects.filter(id__in=[d.pk for d in docs]).update(fiscal_match=target)
        target.rcv_linked_manually = True
        target.save(update_fields=["rcv_linked_manually"])


def _assign_payments(
    sales: list[TerminalSale],
    invoice: Invoice,
    chosen: Mapping[int, TreasuryMovement],
    reserved: Collection[int] = (),
) -> None:
    """A cada venta su cobro del documento: el elegido (``{sale_id: cobro}``) o, sin elegir,
    el único libre del mismo monto y de un medio compatible; si no, ``PAYMENT_REQUIRED``.
    ``reserved``: cobros que otro cambio del mismo guardado reclama; no se asignan solos."""
    if set(chosen) - {s.pk for s in sales}:
        raise FiscalMatchRuleError(IGNORED_PAYMENT)
    if not sales:
        return
    picked = {m.pk for m in chosen.values()}
    if len(picked) != len(chosen):
        raise FiscalMatchRuleError(PAYMENT_TAKEN)
    inbound = inbound_movements(invoice)
    taken = taken_movements([m.pk for m in inbound], excluding=[s.pk for s in sales])
    free = [m for m in inbound if m.pk not in taken and m.pk not in picked and m.pk not in reserved]
    for sale in sales:
        movement = chosen.get(sale.pk)
        if movement is not None:
            _check_payment(sale, movement, invoice)
            if movement.pk in taken:
                raise FiscalMatchRuleError(PAYMENT_TAKEN)
        else:
            fits = [
                m
                for m in free
                if Decimal(m.amount) == Decimal(sale.sale_amount) and payment_type_fits(sale, m)
            ]
            if len(fits) != 1:
                raise FiscalMatchRuleError(PAYMENT_REQUIRED)
            movement = fits[0]
            free.remove(movement)
        sale.matched_movement = movement


def _link_terminal_sale(
    group: FiscalMatch, orphan: FiscalMatch, sale: TerminalSale, movement: TreasuryMovement
) -> list[int]:
    """Mueve la venta al documento; devuelve los registros RCV que viajaron con ella."""
    invoice = _require_invoice_group(group)
    _require_record_orphan(orphan)
    _check_sale(group, invoice, sale)
    _check_movement(sale, movement, invoice)
    sale.fiscal_match, sale.matched_movement, sale.linked_manually = group, movement, True
    sale.save(update_fields=["fiscal_match", "matched_movement", "linked_manually"])
    return _carry_orphan_rcv(orphan, group, invoice)


def _carry_orphan_rcv(orphan: FiscalMatch, group: FiscalMatch, invoice: Invoice) -> list[int]:
    """Como el cruce automático: los registros RCV del huérfano acompañan a su venta si el
    documento aún no tiene registro del SII y cumplen las reglas; si no, quedan en el huérfano.
    Devuelve los ids de los que viajaron.
    """
    if RCVDocument.objects.filter(fiscal_match=group).exists():
        return []
    docs = list(RCVDocument.objects.select_for_update().filter(fiscal_match=orphan))
    if not rcv_would_travel(group, invoice, docs):
        return []
    if docs:
        RCVDocument.objects.filter(id__in=[d.pk for d in docs]).update(fiscal_match=group)
    return [d.pk for d in docs]


def rcv_would_travel(group: FiscalMatch, invoice: Invoice, docs: list[RCVDocument]) -> bool:
    """Regla de ``_carry_orphan_rcv`` para un documento sin registro del SII: todos los del
    huérfano cumplen las reglas y caben. La reutiliza la búsqueda para anunciar qué viaja."""
    try:
        for doc in docs:
            _check_rcv(group, invoice, doc)
        if invoice.sii_code not in BOLETA_SII_CODES and len(docs) > 1:
            raise FiscalMatchRuleError(SECOND_RCV)
    except FiscalMatchRuleError:
        return False
    return True


def _link_rcv_document(group: FiscalMatch, orphan: FiscalMatch, doc: RCVDocument) -> None:
    invoice = _require_invoice_group(group)
    _require_record_orphan(orphan)
    _check_rcv(group, invoice, doc)
    _check_rcv_room(invoice, 1, group=group)
    # Las ventas anuladas no retienen el registro: quedan atrás y el motor las libera.
    if TerminalSale.objects.filter(
        fiscal_match=orphan, status=TerminalSale.Status.COMPLETED
    ).exists():
        raise FiscalMatchRuleError(RCV_HAS_SALES)
    doc.fiscal_match = group
    doc.save(update_fields=["fiscal_match"])
    group.rcv_linked_manually = True
    group.save(update_fields=["rcv_linked_manually"])


# --- quitar y devolver ----------------------------------------------------------------


def _unlink(group: FiscalMatch, record: Record) -> FiscalMatch:
    """Saca el registro (ya bloqueado, del grupo) a un huérfano nuevo; lo devuelve."""
    if isinstance(record, TerminalSale):
        orphan = tuu_orphan_group(record)
        orphan.save()
        record.fiscal_match, record.matched_movement, record.linked_manually = orphan, None, True
        record.save(update_fields=["fiscal_match", "matched_movement", "linked_manually"])
        return orphan
    orphan = rcv_orphan_group(record)
    orphan.rcv_linked_manually = True
    orphan.save()
    record.fiscal_match = orphan
    record.save(update_fields=["fiscal_match"])
    if group.rcv_linked_manually and not RCVDocument.objects.filter(fiscal_match=group).exists():
        group.rcv_linked_manually = False
        group.save(update_fields=["rcv_linked_manually"])
    return orphan


# --- guardado de la ficha -------------------------------------------------------------


# Orden de aplicación (spec §7b): quitar, unir el documento y luego unir TUU y RCV.
_STEP = {"erp": 1, "tuu": 2, "rcv": 3}


@contextmanager
def _at(index: int) -> Iterator[None]:
    try:
        yield
    except FiscalMatchRuleError as error:
        raise error.at(index) from error


@dataclass
class _Batch:
    """Lo que leen los cambios, cargado en lote y con candado antes de aplicar ninguno."""

    groups: dict[int, FiscalMatch]
    sales: dict[int, TerminalSale]
    docs: dict[int, RCVDocument]
    invoices: dict[int, Invoice]
    targets: dict[int, int]  # id del documento → id de su grupo
    movements: dict[int, TreasuryMovement]
    reserved: set[int] = field(default_factory=set)  # cobros que reclaman los link tuu
    carried: set[int] = field(default_factory=set)  # RCV que viajaron con su venta TUU
    unlinked: list[int] = field(default_factory=list)  # huérfanos creados al quitar

    def record(self, change: Change) -> Record:
        return (self.sales if change["part"] == "tuu" else self.docs)[change["id"]]


def _check_shape(change: Change) -> None:
    op, part = change["op"], change["part"]
    if op not in ("link", "unlink") or part not in _STEP:
        raise FiscalMatchRuleError(NOT_ALLOWED)
    if op == "unlink" and part == "erp":
        raise FiscalMatchRuleError(NOT_ALLOWED, ERP_STAYS)
    is_tuu_link = op == "link" and part == "tuu"
    if is_tuu_link and change.get("movement") is None:
        raise FiscalMatchRuleError(PAYMENT_REQUIRED)
    if change.get("movement") is not None and not is_tuu_link:
        raise FiscalMatchRuleError(IGNORED_PAYMENT)
    if change.get("payments") and not (op == "link" and part == "erp"):
        raise FiscalMatchRuleError(IGNORED_PAYMENT)


def _movement_ids(change: Change) -> list[int]:
    ids = list((change.get("payments") or {}).values())
    return [change["movement"], *ids] if change.get("movement") is not None else ids


def _load(group: FiscalMatch, changes: list[Change]) -> _Batch:
    """Valida la forma, carga en lote y bloquea grupos (por id) y registros.

    Cada registro se relee con candado y debe seguir donde la ficha lo vio: los que se
    quitan, en el grupo; los que se unen, en otro huérfano. Si no, ``MOVED``.
    """
    seen_keys: set[tuple[str, int]] = set()
    for i, change in enumerate(changes):
        with _at(i):
            _check_shape(change)
            key = (change["part"], change["id"])
            if key in seen_keys:
                raise FiscalMatchRuleError(DUPLICATE_CHANGE)
            seen_keys.add(key)
    ids = {part: {c["id"] for c in changes if c["part"] == part} for part in _STEP}
    seen = {
        "tuu": TerminalSale.objects.in_bulk(ids["tuu"]),
        "rcv": RCVDocument.objects.in_bulk(ids["rcv"]),
        "erp": Invoice.objects.in_bulk(ids["erp"]),
    }
    movements = TreasuryMovement.objects.in_bulk({m for c in changes for m in _movement_ids(c)})
    targets: dict[int, int] = {}
    for i, change in enumerate(changes):
        with _at(i):
            if change["id"] not in seen[change["part"]]:
                raise FiscalMatchRuleError(NOT_FOUND)
            if any(m not in movements for m in _movement_ids(change)):
                raise FiscalMatchRuleError(NOT_FOUND, "El pago no existe.")
            if change["part"] == "erp":
                targets[change["id"]] = _target_of(seen["erp"][change["id"]]).pk
    records = [*seen["tuu"].values(), *seen["rcv"].values()]
    groups = _lock_groups(group.pk, *targets.values(), *(r.fiscal_match_id for r in records))
    _locked(groups, group.pk)
    batch = _Batch(
        groups=groups,
        sales=TerminalSale.objects.select_for_update().in_bulk(ids["tuu"]),
        docs=RCVDocument.objects.select_for_update().in_bulk(ids["rcv"]),
        invoices=seen["erp"],
        targets=targets,
        movements=movements,
        reserved={
            c["movement"]
            for c in changes
            if c["op"] == "link" and c["part"] == "tuu" and c.get("movement")
        },
    )
    for i, change in enumerate(changes):
        with _at(i):
            if change["part"] != "erp":
                _check_place(batch, group, change, seen[change["part"]][change["id"]])
            _check_open(batch, group, change)
    return batch


def _check_open(batch: _Batch, group: FiscalMatch, change: Change) -> None:
    """Un cuadre excluido no se edita; no se une desde ni hacia un grupo cuadrado o excluido
    (la búsqueda no los ofrece: el servidor lo exige igual)."""
    if batch.groups[group.pk].status == FiscalMatchStatus.EXCLUDED:
        raise FiscalMatchRuleError(NOT_ALLOWED, EXCLUDED_GROUP)
    if change["op"] != "link":
        return
    if change["part"] == "erp":
        other = batch.groups.get(batch.targets[change["id"]])
    else:
        other = batch.groups.get(batch.record(change).fiscal_match_id)
    if other is not None and other.pk != group.pk and other.status in SETTLED:
        raise FiscalMatchRuleError(NOT_ALLOWED, SETTLED_GROUP)


def _check_place(batch: _Batch, group: FiscalMatch, change: Change, seen: Record) -> None:
    where = batch.record(change).fiscal_match_id
    if where is None or where != seen.fiscal_match_id or where not in batch.groups:
        raise FiscalMatchRuleError(MOVED)
    if change["op"] == "unlink":
        if where != group.pk:
            raise FiscalMatchRuleError(MOVED)
    elif where == group.pk or batch.groups[where].invoice_id is not None:
        raise FiscalMatchRuleError(MOVED)


def _apply_one(batch: _Batch, current: FiscalMatch, change: Change) -> FiscalMatch:
    """Aplica un cambio sobre el grupo en curso; devuelve el grupo en curso tras aplicarlo."""
    if change["op"] == "unlink":
        record = batch.record(change)
        if record.fiscal_match_id != current.pk:
            raise FiscalMatchRuleError(MOVED)
        batch.unlinked.append(_unlink(current, record).pk)
        return current
    if change["part"] == "erp":
        invoice = batch.invoices[change["id"]]
        target = _locked(batch.groups, batch.targets[invoice.pk])
        payments = {
            int(sale_id): batch.movements[m]
            for sale_id, m in (change.get("payments") or {}).items()
        }
        _link_invoice(current, target, invoice, payments=payments, reserved=batch.reserved)
        target.invoice = invoice
        return target
    if change["part"] == "tuu":
        sale = batch.sales[change["id"]]
        movement = batch.movements[change["movement"]]
        orphan = batch.groups[sale.fiscal_match_id]
        batch.carried.update(_link_terminal_sale(current, orphan, sale, movement))
        return current
    doc = batch.docs[change["id"]]
    if doc.pk not in batch.carried:  # si viajó con su venta TUU, ya está en el grupo
        _link_rcv_document(current, batch.groups[doc.fiscal_match_id], doc)
    return current


@_exclusive
@transaction.atomic
def apply_changes(group: FiscalMatch, changes: list[Change]) -> FiscalMatch:
    """Aplica los cambios en espera de la ficha, todo o nada (spec §5.3, §7b).

    Primero los ``unlink``, luego ``link erp`` (el huérfano pasa al grupo del documento) y
    después ``link tuu`` y ``link rcv`` sobre el grupo resultante. Un ``FiscalMatchRuleError``
    en el cambio *i* revierte todo y sale con ``change_index=i``. Re-deriva una vez, al final,
    y devuelve el grupo resultante (otro id si un huérfano se unió a un documento).
    """
    batch = _load(group, changes)
    current = batch.groups[group.pk]
    order = sorted(
        range(len(changes)),
        key=lambda i: 0 if changes[i]["op"] == "unlink" else _STEP[changes[i]["part"]],
    )
    for i in order:
        with _at(i):
            current = _apply_one(batch, current, changes[i])
    touched = set(batch.groups) | set(batch.unlinked)
    return _finish(touched, current.pk, *reversed(batch.unlinked))


@_exclusive
@transaction.atomic
def release(group: FiscalMatch) -> FiscalMatch:
    """Devuelve un huérfano al cruce automático: borra sus marcas manuales."""
    group = _locked(_lock_groups(group.pk), group.pk)
    _require_orphan(group)
    TerminalSale.objects.filter(fiscal_match=group).update(
        linked_manually=False, updated_at=timezone.now()
    )
    group.rcv_linked_manually = False
    group.save(update_fields=["rcv_linked_manually"])
    _rederive({group.pk})
    return _fresh(group.pk)


@_exclusive
@transaction.atomic
def retry_issue(group: FiscalMatch) -> dict[str, int]:
    """Reintenta, sin esperar, la emisión del borrador del grupo (spec §5.5)."""
    group = _locked(_lock_groups(group.pk), group.pk)
    invoice = _require_invoice_group(group)
    if invoice.status != Invoice.Status.DRAFT or invoice.number:
        raise ValidationError("El documento no está pendiente de emisión.")
    result = issue_fiscal_drafts(group_ids=[group.pk], retry_failed=True)
    if not result["issued"] and not result["failed"]:
        raise ValidationError(NOTHING_TO_ISSUE)
    _rederive({group.pk})
    return result
