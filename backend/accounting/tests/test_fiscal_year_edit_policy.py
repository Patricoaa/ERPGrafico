"""ADR-0091 — a fiscal year in closing or closed keeps its dates."""

from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import FiscalYear

User = get_user_model()


@pytest.fixture
def client(db):
    c = APIClient()
    c.force_authenticate(User.objects.create_superuser("fypol", "f@x.cl", "x"))
    return c


def _year(status, year=2025):
    return FiscalYear.objects.create(
        year=year, start_date=date(year, 1, 1), end_date=date(year, 12, 31), status=status
    )


@pytest.mark.django_db
def test_closed_year_keeps_dates_but_accepts_notes(client):
    fy = _year(FiscalYear.Status.CLOSED)
    url = f"/api/accounting/fiscal-years/{fy.pk}/"
    assert client.patch(url, {"end_date": "2025-11-30"}, format="json").status_code == 422
    assert client.patch(url, {"notes": "auditado"}, format="json").status_code == 200
    assert client.delete(url).status_code == 422


@pytest.mark.django_db
def test_open_year_is_editable(client):
    fy = _year(FiscalYear.Status.OPEN, year=2026)
    res = client.patch(f"/api/accounting/fiscal-years/{fy.pk}/", {"notes": "x"}, format="json")
    assert res.status_code == 200, res.data
