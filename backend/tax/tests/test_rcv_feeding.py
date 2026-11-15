"""El RCV completa borradores de compra y crea borradores desde OC (ADR-0138 D8)."""

import itertools
from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from accounting.models import Account, AccountingSettings, AccountType, RCVDocument, RCVImport
from billing.models import Invoice
from contacts.models import Contact
from core.fiscal_match import MatchStatus
from core.tests.rbac_factories import make_user
from purchasing.models import PurchaseOrder
from tax.reconciliation.feeding import (
    confirm_draft_from_rcv,
    create_draft_from_rcv,
    draft_suggestions,
    supplier_purchase_orders,
)

P = RCVImport.Direction.PURCHASES
S = RCVImport.Direction.SALES
BASE = "/api/tax/reconciliation/rcv-documents"
_seq = itertools.count(1)


@pytest.fixture
def accounts(db):
    def acc(code, name, kind):
        return Account.objects.create(code=code, name=name, account_type=kind)

    settings = AccountingSettings.get_solo()
    settings.default_payable_account = acc("2.1.01.815", "Proveedores", AccountType.LIABILITY)
    settings.default_tax_receivable_account = acc("1.1.06.815", "IVA Crédito", AccountType.ASSET)
    settings.stock_input_account = acc("2.1.09.815", "Mercadería por recibir", AccountType.LIABILITY)
    settings.save()


@pytest.fixture
def imp(db):
    return RCVImport.objects.create(
        direction=P, year=2026, month=10, trigger=RCVImport.Trigger.MANUAL, status=RCVImport.Status.SUCCESS
    )


@pytest.fixture
def supplier(db):
    return Contact.objects.create(name="Papelera Sur", tax_id="8.973.356-k")


@pytest.fixture
def api(db):
    client = APIClient()
    client.force_authenticate(user=make_user("feeding", "tax.change_taxperiod"))
    return client


def rcv(imp, folio, total, *, direction=P, status=MatchStatus.ONLY_EXTERNAL, dte_type=33, rut="8973356-K"):
    return RCVDocument.objects.create(
        direction=direction, company_rut="11111111-1", period="202610", dte_type=dte_type, folio=folio,
        counterparty_rut=rut, issue_date=date(2026, 10, 15), total_amount=Decimal(total),
        first_import=imp, last_import=imp, match_status=status,
    )


def po(supplier, total=100000, status=PurchaseOrder.Status.CONFIRMED):
    total = Decimal(total)
    net = (total / Decimal("1.19")).quantize(Decimal("1"))
    return PurchaseOrder.objects.create(
        number=f"OC-815-{next(_seq)}", supplier=supplier, status=status,
        total=total, total_net=net, total_tax=total - net,
    )


def draft(supplier, total, **kw):
    order = po(supplier, total)
    return Invoice.objects.create(
        dte_type=kw.pop("dte_type", Invoice.DTEType.FACTURA), status=kw.pop("status", Invoice.Status.DRAFT),
        purchase_order=order, total=Decimal(total), date=date(2026, 10, 1), **kw,
    )


def test_suggests_draft_same_rut_within_2_percent(imp, supplier):
    near = draft(supplier, 101500)
    draft(supplier, 103000)  # más de 2 %
    draft(Contact.objects.create(name="Otro", tax_id="76.543.210-3"), 100000)  # otro RUT
    draft(supplier, 100000, status=Invoice.Status.POSTED, number="9")  # ya emitida
    Invoice.objects.create(  # venta: no es borrador de compra
        dte_type=Invoice.DTEType.FACTURA, status=Invoice.Status.DRAFT, partner_tax_id_snapshot="8973356-K",
        total=Decimal(100000),
    )
    exact = Invoice.objects.create(  # RUT del snapshot, sin OC
        dte_type=Invoice.DTEType.PURCHASE_INV, status=Invoice.Status.DRAFT, partner_tax_id_snapshot="8973356-k",
        total=Decimal(100000),
    )
    doc = rcv(imp, 123, 100000)

    assert [i.id for i in draft_suggestions(doc)] == [exact.id, near.id]


def test_no_suggestions_for_sales_or_matched(imp, supplier):
    draft(supplier, 100000)
    assert draft_suggestions(rcv(imp, 1, 100000, direction=S)) == []
    assert draft_suggestions(rcv(imp, 2, 100000, status=MatchStatus.MATCHED)) == []
    assert draft_suggestions(rcv(imp, 3, 100000, status="")) == []


def test_confirm_draft_assigns_folio_and_links(imp, supplier):
    invoice = draft(supplier, 100000)
    doc = rcv(imp, 123, 100000)

    confirm_draft_from_rcv(doc, invoice)

    invoice.refresh_from_db()
    doc.refresh_from_db()
    assert invoice.status == Invoice.Status.POSTED
    assert invoice.number == "123"
    assert invoice.date == doc.issue_date
    assert doc.match_status == MatchStatus.MATCHED
    assert doc.matched_invoice_id == invoice.id and doc.matched_manually


def test_confirm_draft_rejections(imp, supplier):
    posted = draft(supplier, 100000, status=Invoice.Status.POSTED, number="5")
    sale = Invoice.objects.create(dte_type=Invoice.DTEType.FACTURA, status=Invoice.Status.DRAFT, total=100)
    invoice = draft(supplier, 100000)
    with pytest.raises(ValidationError):
        confirm_draft_from_rcv(rcv(imp, 1, 100000), posted)
    with pytest.raises(ValidationError):
        confirm_draft_from_rcv(rcv(imp, 2, 100000), sale)
    with pytest.raises(ValidationError):
        confirm_draft_from_rcv(rcv(imp, 3, 100000, status=MatchStatus.MATCHED), invoice)
    with pytest.raises(ValidationError):
        confirm_draft_from_rcv(rcv(imp, 4, 100000, direction=S), invoice)
    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.DRAFT


def test_confirm_draft_rolls_back_when_link_fails(imp, supplier):
    invoice = draft(supplier, 100000)
    other = rcv(imp, 9, 100000, status=MatchStatus.MATCHED)
    RCVDocument.objects.filter(pk=other.pk).update(matched_invoice=invoice)  # ya vinculada a otro RCV
    doc = rcv(imp, 123, 100000)

    with pytest.raises(ValidationError):
        confirm_draft_from_rcv(doc, invoice)

    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.DRAFT and invoice.number == ""


def test_create_draft_rejects_other_supplier(imp, accounts):
    other = Contact.objects.create(name="Otro", tax_id="76.543.210-3")
    with pytest.raises(ValidationError) as exc:
        create_draft_from_rcv(rcv(imp, 123, 100000), po(other))
    assert exc.value.messages == ["El proveedor de la OC no coincide con el RUT del documento."]


def test_create_draft_rejects_unsupported_type(imp, supplier, accounts):
    with pytest.raises(ValidationError):
        create_draft_from_rcv(rcv(imp, 123, 100000, dte_type=61), po(supplier))
    with pytest.raises(ValidationError):
        create_draft_from_rcv(rcv(imp, 124, 100000, dte_type=46), po(supplier))
    with pytest.raises(ValidationError):
        create_draft_from_rcv(rcv(imp, 125, 100000, status=MatchStatus.AMOUNT_DIFF), po(supplier))
    assert not Invoice.objects.exists()


def test_create_draft_from_po_is_draft_with_folio(imp, supplier, accounts):
    order = po(supplier, 100000)
    doc = rcv(imp, 123, 100000, dte_type=34)

    invoice = create_draft_from_rcv(doc, order)

    invoice.refresh_from_db()
    doc.refresh_from_db()
    assert invoice.status == Invoice.Status.DRAFT
    assert invoice.number == "123"
    assert invoice.dte_type == Invoice.DTEType.FACTURA_EXENTA
    assert invoice.date == doc.issue_date
    assert invoice.purchase_order_id == order.id
    # Queda vinculado: el documento RCV deja de figurar como «Falta en el ERP».
    assert doc.matched_invoice_id == invoice.id and doc.matched_manually
    assert doc.match_status == MatchStatus.MATCHED


def test_supplier_purchase_orders(imp, supplier):
    mine = po(supplier)
    po(supplier, status=PurchaseOrder.Status.CANCELLED)
    po(Contact.objects.create(name="Otro", tax_id="76.543.210-3"))
    doc = rcv(imp, 123, 100000)
    assert [o.id for o in supplier_purchase_orders(doc)] == [mine.id]
    assert supplier_purchase_orders(rcv(imp, 124, 100000, direction=S)) == []


def test_feeding_endpoints(api, imp, supplier, accounts):
    invoice = draft(supplier, 100000)
    doc = rcv(imp, 123, 100000)

    r = api.get(f"{BASE}/{doc.pk}/draft-suggestions/")
    assert r.status_code == 200
    assert [i["id"] for i in r.json()] == [invoice.id]

    r = api.post(f"{BASE}/{doc.pk}/confirm-draft/", {"invoice_id": invoice.pk}, HTTP_IDEMPOTENCY_KEY="k-confirm")
    assert r.status_code == 200, r.content
    assert r.json() == {"id": doc.pk, "match_status": MatchStatus.MATCHED, "matched_invoice": invoice.pk}

    other = rcv(imp, 124, 100000)
    order = po(supplier)
    r = api.get(f"{BASE}/{other.pk}/purchase-orders/")
    assert r.status_code == 200
    assert order.id in [o["id"] for o in r.json()]
    r = api.post(
        f"{BASE}/{other.pk}/create-draft/", {"purchase_order_id": order.pk}, format="json",
        HTTP_IDEMPOTENCY_KEY="k-create-0",
    )
    assert r.status_code == 201, r.content
    assert r.json()["match_status"] == MatchStatus.MATCHED


def test_feeding_endpoint_errors_are_400(api, imp, supplier, accounts):
    doc = rcv(imp, 123, 100000)
    other = po(Contact.objects.create(name="Otro", tax_id="76.543.210-3"))
    r = api.post(
        f"{BASE}/{doc.pk}/create-draft/", {"purchase_order_id": other.pk}, format="json",
        HTTP_IDEMPOTENCY_KEY="k-err",
    )
    assert r.status_code == 400
    assert "El proveedor de la OC no coincide con el RUT del documento." in str(r.json())


def test_feeding_endpoints_idempotent(api, imp, supplier, accounts):
    order = po(supplier)
    doc = rcv(imp, 123, 100000)
    body = {"purchase_order_id": order.pk}

    first = api.post(f"{BASE}/{doc.pk}/create-draft/", body, format="json", HTTP_IDEMPOTENCY_KEY="k-create")
    second = api.post(f"{BASE}/{doc.pk}/create-draft/", body, format="json", HTTP_IDEMPOTENCY_KEY="k-create")

    assert first.status_code == second.status_code == 201
    assert first.json() == second.json()
    assert Invoice.objects.filter(purchase_order=order).count() == 1
    assert api.post(f"{BASE}/{doc.pk}/create-draft/", body, format="json").status_code == 400  # sin key


def test_feeding_permissions(imp, supplier):
    viewer = APIClient()
    viewer.force_authenticate(user=make_user("feeding-view", "tax.view_taxperiod"))
    doc = rcv(imp, 123, 100000)
    assert viewer.get(f"{BASE}/{doc.pk}/draft-suggestions/").status_code == 403
    assert viewer.get(f"{BASE}/{doc.pk}/purchase-orders/").status_code == 403
    headers = {"HTTP_IDEMPOTENCY_KEY": "k-perm"}
    assert viewer.post(f"{BASE}/{doc.pk}/confirm-draft/", {"invoice_id": 1}, **headers).status_code == 403
    assert viewer.post(f"{BASE}/{doc.pk}/create-draft/", {"purchase_order_id": 1}, **headers).status_code == 403


@pytest.mark.parametrize("path", ["draft-suggestions", "purchase-orders"])
def test_list_endpoints_constant_queries(api, imp, supplier, path):
    doc = rcv(imp, 123, 100000)

    def count():
        with CaptureQueriesContext(connection) as ctx:
            assert api.get(f"{BASE}/{doc.pk}/{path}/").status_code == 200
        return len(ctx.captured_queries)

    draft(supplier, 100000)
    count()  # calienta la caché de permisos
    few = count()
    for _ in range(4):
        draft(supplier, 100000)
    assert count() == few
