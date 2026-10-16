"""
M2 (ADR-0080): DocumentRef y endpoint de relaciones sobre el flujo piloto
OV → despacho → factura → pago (+ stock y asientos).
"""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from rest_framework.test import APIClient

from accounting.models import Account, AccountingSettings, AccountType, JournalEntry
from billing.models import Invoice
from contacts.models import Contact
from inventory.models import Location, Product, ProductCategory, UoM, UoMCategory, Warehouse
from sales.models import SaleDelivery, SaleDeliveryLine, SaleLine, SaleOrder
from sales.services import SalesService
from treasury.models import TreasuryAccount, TreasuryMovement
from treasury.services import TreasuryService

User = get_user_model()


@pytest.fixture
def pilot(db):
    uom_cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="unidad", defaults={"ratio": 1, "category": uom_cat})
    cat, _ = ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})
    product = Product.objects.create(
        name="Papel", internal_code="PAP-M2", product_type=Product.Type.STORABLE,
        uom=uom, category=cat, cost_price=Decimal("0"),
    )
    warehouse = Warehouse.objects.create(name="Bodega", code="WH-M2")
    Location.objects.get_or_create(location_type="INTERNAL", warehouse=warehouse, defaults={"name": "Interno"})
    Location.objects.get_or_create(location_type="CUSTOMER", defaults={"name": "Cliente"})
    customer = Contact.objects.create(name="Imprenta Norte", tax_id="12345678-9")

    order = SaleOrder.objects.create(customer=customer, date=date(2026, 10, 1), status=SaleOrder.Status.CONFIRMED)
    sale_line = SaleLine.objects.create(
        order=order, product=product, quantity=Decimal("3"), unit_price=Decimal("1000"), uom=uom
    )
    delivery = SaleDelivery.objects.create(sale_order=order, warehouse=warehouse, delivery_date=date(2026, 10, 2))
    SaleDeliveryLine.objects.create(
        delivery=delivery, sale_line=sale_line, product=product, uom=uom,
        quantity=Decimal("3"), unit_price=Decimal("1000"),
    )
    SalesService.confirm_delivery(delivery)
    delivery.refresh_from_db()

    invoice = Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA, contact=customer, sale_order=order, total=Decimal("3570"),
    )
    receivable = Account.objects.create(name="Clientes", code="1.1.03.080", account_type=AccountType.ASSET)
    settings = AccountingSettings.get_solo()
    settings.default_receivable_account = receivable
    settings.save()
    cash_acc = Account.objects.create(name="Caja", code="1.1.01.080", account_type=AccountType.ASSET)
    cash = TreasuryAccount.objects.create(name="Caja", account=cash_acc, account_type=TreasuryAccount.Type.CASH)
    payment = TreasuryService.create_movement(
        amount=Decimal("3570"), movement_type=TreasuryMovement.Type.INBOUND, to_account=cash,
        partner=customer, sale_order=order, invoice=invoice,
    )
    payment.refresh_from_db()

    client = APIClient()
    client.force_authenticate(User.objects.create_superuser(username="m2", password="x", email="m2@x.cl"))
    return {"order": order, "delivery": delivery, "invoice": invoice, "payment": payment, "client": client}


def _relations(client, label, pk, **params):
    res = client.get(f"/api/core/documents/{label}/{pk}/relations/", params)
    assert res.status_code == 200, res.data
    return res.data


def _targets(data, role=None):
    return {(r["role"], r["target"]["label"], r["target"]["id"]) for r in data["relations"]
            if role is None or r["role"] == role}


@pytest.mark.django_db
def test_document_ref(pilot):
    order = pilot["order"]
    res = pilot["client"].get(f"/api/core/documents/sales.saleorder/{order.id}/")

    assert res.status_code == 200
    assert res.data["display_id"] == order.display_id
    assert res.data["url"] == f"/sales/orders?selected={order.id}"
    assert res.data["partner_name"] == "Imprenta Norte"
    assert res.data["accessible"] and res.data["exists"]
    assert res.data["domain"] == "origin"


@pytest.mark.django_db
def test_sale_order_relations_cover_pilot(pilot):
    data = _relations(pilot["client"], "sales.saleorder", pilot["order"].id)

    targets = _targets(data)
    assert ("delivery", "sales.saledelivery", pilot["delivery"].id) in targets
    assert ("invoice", "billing.invoice", pilot["invoice"].id) in targets
    assert ("payment", "treasury.treasurymovement", pilot["payment"].id) in targets
    assert data["unresolved"] == []
    delivery_link = next(r for r in data["relations"] if r["role"] == "delivery")
    assert delivery_link["semantic"] == "fulfillment" and delivery_link["direction"] == "outgoing"
    # Despacho sin lista con `?selected` propio → resolvedor
    assert delivery_link["target"]["url"] == f"/d/sales.saledelivery/{pilot['delivery'].id}"


@pytest.mark.django_db
def test_delivery_stock_move_and_back(pilot):
    delivery = pilot["delivery"]
    data = _relations(pilot["client"], "sales.saledelivery", delivery.id)
    moves = [r for r in data["relations"] if r["role"] == "stock_move"]
    assert len(moves) == 1 and Decimal(str(moves[0]["quantity"])) == Decimal("3")
    assert ("sale_order", "sales.saleorder", pilot["order"].id) in _targets(data)
    assert not _targets(data, "inventory_document"), "el despacho ya no acuña un documento de inventario (ADR-0085)"

    move_data = _relations(pilot["client"], "inventory.stockmove", moves[0]["target"]["id"])
    assert ("delivery", "sales.saledelivery", delivery.id) in _targets(move_data)
    assert not _targets(move_data, "inventory_document")


@pytest.mark.django_db
def test_invoice_payment_and_journal_entry(pilot):
    invoice_data = _relations(pilot["client"], "billing.invoice", pilot["invoice"].id)
    assert ("sale_order", "sales.saleorder", pilot["order"].id) in _targets(invoice_data)
    assert ("payment", "treasury.treasurymovement", pilot["payment"].id) in _targets(invoice_data)

    payment_data = _relations(pilot["client"], "treasury.treasurymovement", pilot["payment"].id)
    assert ("invoice", "billing.invoice", pilot["invoice"].id) in _targets(payment_data)
    je_links = [r for r in payment_data["relations"] if r["role"] == "journal_entry"]
    assert je_links, "el pago contabilizado enlaza su asiento"

    je_data = _relations(pilot["client"], "accounting.journalentry", je_links[0]["target"]["id"])
    assert ("source_document", "treasury.treasurymovement", pilot["payment"].id) in _targets(je_data)


@pytest.mark.django_db
def test_filters_and_unresolved(pilot):
    data = _relations(pilot["client"], "sales.saleorder", pilot["order"].id, semantic="settlement")
    assert data["relations"] and all(r["semantic"] == "settlement" for r in data["relations"])

    entry = JournalEntry.objects.create(
        date=date(2026, 10, 3), description="origen borrado",
        source_content_type=ContentType.objects.get_for_model(SaleOrder), source_object_id=999999,
    )
    dangling = _relations(pilot["client"], "accounting.journalentry", entry.id)
    assert dangling["unresolved"] == [
        {"label": "sales.saleorder", "id": 999999, "role": "source_document", "reason": "not_found"}
    ]


@pytest.mark.django_db
def test_permissions(pilot):
    viewer = User.objects.create_user(username="viewer", password="x")
    viewer.user_permissions.add(Permission.objects.get(codename="view_saleorder"))
    client = APIClient()
    client.force_authenticate(viewer)

    data = _relations(client, "sales.saleorder", pilot["order"].id)
    invoice_ref = next(r["target"] for r in data["relations"] if r["role"] == "invoice")
    assert invoice_ref["accessible"] is False and invoice_ref["status"] is None, "sin permiso: existe pero sin contenido"

    assert client.get(f"/api/core/documents/billing.invoice/{pilot['invoice'].id}/relations/").status_code == 403
    assert client.get("/api/core/documents/nope.model/1/").status_code == 404
    assert client.get("/api/core/documents/sales.saleorder/999999/").status_code == 404


@pytest.mark.django_db
def test_purchase_receipt_relations(pilot):
    from purchasing.models import PurchaseLine, PurchaseOrder, PurchaseReceipt, PurchaseReceiptLine
    from purchasing.services import PurchasingService

    product = SaleLine.objects.first().product
    warehouse = Warehouse.objects.get(code="WH-M2")
    Location.objects.get_or_create(location_type="VENDOR", defaults={"name": "Proveedor"})
    supplier = Contact.objects.create(name="Papelera Sur", tax_id="22222222-2")
    po = PurchaseOrder.objects.create(number="PO-M2", supplier=supplier, warehouse=warehouse,
                                      total=0, total_net=0, total_tax=0)
    po_line = PurchaseLine.objects.create(order=po, product=product, quantity=Decimal("5"),
                                          unit_cost=Decimal("100"), uom=product.uom)
    receipt = PurchaseReceipt.objects.create(purchase_order=po, warehouse=warehouse, receipt_date=date(2026, 10, 4),
                                             total=0, total_net=0, total_tax=0)
    PurchaseReceiptLine.objects.create(receipt=receipt, purchase_line=po_line, product=product, uom=product.uom,
                                       quantity_received=Decimal("5"), unit_cost=Decimal("100"))
    settings = AccountingSettings.get_solo()
    settings.stock_input_account = Account.objects.create(
        name="Mercadería por recibir", code="2.1.09.080", account_type=AccountType.LIABILITY)
    settings.storable_inventory_account = Account.objects.create(
        name="Inventario", code="1.1.05.080", account_type=AccountType.ASSET)
    settings.save()
    PurchasingService.confirm_receipt(receipt)

    data = _relations(pilot["client"], "purchasing.purchasereceipt", receipt.id)
    assert ("purchase_order", "purchasing.purchaseorder", po.id) in _targets(data)
    assert _targets(data, "stock_move") and _targets(data, "inventory_document")
    assert data["document"]["url"] == f"/d/purchasing.purchasereceipt/{receipt.id}"

    po_data = _relations(pilot["client"], "purchasing.purchaseorder", po.id)
    assert ("receipt", "purchasing.purchasereceipt", receipt.id) in _targets(po_data)


@pytest.mark.django_db
def test_sale_return_relations_d6(pilot):
    """M5 / D6: devolución de venta ligada a su OV, su NC y el movimiento de stock que repone."""
    from sales.return_services import ReturnService as SalesReturnService

    order = pilot["order"]
    product = order.lines.first().product
    credit_note = Invoice.objects.create(dte_type=Invoice.DTEType.NOTA_CREDITO, contact=order.customer,
                                         sale_order=order, corrected_invoice=pilot["invoice"], total=Decimal("1190"))
    sale_return = SalesReturnService.create_return_from_note_request(
        order=order, items=[{"product_id": product.id, "quantity": 1, "uom_id": product.uom_id}],
        warehouse_id=pilot["delivery"].warehouse_id, credit_note=credit_note,
    )
    SalesReturnService.confirm_return(sale_return)

    data = _relations(pilot["client"], "sales.salereturn", sale_return.id)
    assert ("sale_order", "sales.saleorder", order.id) in _targets(data)
    assert ("credit_note", "billing.invoice", credit_note.id) in _targets(data)
    assert _targets(data, "stock_move"), "la devolución enlaza el movimiento que repone stock"
    assert ("return", "sales.salereturn", sale_return.id) in _targets(
        _relations(pilot["client"], "sales.saleorder", order.id))
    assert data["document"]["url"] == f"/sales/returns/{sale_return.id}"


@pytest.mark.django_db
def test_work_order_relations(pilot):
    from production.models import WorkOrder

    order = pilot["order"]
    work_order = WorkOrder.objects.create(description="Impresión afiches", sale_order=order,
                                          sale_line=order.lines.first())

    data = _relations(pilot["client"], "production.workorder", work_order.id)
    assert ("sale_order", "sales.saleorder", order.id) in _targets(data)
    assert ("work_order", "production.workorder", work_order.id) in _targets(
        _relations(pilot["client"], "sales.saleorder", order.id))


def test_document_domains_follow_cycle_order():
    """ADR-0083: el área agrupa los relacionados de la ficha; OV/OC encabezan el ciclo."""
    from core.documents import DocumentTypeRegistry
    from core.documents.types import DOCUMENT_DOMAINS

    expected = {
        "sales.saleorder": "origin",
        "purchasing.purchaseorder": "origin",
        "billing.invoice": "billing",
        "production.workorder": "production",
        "sales.saledelivery": "logistics",
        "purchasing.purchasereceipt": "logistics",
        "inventory.stockmove": "logistics",
        "treasury.treasurymovement": "treasury",
        "accounting.journalentry": "accounting",
        "hr.payroll": "other",
    }
    for label, domain in expected.items():
        assert DocumentTypeRegistry.domain(label) == domain, label
    assert all(DocumentTypeRegistry.domain(label) in DOCUMENT_DOMAINS for label in DocumentTypeRegistry._types)


@pytest.mark.django_db
def test_sheet_relations_contacts_postings_and_detail(pilot):
    """ADR-0083: la ficha ve la contraparte, los asientos de sus relacionados y datos útiles por fila."""
    data = _relations(pilot["client"], "sales.saleorder", pilot["order"].id)
    by_role = {}
    for r in data["relations"]:
        by_role.setdefault(r["role"], []).append(r)

    customer = by_role["customer"]
    assert len(customer) == 1, "la contraparte aparece una sola vez aunque se repita en los relacionados"
    assert customer[0]["target"]["label"] == "contacts.contact"
    assert customer[0]["target"]["domain"] == "contacts"
    assert customer[0]["target"]["detail"].startswith("Imprenta Norte · 12345678-9")

    # Asientos de despacho y pago: la OV no los referencia directamente
    entries = {r["target"]["id"] for r in by_role["journal_entry"]}
    assert pilot["payment"].journal_entry_id in entries
    if pilot["delivery"].journal_entry_id:  # sin cuentas de inventario el despacho no contabiliza
        assert pilot["delivery"].journal_entry_id in entries
    assert all(r["target"]["domain"] == "accounting" for r in by_role["journal_entry"])

    payment = next(r for r in by_role["payment"] if r["target"]["id"] == pilot["payment"].id)["target"]
    assert Decimal(payment["amount"]) == Decimal("3570")
    assert payment["detail"]

    delivery = by_role["delivery"][0]["target"]
    assert delivery["amount"] is None and delivery["detail"].startswith("1 línea")


@pytest.mark.django_db
def test_partner_and_indirect_links_respect_semantic_filter(pilot):
    data = _relations(pilot["client"], "sales.saleorder", pilot["order"].id, semantic="fulfillment")
    assert {r["semantic"] for r in data["relations"]} == {"fulfillment"}


@pytest.mark.django_db
def test_u6_typed_summaries_replace_legacy_buckets(pilot):
    """ADR-0083 U6: OV con resumen tipado; asiento con source_document (DocumentRef)."""
    client = pilot["client"]
    order = client.get(f"/api/sales/orders/{pilot['order'].id}/").data
    assert "related_documents" not in order
    assert [i["id"] for i in order["invoices"]] == [pilot["invoice"].id]
    assert {"display_id", "number", "dte_type", "status", "total"} <= set(order["invoices"][0])
    assert [d["id"] for d in order["deliveries"]] == [pilot["delivery"].id]
    assert all("status" in p for p in order["serialized_payments"])

    invoice = client.get(f"/api/billing/invoices/{pilot['invoice'].id}/").data
    assert not {"related_documents", "related_stock_moves", "related_returns"} & set(invoice)

    entry_id = pilot["payment"].journal_entry_id
    entry = client.get(f"/api/accounting/entries/{entry_id}/").data
    assert "source_documents" not in entry
    assert entry["source_document"]["label"] == "treasury.treasurymovement"
    assert entry["source_document"]["id"] == pilot["payment"].id
