"""
Regresión: el listado de períodos contables usaba select_related("journal_entry"),
campo que AccountingPeriod no tiene → FieldError (500) en cada GET.
"""

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from tax.models import AccountingPeriod, TaxPeriod


@pytest.mark.django_db
def test_list_accounting_periods_returns_200_without_n_plus_one(api_client):
    for month in (1, 2, 3):
        tax_period = TaxPeriod.objects.create(year=2026, month=month)
        AccountingPeriod.objects.update_or_create(
            year=2026, month=month, defaults={"tax_period": tax_period}
        )

    with CaptureQueriesContext(connection) as ctx:
        response = api_client.get("/api/tax/accounting-periods/?ordering=-year,-month")

    assert response.status_code == 200
    assert len(response.json()) >= 3
    period_queries = [q for q in ctx.captured_queries if "tax_accountingperiod" in q["sql"]]
    assert len(period_queries) == 1
