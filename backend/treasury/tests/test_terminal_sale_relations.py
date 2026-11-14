"""Relaciones documentales de la venta de terminal de cobro (`treasury.terminalsale`)."""

from datetime import datetime
from datetime import timezone as dt_tz
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.documents import DocumentRelationService, DocumentTypeRegistry
from treasury.models import TerminalSale
from treasury.relations import terminal_sale_relations
from treasury.tests.helpers import make_terminal_provider


def make_sale():
    return TerminalSale.objects.create(
        provider=make_terminal_provider(),
        natural_key="cash:S1",
        serial_number="SN1",
        sale_id="S1",
        sequence_number="1",
        transaction_at=datetime(2026, 11, 10, 15, 0, tzinfo=dt_tz.utc),
        status=TerminalSale.Status.COMPLETED,
        payment_type=TerminalSale.PaymentType.CASH,
        document_type=39,
        total_amount=Decimal("10000"),
    )


@pytest.fixture
def admin_client(db):
    client = APIClient()
    client.force_authenticate(user=get_user_model().objects.create_superuser(username="tsrel", password="x"))
    return client


def test_terminal_sale_is_a_registered_document_type_with_provider():
    doc_type = DocumentTypeRegistry.get("treasury.terminalsale")
    assert doc_type.date_field == "transaction_at"
    assert doc_type.amount_field == "total_amount"
    assert DocumentRelationService.has_provider("treasury.terminalsale")


@pytest.mark.django_db
def test_provider_yields_no_links_yet():
    assert list(terminal_sale_relations(make_sale())) == []


@pytest.mark.django_db
def test_relations_endpoint_returns_empty_list(admin_client):
    sale = make_sale()

    response = admin_client.get(f"/api/core/documents/treasury.terminalsale/{sale.id}/relations/")

    assert response.status_code == 200
    body = response.json()
    assert body["relations"] == []
    assert body["unresolved"] == []
    document = body["document"]
    assert document["label"] == "treasury.terminalsale"
    assert document["id"] == sale.id
    assert document["domain"] == "treasury"
    assert document["status"] == "COMPLETED"
    assert document["amount"] == "10000"
    assert document["date"].startswith("2026-11-10")
    assert document["url"] == f"/d/treasury.terminalsale/{sale.id}"
