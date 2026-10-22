"""ADR-0091 — checks are immutable except notes; a non-open card statement is locked."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from treasury.models import CreditCardStatement
from treasury.tests.test_card_statements_api import (  # noqa: F401 — fixtures
    _make_payload,
    auth_client,
    bank,
    card_account,
    user,
)
from treasury.tests.test_checks import _receive, base  # noqa: F401 — fixture


@pytest.mark.django_db
def test_check_is_immutable_except_notes(base):  # noqa: F811 — pytest fixture
    check = _receive(base, "0009001", "100000", created_by=base["user"])
    client = APIClient()
    client.force_authenticate(get_user_model().objects.create_superuser("chkpol", "k@x.cl", "x"))
    url = f"/api/treasury/checks/{check.pk}/"
    res = client.patch(url, {"amount": "1"}, format="json")
    assert res.status_code == 422
    assert res.data["error"]["code"] == "DOCUMENT_LOCKED"
    assert client.patch(url, {"notes": "retirar en sucursal"}, format="json").status_code == 200
    assert client.delete(url).status_code == 422


@pytest.mark.django_db
def test_open_statement_editable_but_not_once_closed(auth_client, card_account):  # noqa: F811
    created = auth_client.post("/api/treasury/card-statements/", _make_payload(card_account), format="json")
    assert created.status_code == 201, created.json()
    url = f"/api/treasury/card-statements/{created.json()['id']}/"
    assert auth_client.patch(url, {"billed_amount": "260000"}, format="json").status_code == 200

    CreditCardStatement.objects.filter(pk=created.json()["id"]).update(status="PAID")
    assert auth_client.patch(url, {"billed_amount": "1"}, format="json").status_code == 422
