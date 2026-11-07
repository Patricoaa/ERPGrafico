"""ADR-0091 — a bank loan is editable only in DRAFT; a disbursed loan cannot be changed or deleted."""

from decimal import Decimal

import pytest

from treasury.models import BankLoan
from treasury.tests.test_loans_api import (  # noqa: F401
    _make_payload,
    auth_client,
    bank,
    checking_account,
    client,
    liability_account,
    liability_accounting,
    user,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def draft_loan_id(auth_client, bank, checking_account, liability_accounting):  # noqa: F811
    response = auth_client.post(
        "/api/treasury/loans/",
        _make_payload(bank, checking_account, liability_accounting),
        format="json",
    )
    assert response.status_code == 201
    return response.json()["id"]


@pytest.fixture
def active_loan_id(auth_client, draft_loan_id):  # noqa: F811
    assert auth_client.post(f"/api/treasury/loans/{draft_loan_id}/disburse/").status_code == 200
    return draft_loan_id


def _url(loan_id):
    return f"/api/treasury/loans/{loan_id}/"


def test_draft_loan_is_fully_editable(auth_client, draft_loan_id):  # noqa: F811
    response = auth_client.patch(_url(draft_loan_id), {"principal": "1234567.00"}, format="json")

    assert response.status_code == 200
    assert BankLoan.objects.get(pk=draft_loan_id).principal == Decimal("1234567.00")


@pytest.mark.parametrize(
    "field,value",
    [("principal", "1.00"), ("interest_rate", "9.0000"), ("term_months", 99), ("insurance_monthly", "1.00")],
)
def test_active_loan_rejects_financial_changes(auth_client, active_loan_id, field, value):  # noqa: F811
    before = getattr(BankLoan.objects.get(pk=active_loan_id), field)

    response = auth_client.patch(_url(active_loan_id), {field: value}, format="json")

    assert response.status_code >= 400
    assert getattr(BankLoan.objects.get(pk=active_loan_id), field) == before


def test_active_loan_accepts_notes(auth_client, active_loan_id):  # noqa: F811
    response = auth_client.patch(_url(active_loan_id), {"notes": "Renegociar en marzo"}, format="json")

    assert response.status_code == 200
    assert BankLoan.objects.get(pk=active_loan_id).notes == "Renegociar en marzo"


def test_active_loan_cannot_be_deleted(auth_client, active_loan_id):  # noqa: F811
    response = auth_client.delete(_url(active_loan_id))

    assert response.status_code >= 400
    assert BankLoan.objects.filter(pk=active_loan_id).exists()


def test_draft_loan_can_be_deleted(auth_client, draft_loan_id):  # noqa: F811
    assert auth_client.delete(_url(draft_loan_id)).status_code == 204
    assert not BankLoan.objects.filter(pk=draft_loan_id).exists()
