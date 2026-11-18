"""API ``/api/tax/fiscal-matches/``: lista, conteos, ficha y unión manual (spec §5.7)."""

import uuid
from datetime import timedelta

import pytest
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from core.fiscal_match import FiscalMatchStatus
from core.tests.rbac_factories import make_user
from tax.fiscal_match.engine import run_fiscal_match
from tax.models import FiscalMatch, FiscalMatchRun
from tax.tasks import FISCAL_MATCH_LOCK_KEY
from tax.tests.fiscal_match_helpers import (
    make_pos_document,
    make_terminal_env,
    make_terminal_sale,
    set_match_settings,
)
from treasury.models import TerminalSale, TreasuryMovement

pytestmark = pytest.mark.django_db

BASE = "/api/tax/fiscal-matches"


@pytest.fixture
def tenv(db):
    set_match_settings(timezone.localdate() - timedelta(days=5), window=15)
    return make_terminal_env()


def _client(*perms: str) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=make_user(f"fm-{uuid.uuid4().hex[:8]}", *perms))
    return c


@pytest.fixture
def api():
    return _client("tax.view_taxperiod", "tax.change_taxperiod")


def _ago(minutes: int):
    return timezone.now() - timedelta(minutes=minutes)


def _key() -> dict:
    return {"HTTP_IDEMPOTENCY_KEY": str(uuid.uuid4())}


def _matched_and_orphan(tenv):
    """Un 48 cuadrado con su venta TUU y una venta huérfana sin documento."""
    inv = make_pos_document(tenv, 6000, _ago(120))
    make_terminal_sale(tenv, 6000, _ago(118))
    orphan_sale = make_terminal_sale(tenv, 3333, _ago(60))
    run_fiscal_match()
    return FiscalMatch.objects.get(invoice=inv), TerminalSale.objects.get(pk=orphan_sale.pk).fiscal_match


def test_list_filtered_by_attention(api, tenv):
    matched, orphan = _matched_and_orphan(tenv)
    assert matched.status == FiscalMatchStatus.MATCHED
    assert orphan.status not in (FiscalMatchStatus.MATCHED, FiscalMatchStatus.EXCLUDED)

    r = api.get(f"{BASE}/", {"status": "attention"})

    assert r.status_code == 200, r.content
    assert [g["id"] for g in r.json()["results"]] == [orphan.id]
    r = api.get(f"{BASE}/", {"status": f"{FiscalMatchStatus.MATCHED},attention"})
    assert {g["id"] for g in r.json()["results"]} == {matched.id, orphan.id}
    row = api.get(f"{BASE}/", {"status": FiscalMatchStatus.MATCHED}).json()["results"][0]
    assert set(row) == {
        "id", "direction", "status", "status_display", "erp_state", "tuu_state", "rcv_state", "dte_type",
        "issue_date", "erp_amount", "tuu_amount", "rcv_amount", "invoice", "terminal_sales", "rcv_documents",
        "notice", "closed_period_alert", "issue_error",
    }
    assert row["status_display"] == "Cuadrado"
    assert set(row["invoice"]) == {"id", "display_id"}
    assert set(row["terminal_sales"][0]) == {"id", "transaction_at", "sale_amount"}
    assert api.get(f"{BASE}/", {"status": "NOPE"}).status_code == 400


def test_list_search_by_amount(api, tenv):
    _, orphan = _matched_and_orphan(tenv)
    r = api.get(f"{BASE}/", {"search": "3.333"})
    assert [g["id"] for g in r.json()["results"]] == [orphan.id]


def test_counts(api, tenv):
    _matched_and_orphan(tenv)
    FiscalMatchRun.objects.create(finished_at=timezone.now() + timedelta(minutes=1), error="boom")

    r = api.get(f"{BASE}/counts/", {"status": "attention"})

    assert r.status_code == 200
    body = r.json()
    assert body["by_status"][FiscalMatchStatus.MATCHED] == 1
    assert sum(body["by_status"].values()) == 2  # el filtro de estado no aplica a los conteos
    good = FiscalMatchRun.objects.filter(error="").latest("finished_at")
    assert body["last_run_at"] == good.finished_at.isoformat()
    assert body["start_date"] == (timezone.localdate() - timedelta(days=5)).isoformat()


def test_counts_without_start_date(api, tenv):
    set_match_settings(None)

    assert api.get(f"{BASE}/counts/").json()["start_date"] is None


def test_detail(api, tenv):
    matched, _ = _matched_and_orphan(tenv)
    movement = TreasuryMovement.objects.get(invoice_id=matched.invoice_id)

    r = api.get(f"{BASE}/{matched.id}/")

    assert r.status_code == 200
    body = r.json()
    assert set(body["invoice"]) == {"id", "display_id", "dte_type", "number", "status", "total", "date"}
    sale = body["terminal_sales"][0]
    assert sale["matched_movement"]["id"] == movement.id
    assert set(sale) == {
        "id", "transaction_at", "sale_amount", "document_type", "payment_type", "matched_movement",
        "linked_manually",
    }


def _groups(tenv, n: int, base: int) -> None:
    for i in range(n):
        make_pos_document(tenv, base + i, _ago(200 + i))
        make_terminal_sale(tenv, base + i, _ago(199 + i))
    run_fiscal_match()


def test_list_query_count_constant(api, tenv):
    def count(n: int, base: int) -> int:
        FiscalMatch.objects.all().delete()
        _groups(tenv, n, base)
        assert FiscalMatch.objects.filter(invoice__isnull=False, terminal_sales__isnull=False).count() >= n
        api.get(f"{BASE}/")  # calienta la caché de permisos del usuario
        with CaptureQueriesContext(connection) as ctx:
            assert api.get(f"{BASE}/", {"page_size": 100}).status_code == 200
        return len(ctx.captured_queries)

    few, many = count(5, 1000), count(40, 2000)
    assert few == many <= 4  # conteo, página, ventas TUU y registros RCV


def test_retry_issue_rejects_posted(api, tenv):
    matched, _ = _matched_and_orphan(tenv)
    assert api.post(f"{BASE}/{matched.id}/retry-issue/", format="json", **_key()).status_code == 400


def _apply(api, group, changes, **kw):
    return api.post(f"{BASE}/{group.id}/apply/", {"changes": changes}, format="json", **kw)


def _tuu_case(tenv):
    inv = make_pos_document(tenv, 6000, _ago(300))
    sale = make_terminal_sale(tenv, 6000, _ago(118))  # fuera de la ventana: el motor no la une
    run_fiscal_match()
    return FiscalMatch.objects.get(invoice=inv), sale, TreasuryMovement.objects.get(invoice=inv)


def test_apply_endpoint_ok(api, tenv):
    group, sale, movement = _tuu_case(tenv)

    r = _apply(api, group, [{"op": "link", "part": "tuu", "id": sale.id, "movement": movement.id}], **_key())

    assert r.status_code == 200, r.content
    assert r.json()["id"] == group.id
    assert [s["id"] for s in r.json()["terminal_sales"]] == [sale.id]


def test_apply_endpoint_error_shape(api, tenv):
    group, sale, movement = _tuu_case(tenv)
    changes = [
        {"op": "link", "part": "tuu", "id": sale.id, "movement": movement.id},
        {"op": "unlink", "part": "erp", "id": group.invoice_id},
    ]

    r = _apply(api, group, changes, **_key())

    assert r.status_code == 400
    error = r.json()["error"]
    assert error["message"] == "El documento ERP no se quita del cuadre"
    assert error["code"] == "NOT_ALLOWED"
    assert error["details"] == {"change_index": 1}
    sale.refresh_from_db()
    assert sale.fiscal_match_id != group.id  # todo o nada


def test_apply_endpoint_validates_body(api, tenv):
    group, sale, _ = _tuu_case(tenv)
    ok = {"op": "link", "part": "rcv", "id": 1}
    for changes in (
        [],
        [ok] * 51,
        [{"op": "link", "part": "rcv"}],
        [{"op": "x", "part": "rcv", "id": 1}],
        [{"op": "link", "part": "erp", "id": 1, "payments": {"abc": 1}}],
        [{"op": "link", "part": "erp", "id": 1, "payments": {"5": "x"}}],
    ):
        assert _apply(api, group, changes, **_key()).status_code == 400
    assert api.post(f"{BASE}/{group.id}/apply/", {}, format="json", **_key()).status_code == 400


def test_apply_accepts_payments_map(api, tenv):
    group, sale, movement = _tuu_case(tenv)
    orphan = TerminalSale.objects.get(pk=sale.pk).fiscal_match
    change = {"op": "link", "part": "erp", "id": group.invoice_id, "payments": {str(sale.id): movement.id}}

    r = _apply(api, orphan, [change], **_key())

    assert r.status_code == 200, r.content
    assert r.json()["id"] == group.id and [s["id"] for s in r.json()["terminal_sales"]] == [sale.id]


def test_apply_permissions(tenv):
    group, sale, movement = _tuu_case(tenv)
    change = {"op": "link", "part": "tuu", "id": sale.id, "movement": movement.id}
    assert _apply(_client("tax.view_taxperiod"), group, [change], **_key()).status_code == 403
    assert _apply(_client(), group, [change], **_key()).status_code == 403
    viewer = _client("tax.view_taxperiod")
    assert viewer.get(f"{BASE}/").status_code == 200
    assert viewer.get(f"{BASE}/counts/").status_code == 200
    assert viewer.get(f"{BASE}/{group.id}/").status_code == 200
    assert _client("tax.change_taxperiod").get(f"{BASE}/").status_code == 403
    changer = _client("tax.change_taxperiod")
    orphan = TerminalSale.objects.get(pk=sale.pk).fiscal_match
    assert changer.post(f"{BASE}/{orphan.id}/release/", format="json", **_key()).status_code == 200
    assert _client("tax.view_taxperiod").post(f"{BASE}/{orphan.id}/release/", format="json", **_key()).status_code == 403
    assert _client("tax.view_taxperiod").post(f"{BASE}/{orphan.id}/retry-issue/", format="json", **_key()).status_code == 403


def test_apply_idempotent_replay(api, tenv):
    group, sale, movement = _tuu_case(tenv)
    changes = [{"op": "link", "part": "tuu", "id": sale.id, "movement": movement.id}]
    key = _key()

    first = _apply(api, group, changes, **key)
    again = _apply(api, group, changes, **key)

    assert first.status_code == again.status_code == 200
    assert again.json() == first.json()
    assert _apply(api, group, changes).status_code == 400  # sin clave


def test_apply_returns_409_while_engine_runs(api, tenv):
    group, sale, movement = _tuu_case(tenv)
    cache.delete(FISCAL_MATCH_LOCK_KEY)
    cache.add(FISCAL_MATCH_LOCK_KEY, "engine", timeout=540)
    try:
        changes = [{"op": "link", "part": "tuu", "id": sale.id, "movement": movement.id}]
        r = _apply(api, group, changes, **_key())
    finally:
        cache.delete(FISCAL_MATCH_LOCK_KEY)

    assert r.status_code == 409
    assert r.json()["error"]["message"] == "El cuadre automático se está ejecutando. Reintente en unos segundos."


def test_rule_error_outside_apply_keeps_its_code(api, tenv):
    matched, _ = _matched_and_orphan(tenv)

    r = api.post(f"{BASE}/{matched.id}/release/", format="json", **_key())

    assert r.status_code == 400
    assert r.json()["error"]["code"] == "SECOND_DOCUMENT"
    assert r.json()["error"]["details"] == {}


def test_release_and_retry_issue(api, tenv):
    matched, orphan = _matched_and_orphan(tenv)
    r = api.post(f"{BASE}/{orphan.id}/release/", format="json", **_key())
    assert r.status_code == 200
    assert api.post(f"{BASE}/{matched.id}/retry-issue/", format="json", **_key()).status_code == 400


def test_removed_endpoints_404(api, tenv):
    matched, orphan = _matched_and_orphan(tenv)
    for method, path in (
        ("post", "link"),
        ("post", "unlink"),
        ("get", "candidates"),
    ):
        r = getattr(api, method)(f"{BASE}/{matched.id}/{path}/", {"part": "tuu", "id": 1}, format="json", **_key())
        assert r.status_code == 404, path


def test_invoice_candidates_empty(api, tenv):
    r = api.get(f"{BASE}/invoice-candidates/?direction=purchase&sii_code=33")
    assert r.status_code == 200
    assert r.json()["results"] == []


def test_invoice_candidates_with_groups_and_scoring(api, tenv):
    from accounting.models import RCVDocument, RCVImport
    from billing.models import Invoice

    today = timezone.localdate()
    imp = RCVImport.objects.create(
        direction="PURCHASE", year=today.year, month=today.month, status=RCVImport.Status.SUCCESS
    )
    # Grupo huérfano 1: monto exacto 15000, mismo día -> alto score
    doc1 = RCVDocument.objects.create(
        direction="PURCHASE",
        dte_type=33,
        folio=1001,
        issue_date=today,
        total_amount=15000,
        counterparty_rut="76123456-7",
        first_import=imp,
        last_import=imp,
    )
    g1 = FiscalMatch.objects.create(
        direction=FiscalMatch.Direction.PURCHASE,
        status=FiscalMatchStatus.MISSING_ERP,
        dte_type=33,
        issue_date=today,
        rcv_amount=15000,
        counterparty_rut="76123456-7",
    )
    doc1.fiscal_match = g1
    doc1.save()

    # Grupo huérfano 2: monto distinto 50000, otra fecha -> menor score
    doc2 = RCVDocument.objects.create(
        direction="PURCHASE",
        dte_type=33,
        folio=1002,
        issue_date=today - timedelta(days=10),
        total_amount=50000,
        counterparty_rut="76999999-9",
        first_import=imp,
        last_import=imp,
    )
    g2 = FiscalMatch.objects.create(
        direction=FiscalMatch.Direction.PURCHASE,
        status=FiscalMatchStatus.MISSING_ERP,
        dte_type=33,
        issue_date=today - timedelta(days=10),
        rcv_amount=50000,
        counterparty_rut="76999999-9",
    )
    doc2.fiscal_match = g2
    doc2.save()

    # Grupo 3: MATCHED -> no debe aparecer
    g3 = FiscalMatch.objects.create(
        direction=FiscalMatch.Direction.PURCHASE,
        status=FiscalMatchStatus.MATCHED,
        dte_type=33,
        issue_date=today,
        rcv_amount=15000,
    )

    r = api.get(f"{BASE}/invoice-candidates/?direction=purchase&sii_code=33&amount=15000&counterparty_rut=76123456-7")
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) == 2
    assert results[0]["fiscal_match_id"] == g1.id
    assert results[0]["score"] > results[1]["score"]
    assert all(item["fiscal_match_id"] != g3.id for item in results)

    # Probando con invoice_id en lugar de pre-contexto
    inv = Invoice.objects.create(
        dte_type=Invoice.DTEType.PURCHASE_INV,
        number="",
        date=today,
        total=15000,
        status=Invoice.Status.DRAFT,
        partner_tax_id_snapshot="76.123.456-7",
    )
    r_inv = api.get(f"{BASE}/invoice-candidates/?invoice_id={inv.id}")
    assert r_inv.status_code == 200
    results_inv = r_inv.json()["results"]
    assert len(results_inv) >= 1
    assert results_inv[0]["fiscal_match_id"] == g1.id


def test_invoice_candidates_constant_queries(api, tenv):
    from accounting.models import RCVDocument, RCVImport

    today = timezone.localdate()
    imp = RCVImport.objects.create(
        direction="PURCHASE", year=today.year, month=today.month, status=RCVImport.Status.SUCCESS
    )
    for i in range(5):
        doc = RCVDocument.objects.create(
            direction="PURCHASE",
            dte_type=33,
            folio=2000 + i,
            issue_date=today,
            total_amount=10000 * (i + 1),
            counterparty_rut="76123456-7",
            first_import=imp,
            last_import=imp,
        )
        g = FiscalMatch.objects.create(
            direction=FiscalMatch.Direction.PURCHASE,
            status=FiscalMatchStatus.MISSING_ERP,
            dte_type=33,
            issue_date=today,
            rcv_amount=10000 * (i + 1),
            counterparty_rut="76123456-7",
        )
        doc.fiscal_match = g
        doc.save()

    with CaptureQueriesContext(connection) as ctx:
        r = api.get(f"{BASE}/invoice-candidates/?direction=purchase&sii_code=33")
    assert r.status_code == 200
    assert len(r.json()["results"]) == 5
    # Query count constante
    assert len(ctx.captured_queries) <= 6


def test_invoice_candidates_excludes_tuu_sales_without_rcv(api, tenv):
    from treasury.models import TerminalSale

    today = timezone.localdate()
    sale = TerminalSale.objects.create(
        provider=tenv.provider,
        device=tenv.device,
        sale_amount=5000,
        transaction_at=timezone.now(),
        document_type=39,
    )
    g_tuu = FiscalMatch.objects.create(
        direction=FiscalMatch.Direction.SALE,
        status=FiscalMatchStatus.MISSING_ERP,
        dte_type=39,
        issue_date=today,
        tuu_amount=5000,
    )
    sale.fiscal_match = g_tuu
    sale.save()

    r = api.get(f"{BASE}/invoice-candidates/?direction=sale&sii_code=39")
    assert r.status_code == 200
    results = r.json()["results"]
    assert all(item["fiscal_match_id"] != g_tuu.id for item in results)


