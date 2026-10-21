"""ADR-0091 — profit distribution resolutions: workflow fields are read-only and
only DRAFT resolutions are editable; anything not executed can be deleted."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from contacts.partner_models import ProfitDistributionResolution

User = get_user_model()


@pytest.fixture
def client(db):
    c = APIClient()
    c.force_authenticate(User.objects.create_superuser("profitpol", "p@x.cl", "x"))
    return c


def _resolution(status, year=2025):
    return ProfitDistributionResolution.objects.create(
        fiscal_year=year, resolution_date=date(2026, 4, 30), net_result=Decimal("1000000"), status=status
    )


def _url(r):
    return f"/api/contacts/profit-distributions/{r.pk}/"


@pytest.mark.django_db
def test_status_cannot_be_forced_by_patch(client):
    r = _resolution("DRAFT")
    client.patch(_url(r), {"status": "EXECUTED"}, format="json")
    r.refresh_from_db()
    assert r.status == "DRAFT"


@pytest.mark.django_db
def test_draft_is_editable(client):
    r = _resolution("DRAFT")
    assert client.patch(_url(r), {"net_result": "2000000"}, format="json").status_code == 200


@pytest.mark.django_db
def test_approved_rejects_amounts_but_accepts_notes(client):
    r = _resolution("APPROVED")
    res = client.patch(_url(r), {"net_result": "1"}, format="json")
    assert res.status_code == 422
    assert client.patch(_url(r), {"notes": "acta firmada"}, format="json").status_code == 200


@pytest.mark.django_db
def test_approved_can_be_deleted_but_executed_cannot(client):
    approved = _resolution("APPROVED")
    assert client.delete(_url(approved)).status_code == 204
    executed = _resolution("EXECUTED", year=2024)
    assert client.delete(_url(executed)).status_code == 400
    assert ProfitDistributionResolution.objects.filter(pk=executed.pk).exists()
