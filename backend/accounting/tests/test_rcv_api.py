"""API REST de la importación RCV (Task 6). Solo valores ficticios."""

from datetime import date, datetime
from datetime import timezone as dt_timezone
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from accounting.models import (
    RCVApiKey,
    RCVDocument,
    RCVImport,
    RCVImportAttempt,
    RCVImportSummary,
    RCVSettings,
)
from accounting.tests.rcv_helpers import SII_PASSWORD, make_api_key, make_rcv_settings
from core.rbac.bundles import expand

SALES = RCVImport.Direction.SALES
PURCHASES = RCVImport.Direction.PURCHASES
SECRET_KEY = "TEST-KEY-0000-0000-4472"
# 2026-11-14 09:00 en Santiago.
FIXED_NOW = datetime(2026, 11, 14, 12, 0, tzinfo=dt_timezone.utc)
_folio = iter(range(1, 100_000))


@pytest.fixture(autouse=True)
def frozen_now():
    with mock.patch("django.utils.timezone.now", return_value=FIXED_NOW):
        yield


def _client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _user_with_bundle(bundle: str, name: str):
    user = get_user_model().objects.create_user(username=name, password="x")
    codes = [p.split(".", 1)[1] for p in expand([bundle]) if p.startswith("accounting.")]
    user.user_permissions.set(
        Permission.objects.filter(content_type__app_label="accounting", codename__in=codes)
    )
    return user


@pytest.fixture
def reader(db):
    return _client(_user_with_bundle("accounting.read", "rcv-reader"))


@pytest.fixture
def manager(db):
    return _client(_user_with_bundle("accounting.manage", "rcv-manager"))


def _import(direction=SALES, year=2026, month=10, **kw) -> RCVImport:
    defaults = {"trigger": RCVImport.Trigger.MANUAL, "status": RCVImport.Status.SUCCESS}
    defaults.update(kw)
    return RCVImport.objects.create(direction=direction, year=year, month=month, **defaults)


def _doc(rcv_import: RCVImport, **kw) -> RCVDocument:
    defaults = {
        "direction": rcv_import.direction,
        "company_rut": "11111111-1",
        "period": rcv_import.period,
        "dte_type": 33,
        "folio": next(_folio),
        "counterparty_rut": "8973356-1",
        "counterparty_name": "PROVEEDOR GENERICO",
        "issue_date": date(rcv_import.year, rcv_import.month, 5),
        "total_amount": 11900,
        "raw": {"campo_original": "VALOR-CRUDO"},
        "first_import": rcv_import,
        "last_import": rcv_import,
    }
    defaults.update(kw)
    return RCVDocument.objects.create(**defaults)


# ── Documentos ───────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_documents_list_filters(reader):
    sales_oct = _import(SALES, 2026, 10)
    sales_sep = _import(SALES, 2026, 9)
    purchases_oct = _import(PURCHASES, 2026, 10)
    target = _doc(sales_oct, counterparty_name="CLIENTE UNO SPA", folio=987654)
    _doc(sales_oct, dte_type=61)
    _doc(sales_sep)
    _doc(purchases_oct)
    missing = _doc(purchases_oct, missing_since_import=purchases_oct)

    r = reader.get("/api/accounting/rcv-documents/?direction=SALES&year=2026&month=10&dte_type=33")
    assert r.status_code == 200, r.content
    body = r.json()
    assert [row["id"] for row in body["results"]] == [target.id]
    assert "raw" not in body["results"][0]

    r = reader.get("/api/accounting/rcv-documents/", {"search": "CLIENTE UNO"})
    assert [row["id"] for row in r.json()["results"]] == [target.id]
    r = reader.get("/api/accounting/rcv-documents/", {"search": str(target.folio)})
    assert [row["id"] for row in r.json()["results"]] == [target.id]

    r = reader.get("/api/accounting/rcv-documents/", {"missing": "true"})
    rows = r.json()["results"]
    assert [row["id"] for row in rows] == [missing.id]
    assert rows[0]["is_missing"] is True

    r = reader.get("/api/accounting/rcv-documents/", {"month": "13"})
    assert r.status_code == 400


@pytest.mark.django_db
def test_document_detail_includes_raw(reader):
    first = _import(SALES, 2026, 9)
    last = _import(SALES, 2026, 10)
    doc = _doc(last, first_import=first, missing_since_import=last)
    r = reader.get(f"/api/accounting/rcv-documents/{doc.id}/")
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["raw"] == {"campo_original": "VALOR-CRUDO"}
    assert body["first_import"] == {"id": first.id, "period": "202609"}
    assert body["last_import"] == {"id": last.id, "period": "202610"}
    assert body["missing_since_import"] == {"id": last.id, "period": "202610"}


# ── Importaciones ────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_import_detail_has_summaries_attempts_and_masked_key(reader):
    key = make_api_key(SECRET_KEY)
    gone = make_api_key("TEST-KEY-BORRADA-9999")
    imp = _import(api_key=key, raw_response={"resumen": "CRUDO-IMPORT"})
    RCVImportSummary.objects.create(rcv_import=imp, dte_type=33, document_count=2, total_amount=100)
    RCVImportAttempt.objects.create(
        rcv_import=imp,
        api_key=gone,
        http_status=402,
        outcome=RCVImportAttempt.Outcome.QUOTA_EXHAUSTED,
    )
    RCVImportAttempt.objects.create(
        rcv_import=imp, api_key=key, http_status=200, outcome=RCVImportAttempt.Outcome.OK
    )
    gone.delete()

    r = reader.get(f"/api/accounting/rcv-imports/{imp.id}/")
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["raw_response"] == {"resumen": "CRUDO-IMPORT"}
    assert body["masked_key"] == "••••-4472"
    assert [s["dte_type"] for s in body["summaries"]] == [33]
    assert [a["masked_key"] for a in body["attempts"]] == [None, "••••-4472"]
    assert SECRET_KEY.encode() not in r.content

    r = reader.get("/api/accounting/rcv-imports/")
    row = r.json()["results"][0]
    assert "raw_response" not in row and "attempts" not in row
    assert row["masked_key"] == "••••-4472"


@pytest.mark.django_db
def test_imports_list_filters(reader):
    a = _import(SALES, 2026, 10, status=RCVImport.Status.FAILED)
    _import(PURCHASES, 2026, 10)
    _import(SALES, 2026, 9, trigger=RCVImport.Trigger.SCHEDULED)
    r = reader.get("/api/accounting/rcv-imports/", {"direction": "SALES", "status": "FAILED"})
    assert [row["id"] for row in r.json()["results"]] == [a.id]
    r = reader.get(
        "/api/accounting/rcv-imports/", {"trigger": "SCHEDULED", "year": 2026, "month": 9}
    )
    assert len(r.json()["results"]) == 1
    assert reader.get("/api/accounting/rcv-imports/", {"status": "NOPE"}).status_code == 400


@pytest.mark.django_db
def test_start_import_enqueues(manager, reader, django_capture_on_commit_callbacks):
    body = {"year": 2026, "month": 10, "directions": ["PURCHASES", "SALES"]}
    with mock.patch("accounting.tasks.run_rcv_imports.delay") as delay:
        with django_capture_on_commit_callbacks(execute=False) as callbacks:
            r = manager.post(
                "/api/accounting/rcv-imports/start/",
                body,
                format="json",
                HTTP_IDEMPOTENCY_KEY="rcv-1",
            )
        # Nada se encola antes del commit: el worker no vería las filas.
        delay.assert_not_called()
        assert len(callbacks) == 1
        callbacks[0]()
    assert r.status_code == 202, r.content
    rows = r.json()
    assert len(rows) == 2
    assert {row["direction"] for row in rows} == {"PURCHASES", "SALES"}
    assert all(row["status"] == "QUEUED" and row["trigger"] == "MANUAL" for row in rows)
    delay.assert_called_once_with([row["id"] for row in rows])

    with mock.patch("accounting.tasks.run_rcv_imports.delay") as delay:
        r = reader.post(
            "/api/accounting/rcv-imports/start/", body, format="json", HTTP_IDEMPOTENCY_KEY="rcv-2"
        )
    assert r.status_code == 403
    delay.assert_not_called()


@pytest.mark.django_db
def test_start_import_duplicate_400(manager):
    _import(SALES, 2026, 10, status=RCVImport.Status.RUNNING)
    body = {"year": 2026, "month": 10, "directions": ["SALES"]}
    with mock.patch("accounting.tasks.run_rcv_imports.delay") as delay:
        r = manager.post(
            "/api/accounting/rcv-imports/start/", body, format="json", HTTP_IDEMPOTENCY_KEY="rcv-3"
        )
    assert r.status_code == 400
    assert "Ya hay una importación" in r.json()["detail"]
    delay.assert_not_called()
    assert RCVImport.objects.count() == 1

    with mock.patch("accounting.tasks.run_rcv_imports.delay"):
        r = manager.post(
            "/api/accounting/rcv-imports/start/",
            {"year": 2026, "month": 10, "directions": ["OTRO"]},
            format="json",
            HTTP_IDEMPOTENCY_KEY="rcv-4",
        )
    assert r.status_code == 400


# ── Configuración ────────────────────────────────────────────────────────────

SETTINGS_URL = "/api/accounting/rcv-settings/current/"


@pytest.mark.django_db
def test_settings_password_write_only(manager, reader):
    r = manager.patch(SETTINGS_URL, {"sii_password": "  clave-de-prueba  "}, format="json")
    assert r.status_code == 200, r.content
    assert "sii_password" not in r.json()
    r = reader.get(SETTINGS_URL)
    assert r.status_code == 200
    assert r.json()["has_sii_password"] is True
    assert b"clave-de-prueba" not in r.content
    assert RCVSettings.get_settings().get_sii_password() == "clave-de-prueba"

    r = manager.patch(SETTINGS_URL, {"interval_days": 3}, format="json")
    assert r.status_code == 200
    r = manager.patch(SETTINGS_URL, {"sii_password": ""}, format="json")
    assert r.status_code == 200
    assert RCVSettings.get_settings().get_sii_password() == "clave-de-prueba"

    r = manager.patch(
        SETTINGS_URL, {"company_rut": "8.973.356-1", "user_rut": "22.222.222-2"}, format="json"
    )
    assert r.status_code == 200, r.content
    assert r.json()["company_rut"] == "8973356-1"
    assert r.json()["user_rut"] == "22222222-2"
    r = manager.patch(SETTINGS_URL, {"company_rut": "8973356-2"}, format="json")
    assert r.status_code == 400
    assert "company_rut" in r.json()["error"]["details"]

    assert reader.patch(SETTINGS_URL, {"enabled": True}, format="json").status_code == 403


@pytest.mark.django_db
def test_settings_derived_fields(reader, manager):
    make_api_key("TEST-KEY-A")
    make_api_key("TEST-KEY-B")
    make_api_key("TEST-KEY-C", is_active=False)
    r = reader.get(SETTINGS_URL)
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["estimated_monthly_queries"] == 12
    assert "total_monthly_quota" not in body
    assert body["next_period"] == {"year": 2026, "month": 11}
    assert body["enabled"] is False and body["interval_days"] == 7 and body["run_hour"] == 6

    r = manager.patch(SETTINGS_URL, {"include_sales": False}, format="json")
    assert r.json()["estimated_monthly_queries"] == 6


@pytest.mark.django_db
def test_settings_existing_password_kept(manager):
    make_rcv_settings()
    r = manager.patch(SETTINGS_URL, {"enabled": True}, format="json")
    assert r.status_code == 200
    assert r.json()["has_sii_password"] is True
    assert RCVSettings.get_settings().get_sii_password() == SII_PASSWORD


# ── API keys ─────────────────────────────────────────────────────────────────

KEYS_URL = "/api/accounting/rcv-api-keys/"


@pytest.mark.django_db
def test_api_keys_crud_masked_and_unique(manager, reader):
    r = manager.post(KEYS_URL, {"label": "Principal", "key": f"  {SECRET_KEY}  "}, format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert "key" not in body
    assert body["masked_key"] == "••••-4472"
    assert "monthly_limit" not in body and body["used_this_month"] == 0
    assert SECRET_KEY.encode() not in r.content
    created = RCVApiKey.objects.get(pk=body["id"])
    assert created.get_key() == SECRET_KEY

    r = manager.post(KEYS_URL, {"label": "Copia", "key": SECRET_KEY}, format="json")
    assert r.status_code == 400
    assert r.json()["error"]["details"]["key"] == ["Esta API key ya está registrada."]
    r = manager.post(KEYS_URL, {"label": "Vacía", "key": "   "}, format="json")
    assert r.status_code == 400

    RCVImportAttempt.objects.create(
        rcv_import=_import(), api_key=created, outcome=RCVImportAttempt.Outcome.OK
    )
    r = manager.patch(f"{KEYS_URL}{created.id}/", {"label": "Renombrada"}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["used_this_month"] == 1
    created.refresh_from_db()
    assert created.get_key() == SECRET_KEY

    r = reader.get(KEYS_URL)
    assert r.status_code == 200
    assert SECRET_KEY.encode() not in r.content
    assert reader.post(KEYS_URL, {"key": "TEST-KEY-OTRA"}, format="json").status_code == 403

    assert manager.delete(f"{KEYS_URL}{created.id}/").status_code == 204


@pytest.mark.django_db
def test_api_key_usage_counts_only_current_month(reader):
    key = make_api_key(SECRET_KEY)
    imp = _import()
    old = RCVImportAttempt.objects.create(
        rcv_import=imp, api_key=key, outcome=RCVImportAttempt.Outcome.OK
    )
    RCVImportAttempt.objects.filter(pk=old.pk).update(
        created_at=datetime(2026, 10, 31, 12, tzinfo=dt_timezone.utc)
    )
    RCVImportAttempt.objects.create(
        rcv_import=imp, api_key=key, outcome=RCVImportAttempt.Outcome.OK
    )
    rows = reader.get(KEYS_URL).json()
    assert rows[0]["used_this_month"] == 1


# ── N+1 ──────────────────────────────────────────────────────────────────────


def _count_queries(client, url) -> int:
    with CaptureQueriesContext(connection) as ctx:
        assert client.get(url).status_code == 200
    return len(ctx.captured_queries)


def _seed(n: int) -> None:
    user = get_user_model().objects.create_user(username=f"seed-{n}", password="x")
    for i in range(n):
        key = make_api_key(f"TEST-KEY-SEED-{n}-{i:04d}")
        imp = _import(api_key=key, triggered_by=user)
        RCVImportAttempt.objects.create(
            rcv_import=imp, api_key=key, outcome=RCVImportAttempt.Outcome.OK
        )
        RCVImportSummary.objects.create(rcv_import=imp, dte_type=33)
        _doc(imp, first_import=imp, missing_since_import=imp)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "url", ["/api/accounting/rcv-documents/", "/api/accounting/rcv-imports/", KEYS_URL]
)
def test_list_endpoints_query_count(reader, url):
    _seed(3)
    _count_queries(reader, url)  # calienta la caché de permisos del usuario
    small = _count_queries(reader, url)
    _seed(27)
    assert _count_queries(reader, url) == small


@pytest.mark.django_db
def test_documents_sql_skips_raw_payloads(reader):
    imp = _import(raw_response={"cuerpo": "CRUDO-MES"})
    doc = _doc(imp, missing_since_import=imp)
    with CaptureQueriesContext(connection) as ctx:
        r = reader.get("/api/accounting/rcv-documents/")
    assert r.status_code == 200
    assert r.json()["results"][0]["is_missing"] is True
    sql = " ".join(q["sql"] for q in ctx.captured_queries)
    assert "raw_response" not in sql
    assert '"accounting_rcvdocument"."raw"' not in sql

    with CaptureQueriesContext(connection) as ctx:
        r = reader.get(f"/api/accounting/rcv-documents/{doc.id}/")
    assert r.status_code == 200
    assert "raw_response" not in " ".join(q["sql"] for q in ctx.captured_queries)
    body = r.json()
    assert body["raw"] == {"campo_original": "VALOR-CRUDO"}
    ref = {"id": imp.id, "period": "202610"}
    assert body["first_import"] == ref == body["last_import"] == body["missing_since_import"]


@pytest.mark.django_db
def test_api_key_new_value_clears_exhaustion(manager):
    key = make_api_key(SECRET_KEY, exhausted_until=date(2026, 12, 1), last_error="sin cupo")
    r = manager.patch(f"{KEYS_URL}{key.id}/", {"label": "Otra"}, format="json")
    assert r.status_code == 200, r.content
    key.refresh_from_db()
    assert key.exhausted_until == date(2026, 12, 1)
    assert key.last_error == "sin cupo"

    r = manager.patch(f"{KEYS_URL}{key.id}/", {"key": "TEST-KEY-NUEVA-0001"}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["exhausted_until"] is None
    assert r.json()["last_error"] == ""
    key.refresh_from_db()
    assert key.get_key() == "TEST-KEY-NUEVA-0001"
    assert key.exhausted_until is None
    assert key.last_error == ""


def _group(status: str = "MATCHED"):
    from tax.models import FiscalMatch

    return FiscalMatch.objects.create(direction=FiscalMatch.Direction.SALE, status=status)


@pytest.mark.django_db
def test_documents_expose_fiscal_match_without_n_plus_one(reader):
    def seed(n: int) -> None:
        imp = _import()
        for _i in range(n):
            _doc(imp, fiscal_match=_group())

    url = "/api/accounting/rcv-documents/"
    seed(3)
    _count_queries(reader, url)
    small = _count_queries(reader, url)
    seed(6)
    assert _count_queries(reader, url) == small
    rows = reader.get(url).json()["results"]
    assert len(rows) == 9
    for row in rows:
        assert row["fiscal_match"]["status"] == "MATCHED"
        assert row["fiscal_match"]["status_display"] == "Cuadrado"
        assert row["fiscal_match"]["id"]
        # Sin campos del cuadre por pares: solo el grupo.
        assert not [key for key in row if key.startswith(("match", "terminal_sale"))]


@pytest.mark.django_db
def test_document_without_group_has_null_fiscal_match(reader):
    doc = _doc(_import())
    assert reader.get(f"/api/accounting/rcv-documents/{doc.id}/").json()["fiscal_match"] is None


@pytest.mark.django_db
def test_settings_fiscal_match_fields_writable(manager):
    r = manager.patch(
        SETTINGS_URL,
        {"fiscal_match_start_date": "2026-11-01", "terminal_match_window_minutes": 30},
        format="json",
    )
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["fiscal_match_start_date"] == "2026-11-01"
    assert body["terminal_match_window_minutes"] == 30
    bad = manager.patch(
        SETTINGS_URL, {"terminal_match_window_minutes": 0}, format="json"
    )
    assert bad.status_code == 400


@pytest.mark.django_db
def test_documents_filter_by_fiscal_match_status(reader):
    imp = _import()
    matched = _doc(imp, fiscal_match=_group("MATCHED"))
    _doc(imp, fiscal_match=_group("DIFF"))
    _doc(imp)
    rows = reader.get("/api/accounting/rcv-documents/?fiscal_match_status=MATCHED").json()["results"]
    assert [r["id"] for r in rows] == [matched.id]
    assert reader.get("/api/accounting/rcv-documents/?fiscal_match_status=NOPE").status_code == 400
