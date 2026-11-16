import pytest
from rest_framework.test import APIClient

from billing.models import Invoice
from core.fiscal_match import MatchStatus
from core.tests.rbac_factories import make_user
from tax.tests.reconciliation_helpers import (
    local_dt,
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
    set_match_settings,
)

pytestmark = pytest.mark.django_db

BASE = "/api/tax/reconciliation"


@pytest.fixture
def api():
    c = APIClient()
    c.force_authenticate(user=make_user("recon", "tax.change_taxperiod"))
    return c


@pytest.fixture
def env():
    return make_terminal_env()


def _sale_and_doc(env, **doc_kwargs):
    at = local_dt(2026, 11, 10, 12)
    sale = make_terminal_sale(env, 5000, at, document_type=None)
    return sale, make_pos_document(env, 5000, at, **doc_kwargs)


def test_manual_match_and_unmatch(api, env):
    sale, doc = _sale_and_doc(env, dte_type=Invoice.DTEType.BOLETA)
    r = api.post(f"{BASE}/terminal-sales/{sale.pk}/match/", {"invoice_id": doc.pk}, format="json")
    assert r.status_code == 200
    sale.refresh_from_db()
    assert sale.matched_invoice_id == doc.pk and sale.matched_manually
    assert sale.match_status == MatchStatus.MATCHED
    r = api.post(f"{BASE}/terminal-sales/{sale.pk}/unmatch/")
    assert r.status_code == 200
    sale.refresh_from_db()
    assert sale.matched_invoice is None and not sale.matched_manually and sale.match_status == ""


def test_manual_match_type_diff(api, env):
    at = local_dt(2026, 11, 10, 12)
    sale = make_terminal_sale(env, 5000, at, document_type=48)
    doc = make_pos_document(env, 5000, at, dte_type=Invoice.DTEType.BOLETA)
    api.post(f"{BASE}/terminal-sales/{sale.pk}/match/", {"invoice_id": doc.pk}, format="json")
    sale.refresh_from_db()
    assert sale.match_status == MatchStatus.TYPE_DIFF


def test_cannot_match_invoice_linked_elsewhere(api, env):
    sale, doc = _sale_and_doc(env)
    other = make_terminal_sale(env, 5000, local_dt(2026, 11, 10, 12, 1))
    other.matched_invoice = doc
    other.save()
    r = api.post(f"{BASE}/terminal-sales/{sale.pk}/match/", {"invoice_id": doc.pk}, format="json")
    assert r.status_code == 400


def test_cannot_match_non_sale_document(api, env):
    sale, doc = _sale_and_doc(env, status=Invoice.Status.DRAFT)
    r = api.post(f"{BASE}/terminal-sales/{sale.pk}/match/", {"invoice_id": doc.pk}, format="json")
    assert r.status_code == 400


def test_candidates_same_day_same_amount(api, env):
    sale, doc = _sale_and_doc(env)
    make_pos_document(env, 4000, local_dt(2026, 11, 10, 12))  # otro monto
    make_pos_document(env, 5000, local_dt(2026, 11, 9, 12))  # otro día
    linked = make_pos_document(env, 5000, local_dt(2026, 11, 10, 13))
    other = make_terminal_sale(env, 5000, local_dt(2026, 11, 10, 13))
    other.matched_invoice = linked
    other.save()
    r = api.get(f"{BASE}/terminal-sales/{sale.pk}/candidates/")
    assert r.status_code == 200
    assert [i["id"] for i in r.json()] == [doc.pk]
    assert set(r.json()[0]) == {"id", "display_id", "dte_type", "total", "date"}


def test_run_endpoint_returns_counts(api, env):
    set_match_settings(local_dt(2026, 11, 1).date())
    make_terminal_sale(env, 5000, local_dt(2026, 11, 10, 12))
    r = api.post(f"{BASE}/terminal/run/", {"year": 2026, "month": 11}, format="json")
    assert r.status_code == 200
    assert r.json() == {MatchStatus.ONLY_EXTERNAL: 1, "boletas": {}}
    assert api.post(f"{BASE}/terminal/run/", {"year": 2026, "month": 13}, format="json").status_code == 400


def test_endpoints_require_permission(env):
    sale, doc = _sale_and_doc(env)
    c = APIClient()
    c.force_authenticate(user=make_user("nope", "tax.view_taxperiod"))
    assert c.post(f"{BASE}/terminal/run/", {"year": 2026, "month": 11}, format="json").status_code == 403
    assert c.get(f"{BASE}/terminal-sales/{sale.pk}/candidates/").status_code == 403
    assert c.post(f"{BASE}/terminal-sales/{sale.pk}/match/", {"invoice_id": doc.pk}, format="json").status_code == 403
    assert c.post(f"{BASE}/terminal-sales/{sale.pk}/unmatch/").status_code == 403


def test_concurrent_link_raises_validation_error(env):
    """Si otra venta enlaza el documento entre la lectura y el guardado, la
    restricción única se traduce en el mismo error de «vinculado a otra venta»."""
    from unittest import mock

    from django.core.exceptions import ValidationError

    from tax.reconciliation import terminal

    sale, doc = _sale_and_doc(env)
    other = make_terminal_sale(env, 5000, local_dt(2026, 11, 10, 12, 1))
    other.matched_invoice = doc
    other.save()
    with mock.patch.object(terminal, "TerminalSale") as stale_read:
        stale_read.objects.filter.return_value.exclude.return_value.exists.return_value = False
        with pytest.raises(ValidationError, match="vinculado a otra venta"):
            terminal.match_terminal_sale(sale, doc)
    sale.refresh_from_db()
    assert sale.matched_invoice_id is None and not sale.matched_manually
