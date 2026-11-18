"""``GET /api/tax/fiscal-matches/{id}/search/``: candidatos «sin cuadrar» con puntaje (spec §5.2)."""

import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from accounting.models import RCVDocument, RCVImport
from billing.models import Invoice
from core.fiscal_match import FiscalMatchStatus
from core.tests.rbac_factories import make_user
from tax.fiscal_match.groups import ensure_groups, tuu_orphan_group
from tax.fiscal_match.search import group_reference
from tax.fiscal_match.services import link_rcv_document
from tax.models import FiscalMatch
from tax.tests.fiscal_match_helpers import (
    local_dt,
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
    set_match_settings,
)
from treasury.models import TerminalSale, TreasuryMovement

pytestmark = pytest.mark.django_db

BASE = "/api/tax/fiscal-matches"


def _today():
    return timezone.localdate()


def _at(days_ago: int = 0, hour: int = 10):
    d = _today() - timedelta(days=days_ago)
    return local_dt(d.year, d.month, d.day, hour)


@pytest.fixture
def tenv(db):
    set_match_settings(_today() - timedelta(days=90), window=15)
    return make_terminal_env()


@pytest.fixture
def api():
    c = APIClient()
    c.force_authenticate(user=make_user(f"fm-{uuid.uuid4().hex[:8]}", "tax.view_taxperiod"))
    return c


def _groups():
    ensure_groups(_today() - timedelta(days=90))


def _group_of(record) -> FiscalMatch:
    if isinstance(record, Invoice):
        return FiscalMatch.objects.get(invoice=record)
    return type(record).objects.get(pk=record.pk).fiscal_match


def _search(api, group, part, **params) -> dict:
    r = api.get(f"{BASE}/{group.id}/search/", {"part": part, **params})
    assert r.status_code == 200, r.content
    return r.json()


def _ids(body) -> list[int]:
    return [item["id"] for item in body["results"]]


def _rcv(day, total, folio, *, dte_type=39, rut="66666666-6", name="", missing=False):
    imp = RCVImport.objects.create(
        direction=RCVImport.Direction.SALES,
        year=day.year,
        month=day.month,
        trigger=RCVImport.Trigger.MANUAL,
        status=RCVImport.Status.SUCCESS,
    )
    return RCVDocument.objects.create(
        direction=RCVImport.Direction.SALES,
        company_rut="11111111-1",
        period=f"{day:%Y%m}",
        dte_type=dte_type,
        folio=folio,
        counterparty_rut=rut,
        counterparty_name=name,
        issue_date=day,
        total_amount=Decimal(total),
        first_import=imp,
        last_import=imp,
        missing_since_import=imp if missing else None,
    )


def _into(record, group: FiscalMatch):
    record.fiscal_match = group
    record.save(update_fields=["fiscal_match"])


# --- referencia --------------------------------------------------------------------------


def test_reference_kind_per_group(tenv):
    invoice = make_pos_document(tenv, 5000, _at())
    sale = make_terminal_sale(tenv, 7777, _at(hour=15))
    doc = _rcv(_today(), 1000, 900)
    _groups()

    assert group_reference(_group_of(invoice)).kind == "erp"
    assert group_reference(_group_of(sale)).kind == "tuu"
    assert group_reference(_group_of(doc)).kind == "rcv"


# --- universo por parte ----------------------------------------------------------------


def test_erp_universe_skips_settled_groups_and_documents_without_free_payment(api, tenv):
    sale = make_terminal_sale(tenv, 7777, _at(hour=15))
    open_doc = make_pos_document(tenv, 5000, _at())
    matched = make_pos_document(tenv, 6000, _at())
    with_tuu = make_pos_document(tenv, 8000, _at())
    taken = make_terminal_sale(
        tenv, 8000, _at(hour=11), matched_movement=TreasuryMovement.objects.get(invoice=with_tuu)
    )  # su único cobro ya está respaldado: no le queda cobro libre
    _groups()
    FiscalMatch.objects.filter(invoice=matched).update(status=FiscalMatchStatus.MATCHED)
    _into(TerminalSale.objects.get(pk=taken.pk), _group_of(with_tuu))

    body = _search(api, _group_of(sale), "erp")

    assert _ids(body) == [open_doc.id]
    item = body["results"][0]
    assert item["kind"] == "erp"
    assert item["label"] == open_doc.display_id
    assert item["payments_by_sale"] == {str(sale.id): []}  # el cobro es de otro monto


def test_erp_payments_by_sale_lists_free_payments_of_the_sale_amount(api, tenv):
    sale = make_terminal_sale(tenv, 5000, _at(hour=15))
    invoice = make_pos_document(tenv, 5000, _at())
    _groups()
    movement = TreasuryMovement.objects.get(invoice=invoice)

    item = _search(api, _group_of(sale), "erp")["results"][0]

    assert [m["id"] for m in item["payments_by_sale"][str(sale.id)]] == [movement.id]
    assert set(item) == {
        "id",
        "kind",
        "label",
        "counterparty",
        "date",
        "amount",
        "score",
        "warnings",
        "payments_by_sale",
    }


def test_erp_part_on_a_document_group_is_empty(api, tenv):
    invoice = make_pos_document(tenv, 5000, _at())
    make_pos_document(tenv, 5000, _at())
    _groups()

    assert _search(api, _group_of(invoice), "erp")["count"] == 0


def test_tuu_universe_only_completed_orphan_sales(api, tenv):
    invoice = make_pos_document(tenv, 5000, _at())
    orphan = make_terminal_sale(tenv, 5000, _at(hour=15))
    reversed_sale = make_terminal_sale(
        tenv, 5000, _at(hour=16), status=TerminalSale.Status.REVERSED
    )
    other_doc = make_pos_document(tenv, 6000, _at())
    linked = make_terminal_sale(tenv, 6000, _at(hour=11))
    _groups()
    holder = tuu_orphan_group(reversed_sale)
    holder.save()
    _into(reversed_sale, holder)
    _into(TerminalSale.objects.get(pk=linked.pk), _group_of(other_doc))
    movement = TreasuryMovement.objects.get(invoice=invoice)

    body = _search(api, _group_of(invoice), "tuu")

    assert _ids(body) == [orphan.id]
    item = body["results"][0]
    assert [m["id"] for m in item["compatible_movements"]] == [movement.id]
    assert item["datetime"] is not None
    assert (item["score"], item["warnings"]) == (100, [])  # mismo día, monto de un cobro libre


def test_rcv_universe_orphans_without_sales_and_not_missing(api, tenv):
    invoice = make_pos_document(tenv, 5000, _at())
    offered = _rcv(_today(), 5000, 101)
    _rcv(_today(), 5000, 102, missing=True)
    with_sale = _rcv(_today(), 5000, 103)
    sale = make_terminal_sale(tenv, 4444, _at(hour=15))
    _groups()
    _into(RCVDocument.objects.get(pk=with_sale.pk), _group_of(sale))

    body = _search(api, _group_of(invoice), "rcv")

    assert _ids(body) == [offered.id]


def test_orphan_tuu_and_rcv_parts_only_show_own_records(api, tenv):
    sale = make_terminal_sale(tenv, 7777, _at(hour=15))
    make_terminal_sale(tenv, 7777, _at(hour=18))
    _rcv(_today(), 7777, 104)
    make_pos_document(tenv, 7777, _at())
    _groups()
    group = _group_of(sale)

    assert _ids(_search(api, group, "tuu")) == [sale.id]
    assert _ids(_search(api, group, "rcv")) == []


# --- búsqueda ----------------------------------------------------------------------------


def test_q_by_number_name_and_amount_on_erp(api, tenv):
    sale = make_terminal_sale(tenv, 7777, _at(hour=15))
    numbered = make_pos_document(tenv, 1000, _at())
    Invoice.objects.filter(pk=numbered.pk).update(number="4321")
    named = make_pos_document(tenv, 2000, _at())
    Invoice.objects.filter(pk=named.pk).update(partner_name_snapshot="Imprenta Sur")
    priced = make_pos_document(tenv, 3500, _at())
    _groups()
    group = _group_of(sale)

    assert _ids(_search(api, group, "erp", q="4321")) == [numbered.id]
    assert _ids(_search(api, group, "erp", q="sur")) == [named.id]
    assert _ids(_search(api, group, "erp", q="$3.500")) == [priced.id]


def test_q_by_folio_rut_and_name_on_rcv(api, tenv):
    invoice = make_pos_document(tenv, 5000, _at())
    by_folio = _rcv(_today(), 1000, 555)
    by_rut = _rcv(_today(), 1000, 556, rut="77.777.777-7")
    by_name = _rcv(_today(), 1000, 557, name="Librería Norte")
    _groups()
    group = _group_of(invoice)

    assert _ids(_search(api, group, "rcv", q="555")) == [by_folio.id]
    assert _ids(_search(api, group, "rcv", q="77777777-7")) == [by_rut.id]
    assert _ids(_search(api, group, "rcv", q="norte")) == [by_name.id]


def test_q_by_device_name_on_tuu(api, tenv):
    invoice = make_pos_document(tenv, 5000, _at())
    other = make_terminal_env()
    other.device.name = "Mesón segundo piso"
    other.device.save(update_fields=["name"])
    make_terminal_sale(tenv, 5000, _at(hour=15))
    wanted = make_terminal_sale(other, 5000, _at(hour=16))
    _groups()

    body = _search(api, _group_of(invoice), "tuu", q="segundo")

    assert _ids(body) == [wanted.id]
    assert body["results"][0]["counterparty"] == "Mesón segundo piso"


# --- orden y límites ---------------------------------------------------------------------


def test_ordering_by_score_then_recent(api, tenv):
    sale = make_terminal_sale(tenv, 7777, _at(hour=15))
    other_amount = make_pos_document(tenv, 1234, _at())  # 15 + 0 + 25 + 20 = 60
    three_days = make_pos_document(tenv, 7777, _at(days_ago=3))  # 15 + 40 + 6 + 20 = 81
    best = make_pos_document(tenv, 7777, _at())  # 100
    _groups()
    group = _group_of(sale)

    body = _search(api, group, "erp")
    assert _ids(body) == [best.id, three_days.id, other_amount.id]
    assert [i["score"] for i in body["results"]] == [100, 81, 60]
    assert _ids(_search(api, group, "erp", ordering="recent")) == [
        best.id,
        other_amount.id,
        three_days.id,
    ]


def test_without_q_erp_universe_is_limited_to_scan_days(api, tenv):
    sale = make_terminal_sale(tenv, 7777, _at(hour=15))
    recent = make_pos_document(tenv, 7777, _at(days_ago=10))
    old = make_pos_document(tenv, 7777, _at(days_ago=70))
    Invoice.objects.filter(pk=old.pk).update(number="9876")
    _groups()
    group = _group_of(sale)

    assert _ids(_search(api, group, "erp")) == [recent.id]
    assert _ids(_search(api, group, "erp", q="9876")) == [old.id]


def test_bad_params_are_400(api, tenv):
    sale = make_terminal_sale(tenv, 7777, _at(hour=15))
    _groups()
    r = api.get(f"{BASE}/{_group_of(sale).id}/search/", {"part": "nope"})
    assert r.status_code == 400


def test_requires_view_permission(tenv):
    sale = make_terminal_sale(tenv, 7777, _at(hour=15))
    _groups()
    c = APIClient()
    c.force_authenticate(user=make_user(f"fm-{uuid.uuid4().hex[:8]}"))
    r = c.get(f"{BASE}/{_group_of(sale).id}/search/", {"part": "erp"})
    assert r.status_code == 403


# --- consultas y advertencias ------------------------------------------------------------


def _queries(api, group, part) -> int:
    _search(api, group, part)  # calienta los cachés de sesión y permisos
    with CaptureQueriesContext(connection) as ctx:
        _search(api, group, part)
    return len(ctx.captured_queries)


@pytest.mark.parametrize("part", ["erp", "tuu", "rcv"])
def test_constant_queries_with_3_and_25_rows(api, tenv, part):
    def build(n: int) -> FiscalMatch:
        FiscalMatch.objects.all().delete()
        anchor_sale = make_terminal_sale(tenv, 9999, _at(hour=20))
        anchor_doc = make_pos_document(tenv, 9999, _at())
        for i in range(n):
            if part == "erp" and i % 2:  # borrador POS sin folio ni ficha: el cliente de la venta
                make_pos_document(
                    tenv,
                    1000 + i,
                    _at(),
                    dte_type=Invoice.DTEType.BOLETA,
                    status=Invoice.Status.DRAFT,
                )
            elif part == "erp":
                make_pos_document(tenv, 1000 + i, _at())
            elif part == "tuu":
                make_terminal_sale(tenv, 9999, _at(hour=21, days_ago=i % 5))
            else:
                _rcv(_today(), 1000 + i, 1000 * n + i)
        _groups()
        return _group_of(anchor_sale) if part == "erp" else _group_of(anchor_doc)

    small_group = build(3)
    small = _queries(api, small_group, part)
    assert _search(api, small_group, part)["count"] >= 3
    large_group = build(25)
    large = _queries(api, large_group, part)
    assert _search(api, large_group, part)["count"] >= 20  # página llena
    assert small == large


def test_cash_sale_toward_an_invoice_is_blocking(api, tenv):
    sale = make_terminal_sale(
        tenv, 7777, _at(hour=15), payment_type=TerminalSale.PaymentType.CASH, document_type=None
    )
    factura = make_pos_document(tenv, 7777, _at(), dte_type=Invoice.DTEType.FACTURA)
    _groups()

    item = _search(api, _group_of(sale), "erp")["results"][0]

    assert item["id"] == factura.id
    assert {
        "code": "TYPE_INCOMPATIBLE",
        "label": "Efectivo solo en boletas",
        "blocking": True,
    } in item["warnings"]


# --- acumulación (Ruling G) -------------------------------------------------------------


def test_erp_document_with_two_card_payments_and_one_sale_is_still_offered(api, tenv):
    sale = make_terminal_sale(tenv, 3000, _at(hour=15))
    invoice = make_pos_document(tenv, 5000, _at())
    first = TreasuryMovement.objects.get(invoice=invoice)
    TreasuryMovement.objects.filter(pk=first.pk).update(amount=2000)
    second = TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND,
        payment_method="CARD",
        payment_method_new=tenv.card,
        amount=3000,
        created_by=tenv.user,
        contact=tenv.customer,
        to_account=tenv.cash_account,
        invoice=invoice,
        sale_order=invoice.sale_order,
        pos_session=tenv.session,
        date=invoice.date,
    )
    linked = make_terminal_sale(tenv, 2000, _at(hour=11), matched_movement=first)
    fully_paid = make_pos_document(tenv, 3000, _at())
    covering = make_terminal_sale(
        tenv,
        3000,
        _at(hour=11),
        matched_movement=TreasuryMovement.objects.get(invoice=fully_paid),
    )
    _groups()
    _into(TerminalSale.objects.get(pk=linked.pk), _group_of(invoice))
    _into(TerminalSale.objects.get(pk=covering.pk), _group_of(fully_paid))

    item = _search(api, _group_of(sale), "erp")["results"]

    assert [i["id"] for i in item] == [invoice.id]  # el pagado por completo no se ofrece
    assert [m["id"] for m in item[0]["payments_by_sale"][str(sale.id)]] == [second.id]
    assert item[0]["score"] == 100  # la venta calza con un cobro libre, no con el total


def test_erp_boleta_with_rcv_still_offered_and_factura_with_rcv_not(api, tenv):
    orphan_doc = _rcv(_today(), 5000, 301, dte_type=39)
    boleta = make_pos_document(tenv, 5000, _at(), dte_type=Invoice.DTEType.BOLETA)
    factura = make_pos_document(tenv, 5000, _at(), dte_type=Invoice.DTEType.FACTURA)
    free_factura = make_pos_document(tenv, 5000, _at(), dte_type=Invoice.DTEType.FACTURA)
    held_boleta = _rcv(_today(), 5000, 302, dte_type=39)
    held_factura = _rcv(_today(), 5000, 303, dte_type=33)
    _groups()
    _into(RCVDocument.objects.get(pk=held_boleta.pk), _group_of(boleta))
    _into(RCVDocument.objects.get(pk=held_factura.pk), _group_of(factura))

    ids = _ids(_search(api, _group_of(orphan_doc), "erp"))

    assert boleta.id in ids
    assert free_factura.id in ids
    assert factura.id not in ids


# --- revisión 1 ------------------------------------------------------------------------


def test_excluded_rcv_orphan_is_not_offered(api, tenv):
    invoice = make_pos_document(tenv, 5000, _at())
    offered = _rcv(_today(), 5000, 401)
    excluded = _rcv(_today(), 5000, 402, dte_type=46)
    _groups()
    FiscalMatch.objects.filter(pk=_group_of(excluded).pk).update(
        status=FiscalMatchStatus.EXCLUDED  # como deja el motor a un código 46
    )

    assert _ids(_search(api, _group_of(invoice), "rcv")) == [offered.id]


def test_excluded_tuu_orphan_is_not_offered_even_with_q(api, tenv):
    invoice = make_pos_document(tenv, 5000, _at())
    before_start = make_terminal_sale(tenv, 5000, _at(days_ago=85, hour=15))
    _groups()
    FiscalMatch.objects.filter(pk=_group_of(before_start).pk).update(
        status=FiscalMatchStatus.EXCLUDED  # anterior al inicio del cuadre
    )

    assert _ids(_search(api, _group_of(invoice), "tuu", q="5000")) == []


def test_erp_folio_matches_number_with_leading_zeros(api, tenv):
    doc = _rcv(_today(), 5000, 42, dte_type=33)
    numbered = make_pos_document(tenv, 5000, _at(), dte_type=Invoice.DTEType.FACTURA)
    Invoice.objects.filter(pk=numbered.pk).update(number="0042")
    make_pos_document(tenv, 5000, _at(), dte_type=Invoice.DTEType.FACTURA)
    _groups()

    body = _search(api, _group_of(doc), "erp")

    assert body["results"][0]["id"] == numbered.id
    assert body["results"][0]["score"] == 100


def test_erp_q_by_sale_order_customer_name(api, tenv):
    sale = make_terminal_sale(tenv, 7777, _at(hour=15))
    other = make_terminal_env()
    other.customer.name = "Gráfica Andina"
    other.customer.save(update_fields=["name"])
    draft = make_pos_document(
        other, 1000, _at(), dte_type=Invoice.DTEType.BOLETA, status=Invoice.Status.DRAFT
    )
    Invoice.objects.filter(pk=draft.pk).update(contact=None)
    make_pos_document(tenv, 1000, _at())
    _groups()

    body = _search(api, _group_of(sale), "erp", q="andina")

    assert _ids(body) == [draft.id]
    assert body["results"][0]["counterparty"] == "Gráfica Andina"


def test_rcv_on_a_factura_with_rcv_is_blocking_second_rcv(api, tenv):
    factura = make_pos_document(tenv, 5000, _at(), dte_type=Invoice.DTEType.FACTURA)
    boleta = make_pos_document(tenv, 5000, _at(), dte_type=Invoice.DTEType.BOLETA)
    held_factura = _rcv(_today(), 5000, 501, dte_type=33)
    held_boleta = _rcv(_today(), 5000, 502, dte_type=39)
    candidate = _rcv(_today(), 5000, 503, dte_type=33)
    _groups()
    _into(RCVDocument.objects.get(pk=held_factura.pk), _group_of(factura))
    _into(RCVDocument.objects.get(pk=held_boleta.pk), _group_of(boleta))

    def second_rcv(group):
        item = next(i for i in _search(api, group, "rcv")["results"] if i["id"] == candidate.id)
        return [w for w in item["warnings"] if w["code"] == "SECOND_RCV"]

    assert second_rcv(_group_of(factura)) == [
        {"code": "SECOND_RCV", "label": "Ya tiene registro del SII", "blocking": True}
    ]
    assert second_rcv(_group_of(boleta)) == []


def test_rcv_orphan_with_only_a_reversed_sale_is_offered_and_links(api, tenv):
    invoice = make_pos_document(tenv, 5000, _at(), dte_type=Invoice.DTEType.BOLETA)
    doc = _rcv(_today(), 5000, 601)
    reversed_sale = make_terminal_sale(
        tenv, 5000, _at(hour=16), status=TerminalSale.Status.REVERSED
    )
    _groups()
    _into(reversed_sale, _group_of(doc))
    group = _group_of(invoice)

    assert _ids(_search(api, group, "rcv")) == [doc.id]
    link_rcv_document(group, RCVDocument.objects.get(pk=doc.pk))
    assert RCVDocument.objects.get(pk=doc.pk).fiscal_match_id == group.id


def test_page_size_cannot_be_raised(api, tenv):
    invoice = make_pos_document(tenv, 5000, _at())
    for i in range(25):
        _rcv(_today(), 1000 + i, 700 + i)
    _groups()

    body = _search(api, _group_of(invoice), "rcv", page_size=50)

    assert body["count"] == 25
    assert len(body["results"]) == 20


def test_tuu_item_announces_the_orphan_rcv_that_travels_with_it(api, tenv):
    invoice = make_pos_document(tenv, 6100, _at(), dte_type=Invoice.DTEType.BOLETA)
    sale = make_terminal_sale(tenv, 6100, _at(hour=16))
    doc = _rcv(_today(), 6100, 777)
    _groups()
    _into(doc, _group_of(sale))
    body = _search(api, _group_of(invoice), "tuu")
    item = next(i for i in body["results"] if i["id"] == sale.id)
    assert item["carried_rcv"] == [{"id": doc.id, "folio": "777"}]


def test_tuu_item_carries_nothing_when_the_document_already_has_rcv(api, tenv):
    invoice = make_pos_document(tenv, 6200, _at(), dte_type=Invoice.DTEType.BOLETA)
    sale = make_terminal_sale(tenv, 6200, _at(hour=16))
    own = _rcv(_today(), 6200, 801)
    other = _rcv(_today(), 6200, 802)
    _groups()
    _into(other, _group_of(sale))
    _into(own, _group_of(invoice))
    body = _search(api, _group_of(invoice), "tuu")
    item = next(i for i in body["results"] if i["id"] == sale.id)
    assert item["carried_rcv"] == []
