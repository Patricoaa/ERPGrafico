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
    assert _targets(data, "inventory_document"), "el despacho enlaza su documento de inventario (INT-04)"

    move_data = _relations(pilot["client"], "inventory.stockmove", moves[0]["target"]["id"])
    assert ("delivery", "sales.saledelivery", delivery.id) in _targets(move_data)
    assert _targets(move_data, "inventory_document")


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
