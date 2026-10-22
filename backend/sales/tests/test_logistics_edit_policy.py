"""ADR-0091 — deliveries, returns and receipts: editable only as DRAFT, never deleted."""

from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from contacts.models import Contact
from inventory.models import Warehouse
from purchasing.models import PurchaseOrder, PurchaseReceipt
from sales.models import SaleDelivery, SaleOrder, SaleReturn

User = get_user_model()


@pytest.fixture
def client(db):
    c = APIClient()
    c.force_authenticate(User.objects.create_superuser("logpol", "l@x.cl", "x"))
    return c


@pytest.fixture
def env(db):
    contact = Contact.objects.create(name="Tercero", tax_id="44444444-4")
    return {
        "warehouse": Warehouse.objects.create(name="Bodega", code="WH-EP"),
        "order": SaleOrder.objects.create(
            customer=contact, date=date(2026, 9, 1), status=SaleOrder.Status.CONFIRMED
        ),
        "po": PurchaseOrder.objects.create(supplier=contact, status=PurchaseOrder.Status.CONFIRMED),
    }


def _delivery(env, status):
    return SaleDelivery.objects.create(
        sale_order=env["order"], warehouse=env["warehouse"], delivery_date=date(2026, 9, 2), status=status
    )


@pytest.mark.django_db
def test_confirmed_delivery_rejects_edit_but_accepts_notes(client, env):
    d = _delivery(env, SaleDelivery.Status.CONFIRMED)
    url = f"/api/sales/deliveries/{d.pk}/"
    res = client.patch(url, {"delivery_date": "2026-09-20"}, format="json")
    assert res.status_code == 422
    assert res.data["error"]["code"] == "DOCUMENT_LOCKED"
    assert client.patch(url, {"notes": "guía extraviada"}, format="json").status_code == 200


@pytest.mark.django_db
def test_draft_delivery_is_editable(client, env):
    d = _delivery(env, SaleDelivery.Status.DRAFT)
    res = client.patch(f"/api/sales/deliveries/{d.pk}/", {"delivery_date": "2026-09-20"}, format="json")
    assert res.status_code == 200, res.data


@pytest.mark.django_db
def test_deliveries_and_returns_are_never_hard_deleted(client, env):
    d = _delivery(env, SaleDelivery.Status.DRAFT)
    r = SaleReturn.objects.create(
        sale_order=env["order"], warehouse=env["warehouse"], date=date(2026, 9, 3)
    )
    assert client.delete(f"/api/sales/deliveries/{d.pk}/").status_code == 405
    assert client.delete(f"/api/sales/returns/{r.pk}/").status_code == 405
    assert SaleDelivery.objects.filter(pk=d.pk).exists()
    assert SaleReturn.objects.filter(pk=r.pk).exists()


@pytest.mark.django_db
def test_confirmed_receipt_rejects_edit(client, env):
    rc = PurchaseReceipt.objects.create(
        purchase_order=env["po"],
        warehouse=env["warehouse"],
        receipt_date=date(2026, 9, 2),
        status=PurchaseReceipt.Status.CONFIRMED,
    )
    res = client.patch(f"/api/purchasing/receipts/{rc.pk}/", {"receipt_date": "2026-09-20"}, format="json")
    assert res.status_code == 422
