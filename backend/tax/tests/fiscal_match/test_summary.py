"""Conteo de diferencias del cuadre para el F29 y el cierre (spec §5.6)."""

import uuid

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from core.fiscal_match import FiscalMatchStatus
from core.tests.rbac_factories import make_user
from tax.fiscal_match.summary import fiscal_mismatch_counts
from tax.models import FiscalMatch

pytestmark = pytest.mark.django_db


def _group(invoice=None, **kw):
    return FiscalMatch.objects.create(direction="sale", invoice=invoice, **kw)


def test_mismatch_counts_keys_and_period():
    for status, period in (
        (FiscalMatchStatus.DIFF, "202610"),
        (FiscalMatchStatus.AMBIGUOUS, "202610"),
        (FiscalMatchStatus.MISSING_ERP, "202610"),
        (FiscalMatchStatus.MISSING_EXTERNAL, "202610"),
        (FiscalMatchStatus.MISSING_EXTERNAL, "202610"),
        (FiscalMatchStatus.MATCHED, "202610"),
        (FiscalMatchStatus.PENDING, "202610"),
        (FiscalMatchStatus.DIFF, "202609"),
    ):
        _group(status=status, fiscal_period=period)

    result = fiscal_mismatch_counts(2026, 10)

    assert result == {
        "count": 5,
        "by_status": {"DIFF": 1, "AMBIGUOUS": 1, "MISSING_ERP": 1, "MISSING_EXTERNAL": 2},
    }


def test_mismatch_counts_query_count_constant():
    def queries():
        with CaptureQueriesContext(connection) as ctx:
            fiscal_mismatch_counts(2026, 10)
        return len(ctx)

    base = queries()
    for status in (FiscalMatchStatus.DIFF, FiscalMatchStatus.AMBIGUOUS, FiscalMatchStatus.MISSING_ERP):
        _group(status=status, fiscal_period="202610")
    assert queries() == base


def test_summary_and_pending_issue_endpoints_are_gone():
    api = APIClient()
    api.force_authenticate(user=make_user(f"s-{uuid.uuid4().hex[:8]}", "tax.view_taxperiod"))
    assert api.get("/api/tax/fiscal-matches/summary/?year=2026&month=10").status_code == 404
    assert api.get("/api/tax/fiscal-matches/pending-issue/").status_code == 404
