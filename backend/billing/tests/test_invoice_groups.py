"""`GET /api/billing/invoices/groups/` (ADR-0158 §7): groups see the same filtered list as `list`
(sale / purchase split included), and each group's params list exactly its rows."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from billing.models import Invoice
from contacts.models import Contact
from purchasing.models import PurchaseOrder
from sales.models import SaleOrder

pytestmark = pytest.mark.ci_gate

User = get_user_model()
URL = "/api/billing/invoices/"
SALES = {"sale_order__isnull": "false"}


@pytest.fixture
def client(db):
    api = APIClient()
    api.force_authenticate(user=User.objects.create_superuser(username="grouper", password="x"))
    return api


@pytest.fixture
def invoices(db):
    customer = Contact.objects.create(name="Cliente", tax_id="11111111-1")
    supplier = Contact.objects.create(name="Proveedor", tax_id="22222222-2")
    so = SaleOrder.objects.create(customer=customer)
    po = PurchaseOrder.objects.create(number="PO-1", supplier=supplier, total=0, total_net=0, total_tax=0)
    for day, dte, total in [(date(2026, 11, 2), Invoice.DTEType.FACTURA, "100"), (date(2026, 11, 3), Invoice.DTEType.FACTURA, "50"), (date(2026, 11, 3), Invoice.DTEType.BOLETA, "20")]:
        Invoice.objects.create(dte_type=dte, contact=customer, sale_order=so, date=day, total=Decimal(total), total_net=0, total_tax=0)
    Invoice.objects.create(dte_type=Invoice.DTEType.PURCHASE_INV, contact=supplier, purchase_order=po, date=date(2026, 11, 3), total=Decimal("999"), total_net=0, total_tax=0)


def test_date_groups_newest_first_without_purchase_documents(client, invoices):
    groups = client.get(f"{URL}groups/", {**SALES, "group_by": "date"}).json()

    assert [(g["key"], g["count"]) for g in groups] == [("2026-11-03", 2), ("2026-11-02", 1)]
    assert groups[0]["params"] == {"date_from": "2026-11-03", "date_to": "2026-11-03"}
    assert Decimal(groups[0]["aggregates"]["total"]) == Decimal("70")
    for group in groups:
        assert client.get(URL, {**SALES, **group["params"]}).json()["count"] == group["count"]


def test_dte_type_groups_carry_the_choice_label(client, invoices):
    groups = client.get(f"{URL}groups/", {**SALES, "group_by": "dte_type"}).json()

    assert {g["label"]: g["count"] for g in groups} == {
        str(Invoice.DTEType.BOLETA.label): 1,
        str(Invoice.DTEType.FACTURA.label): 2,
    }
