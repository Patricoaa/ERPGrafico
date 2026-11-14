from datetime import date, datetime, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal
from unittest import mock

import pytest
from django.core.exceptions import ValidationError
from django.db import connection
from django.test.utils import CaptureQueriesContext

from accounting import rcv_service
from accounting.integrations.rcv_normalizer import normalize_report
from accounting.models import (
    RCVApiKey,
    RCVDocument,
    RCVImport,
    RCVImportAttempt,
    RCVImportSummary,
    RCVSettings,
)
from accounting.tests.rcv_helpers import (
    SII_PASSWORD,
    FakeClient,
    error,
    load_fixture,
    make_api_key,
    make_rcv_settings,
    ok,
)

Outcome = RCVImportAttempt.Outcome
SALES = RCVImport.Direction.SALES
PURCHASES = RCVImport.Direction.PURCHASES
# 2026-11-14 09:00 en Santiago.
FIXED_NOW = datetime(2026, 11, 14, 12, 0, tzinfo=dt_timezone.utc)


@pytest.fixture(autouse=True)
def frozen_now():
    with mock.patch("django.utils.timezone.now", return_value=FIXED_NOW):
        yield


def _no_sleep():
    return mock.Mock()


def _import(direction=SALES, year=2026, month=10, **kw) -> RCVImport:
    return RCVImport.objects.create(
        direction=direction, year=year, month=month, trigger=RCVImport.Trigger.MANUAL, **kw
    )


def _ventas() -> dict:
    return load_fixture("rcv_ventas_202610")


def _drop_folio(body: dict, folio: int) -> dict:
    body["ventas"]["detalleVentas"] = [
        d for d in body["ventas"]["detalleVentas"] if d["folio"] != folio
    ]
    return body


def _summary(body: dict, dte_type: int) -> dict:
    return next(s for s in body["ventas"]["resumenes"] if s["tipoDte"] == dte_type)


def _run(body: dict, key: str = "TEST-KEY-1", sleep=None) -> RCVImport:
    imp = _import()
    return rcv_service.execute_import(
        imp, client_factory=FakeClient({key: [ok(body)]}), sleep=sleep or _no_sleep()
    )


# ── Importación exitosa y upsert ─────────────────────────────────────────────


@pytest.mark.django_db
def test_import_sales_creates_documents_and_summaries():
    make_rcv_settings()
    key = make_api_key()
    imp = _run(_ventas())

    assert imp.status == RCVImport.Status.SUCCESS, imp.error_message
    assert imp.received_count == imp.created_count == 4
    assert imp.updated_count == 0
    assert imp.missing_count == 0
    assert imp.warnings == []
    assert imp.started_at is not None and imp.finished_at is not None
    assert imp.api_key == key
    assert imp.raw_response["caratula"]["periodo"] == "202610"

    summaries = {s.dte_type: s for s in RCVImportSummary.objects.filter(rcv_import=imp)}
    assert set(summaries) == {33, 39, 48}
    assert summaries[48].has_detail is False
    assert summaries[48].document_count == 401
    assert summaries[33].has_detail is True
    assert summaries[33].detail_count == 2
    assert summaries[33].detail_total == Decimal("74000")

    attempts = list(RCVImportAttempt.objects.filter(rcv_import=imp))
    assert [a.outcome for a in attempts] == [Outcome.OK]
    assert attempts[0].api_key == key
    assert attempts[0].http_status == 200

    docs = RCVDocument.objects.filter(direction=SALES, period="202610")
    assert docs.count() == 4
    doc = docs.get(folio=6446)
    assert doc.company_rut == "11111111-1"
    assert doc.first_import == imp and doc.last_import == imp
    key.refresh_from_db()
    assert key.last_used_at == FIXED_NOW


@pytest.mark.django_db
def test_reimport_updates_without_duplicates():
    make_rcv_settings()
    make_api_key()
    first = _run(_ventas())

    body = _ventas()
    next(d for d in body["ventas"]["detalleVentas"] if d["folio"] == 6446)["montoTotal"] = 51000
    _summary(body, 33)["montoTotal"] = 75000
    second = _run(body)

    assert second.status == RCVImport.Status.SUCCESS, second.error_message
    assert second.warnings == []
    assert RCVDocument.objects.count() == 4
    assert second.updated_count == 4
    assert second.created_count == 0
    doc = RCVDocument.objects.get(folio=6446)
    assert doc.total_amount == Decimal("51000")
    assert doc.first_import == first
    assert doc.last_import == second


@pytest.mark.django_db
def test_missing_documents_are_flagged_and_cleared():
    make_rcv_settings()
    make_api_key()
    _run(_ventas())

    body = _drop_folio(_ventas(), 72013)
    _summary(body, 39).update(totalDocumentos=1, montoTotal=9100)
    second = _run(body)
    assert second.status == RCVImport.Status.SUCCESS
    assert second.warnings == []
    assert second.missing_count == 1
    assert RCVDocument.objects.get(folio=72013).missing_since_import == second
    assert RCVDocument.objects.filter(missing_since_import__isnull=False).count() == 1

    third = _run(_ventas())
    assert third.missing_count == 0
    doc = RCVDocument.objects.get(folio=72013)
    assert doc.missing_since_import is None
    assert doc.last_import == third


@pytest.mark.django_db
def test_truncated_detail_warns_and_skips_missing():
    make_rcv_settings()
    make_api_key()
    _run(_ventas())

    body = _drop_folio(_ventas(), 72013)  # resumen 39 sigue diciendo 2 documentos
    second = _run(body)
    assert second.status == RCVImport.Status.SUCCESS
    assert second.warnings == [
        "El detalle del tipo 39 no cuadra con el resumen del SII (1/2 documentos)."
    ]
    assert second.missing_count == 0
    assert not RCVDocument.objects.filter(missing_since_import__isnull=False).exists()
    summary = RCVImportSummary.objects.get(rcv_import=second, dte_type=39)
    assert summary.detail_count == 1
    assert summary.detail_total == Decimal("9100")


@pytest.mark.django_db
def test_company_rut_mismatch_warns_but_imports_with_configured_rut():
    make_rcv_settings()
    make_api_key()
    body = _ventas()
    body["caratula"]["rutEmpresa"] = "33.333.333-3"
    imp = _run(body)
    assert imp.status == RCVImport.Status.SUCCESS
    assert imp.warnings == [
        "El RUT de la respuesta (33333333-3) no coincide con el configurado (11111111-1)."
    ]
    assert set(RCVDocument.objects.values_list("company_rut", flat=True)) == {"11111111-1"}


@pytest.mark.django_db
def test_format_error_fails():
    make_rcv_settings()
    make_api_key()
    imp = _run({"caratula": {"periodo": "202610"}})
    assert imp.status == RCVImport.Status.FAILED
    assert imp.error_code == "FORMAT"
    assert imp.finished_at is not None
    assert RCVDocument.objects.count() == 0


# ── Rotación de keys y errores ───────────────────────────────────────────────


@pytest.mark.django_db
def test_quota_exhausted_rotates_key():
    make_rcv_settings()
    k1 = make_api_key("TEST-KEY-1")
    k2 = make_api_key("TEST-KEY-2")
    fake = FakeClient(
        {
            "TEST-KEY-1": [error(Outcome.QUOTA_EXHAUSTED, 402)],
            "TEST-KEY-2": [ok(_ventas())],
        }
    )
    imp = rcv_service.execute_import(_import(), client_factory=fake, sleep=_no_sleep())

    assert imp.status == RCVImport.Status.SUCCESS, imp.error_message
    attempts = list(RCVImportAttempt.objects.filter(rcv_import=imp))
    assert [(a.api_key_id, a.outcome) for a in attempts] == [
        (k1.id, Outcome.QUOTA_EXHAUSTED),
        (k2.id, Outcome.OK),
    ]
    k1.refresh_from_db()
    assert k1.exhausted_until == date(2026, 12, 1)
    assert k1.last_error
    assert imp.api_key == k2


@pytest.mark.django_db
def test_auth_key_error_rotates_key():
    make_rcv_settings()
    k1 = make_api_key("TEST-KEY-1")
    make_api_key("TEST-KEY-2")
    fake = FakeClient({"TEST-KEY-1": [error(Outcome.AUTH_KEY, 401)], "TEST-KEY-2": [ok(_ventas())]})
    imp = rcv_service.execute_import(_import(), client_factory=fake, sleep=_no_sleep())
    assert imp.status == RCVImport.Status.SUCCESS
    k1.refresh_from_db()
    assert k1.exhausted_until == date(2026, 12, 1)


@pytest.mark.django_db
def test_all_keys_exhausted_fails_with_date():
    make_rcv_settings()
    make_api_key("TEST-KEY-1")
    make_api_key("TEST-KEY-2")
    fake = FakeClient(
        {
            "TEST-KEY-1": [error(Outcome.QUOTA_EXHAUSTED, 402)],
            "TEST-KEY-2": [error(Outcome.QUOTA_EXHAUSTED, 402)],
        }
    )
    imp = rcv_service.execute_import(_import(), client_factory=fake, sleep=_no_sleep())
    assert imp.status == RCVImport.Status.FAILED
    assert imp.error_code == "NO_QUOTA"
    assert "01-12-2026" in imp.error_message
    assert imp.error_message == rcv_service.QUOTA_MESSAGE.format(date=date(2026, 12, 1))
    assert imp.attempts.count() == 2
    assert imp.finished_at is not None


@pytest.mark.django_db
def test_no_active_keys_fails():
    make_rcv_settings()
    make_api_key(is_active=False)
    imp = rcv_service.execute_import(_import(), client_factory=FakeClient({}), sleep=_no_sleep())
    assert imp.status == RCVImport.Status.FAILED
    assert imp.error_code == "NO_QUOTA"
    assert imp.error_message == rcv_service.NO_KEYS_MESSAGE
    assert imp.attempts.count() == 0


@pytest.mark.django_db
def test_sii_auth_error_does_not_rotate():
    make_rcv_settings()
    make_api_key("TEST-KEY-1")
    k2 = make_api_key("TEST-KEY-2")
    fake = FakeClient({"TEST-KEY-1": [error(Outcome.AUTH_SII, 400)], "TEST-KEY-2": []})
    imp = rcv_service.execute_import(_import(), client_factory=fake, sleep=_no_sleep())

    assert imp.status == RCVImport.Status.FAILED
    assert imp.error_code == "AUTH_SII"
    assert imp.error_message == "El SII rechazó la clave del usuario 22222222-2."
    assert imp.attempts.count() == 1
    k2.refresh_from_db()
    assert k2.last_used_at is None
    assert not RCVImportAttempt.objects.filter(api_key=k2).exists()


@pytest.mark.django_db
def test_rate_limit_retries_same_key():
    make_rcv_settings()
    k1 = make_api_key("TEST-KEY-1")
    make_api_key("TEST-KEY-2")
    reset = FIXED_NOW + timedelta(seconds=30)
    fake = FakeClient(
        {
            "TEST-KEY-1": [
                error(Outcome.RATE_LIMITED, 429, rate_limit_reset=reset),
                ok(_ventas()),
            ]
        }
    )
    sleep = _no_sleep()
    imp = rcv_service.execute_import(_import(), client_factory=fake, sleep=sleep)

    assert imp.status == RCVImport.Status.SUCCESS, imp.error_message
    assert sleep.call_count == 1
    assert sleep.call_args.args[0] == 30
    attempts = list(RCVImportAttempt.objects.filter(rcv_import=imp))
    assert [(a.api_key_id, a.outcome) for a in attempts] == [
        (k1.id, Outcome.RATE_LIMITED),
        (k1.id, Outcome.OK),
    ]
    k1.refresh_from_db()
    assert k1.exhausted_until is None


@pytest.mark.django_db
def test_rate_limit_gives_up_after_two_retries():
    make_rcv_settings()
    make_api_key("TEST-KEY-1")
    fake = FakeClient({"TEST-KEY-1": [error(Outcome.RATE_LIMITED, 429)] * 3})
    sleep = _no_sleep()
    imp = rcv_service.execute_import(_import(), client_factory=fake, sleep=sleep)
    assert imp.status == RCVImport.Status.FAILED
    assert imp.error_code == "RATE_LIMITED"
    assert imp.attempts.count() == 3
    assert [c.args[0] for c in sleep.call_args_list] == [60, 60]


@pytest.mark.django_db
def test_transient_fails_without_retry():
    make_rcv_settings()
    make_api_key("TEST-KEY-1")
    make_api_key("TEST-KEY-2")
    fake = FakeClient({"TEST-KEY-1": [error(Outcome.TRANSIENT, 0)]})
    imp = rcv_service.execute_import(_import(), client_factory=fake, sleep=_no_sleep())
    assert imp.status == RCVImport.Status.FAILED
    assert imp.error_code == "TRANSIENT"
    assert imp.error_message == rcv_service.TRANSIENT_MESSAGE
    assert imp.attempts.count() == 1
    assert imp.attempts.get().http_status == 0


@pytest.mark.django_db
def test_unexpected_exception_marks_internal_and_reraises():
    make_rcv_settings()
    make_api_key()

    class Boom(Exception):
        pass

    def factory(_key):
        raise Boom(SII_PASSWORD)

    imp = _import()
    with pytest.raises(Boom):
        rcv_service.execute_import(imp, client_factory=factory, sleep=_no_sleep())
    imp.refresh_from_db()
    assert imp.status == RCVImport.Status.FAILED
    assert imp.error_code == "INTERNAL"
    assert SII_PASSWORD not in imp.error_message
    assert imp.finished_at is not None


@pytest.mark.django_db
def test_select_api_key_prefers_least_used_and_skips_full():
    today = date(2026, 11, 14)
    k1 = make_api_key("TEST-KEY-1")
    k2 = make_api_key("TEST-KEY-2")
    k3 = make_api_key("TEST-KEY-3")
    k4 = make_api_key("TEST-KEY-4", exhausted_until=date(2026, 11, 1))
    make_api_key("TEST-KEY-5", exhausted_until=date(2026, 12, 1))
    make_api_key("TEST-KEY-6", is_active=False)
    imp = _import()
    for key, uses in ((k1, 10), (k2, 3), (k3, 1), (k4, 2)):
        RCVImportAttempt.objects.bulk_create(
            [RCVImportAttempt(rcv_import=imp, api_key=key, outcome=Outcome.OK)] * uses
        )

    assert rcv_service.select_api_key(today) == k3
    k3.refresh_from_db()
    assert k3.last_used_at == FIXED_NOW
    RCVImportAttempt.objects.bulk_create(
        [RCVImportAttempt(rcv_import=imp, api_key=k3, outcome=Outcome.OK)] * 2
    )
    assert rcv_service.select_api_key(today) == k4  # k4 (2) y k2 (3); k3 ahora 3
    RCVImportAttempt.objects.bulk_create(
        [RCVImportAttempt(rcv_import=imp, api_key=k4, outcome=Outcome.OK)] * 8
    )
    RCVImportAttempt.objects.bulk_create(
        [RCVImportAttempt(rcv_import=imp, api_key=k, outcome=Outcome.OK) for k in (k2, k3)] * 7
    )
    assert rcv_service.select_api_key(today) is None


@pytest.mark.django_db
def test_usage_counts_only_current_month():
    k1 = make_api_key("TEST-KEY-1")
    imp = _import()
    old = RCVImportAttempt.objects.create(rcv_import=imp, api_key=k1, outcome=Outcome.OK)
    RCVImportAttempt.objects.filter(pk=old.pk).update(
        created_at=datetime(2026, 10, 31, 23, 0, tzinfo=dt_timezone.utc)
    )
    RCVImportAttempt.objects.create(rcv_import=imp, api_key=k1, outcome=Outcome.TRANSIENT)
    from accounting.selectors import rcv_key_usage

    assert rcv_key_usage(date(2026, 11, 1)) == {k1.id: 1}


# ── create_imports ───────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_create_imports_rejects_running_duplicate():
    _import(SALES, status=RCVImport.Status.RUNNING)
    with pytest.raises(ValidationError):
        rcv_service.create_imports(2026, 10, [SALES], RCVImport.Trigger.MANUAL)
    created = rcv_service.create_imports(2026, 10, [PURCHASES], RCVImport.Trigger.MANUAL)
    assert len(created) == 1
    assert created[0].direction == PURCHASES
    assert created[0].status == RCVImport.Status.QUEUED


@pytest.mark.django_db
def test_create_imports_allows_after_finished_and_rejects_future():
    _import(SALES, status=RCVImport.Status.SUCCESS)
    _import(SALES, status=RCVImport.Status.FAILED)
    created = rcv_service.create_imports(2026, 11, [SALES, PURCHASES], RCVImport.Trigger.SCHEDULED)
    assert [i.direction for i in created] == [SALES, PURCHASES]
    with pytest.raises(ValidationError):
        rcv_service.create_imports(2026, 12, [SALES], RCVImport.Trigger.MANUAL)
    with pytest.raises(ValidationError):
        rcv_service.create_imports(2026, 13, [SALES], RCVImport.Trigger.MANUAL)
    with pytest.raises(ValidationError):
        rcv_service.create_imports(2026, 10, ["OTHER"], RCVImport.Trigger.MANUAL)


def test_month_helpers():
    assert rcv_service.month_start(date(2026, 11, 14)) == date(2026, 11, 1)
    assert rcv_service.next_month_start(date(2026, 11, 14)) == date(2026, 12, 1)
    assert rcv_service.next_month_start(date(2026, 12, 31)) == date(2027, 1, 1)


# ── Configuración y secretos ─────────────────────────────────────────────────


@pytest.mark.django_db
def test_missing_config_fails():
    make_rcv_settings(password="")
    make_api_key()
    imp = rcv_service.execute_import(_import(), client_factory=FakeClient({}), sleep=_no_sleep())
    assert imp.status == RCVImport.Status.FAILED
    assert imp.error_code == "CONFIG"
    assert imp.error_message
    assert imp.attempts.count() == 0
    assert imp.finished_at is not None


@pytest.mark.django_db
def test_secrets_never_persisted():
    secret_key = "TEST-KEY-0000-0000-4472"
    make_rcv_settings()
    make_api_key(secret_key)
    body = _ventas()
    body["eco"] = {"PasswordSII": SII_PASSWORD, "Authorization": secret_key}  # eco hipotético
    ok_imp = _run(body, key=secret_key)
    assert ok_imp.status == RCVImport.Status.SUCCESS

    fake = FakeClient({secret_key: [error(Outcome.OTHER, 400, "SimpleAPI HTTP 400: *** inválida")]})
    failed = rcv_service.execute_import(_import(), client_factory=fake, sleep=_no_sleep())
    assert failed.status == RCVImport.Status.FAILED
    assert failed.error_code == "OTHER"

    for imp in (ok_imp, failed):
        imp.refresh_from_db()
        texts = [str(imp.raw_response), imp.error_message, str(imp.warnings)]
        texts += list(imp.attempts.values_list("error_message", flat=True))
        for text in texts:
            assert secret_key not in text
            assert SII_PASSWORD not in text
    assert secret_key not in str(RCVApiKey.objects.values_list("last_error", flat=True))


# ── Sin N+1 ──────────────────────────────────────────────────────────────────


def _synthetic_body(n: int) -> dict:
    body = _ventas()
    template = body["ventas"]["detalleVentas"][0]
    docs = []
    for i in range(n):
        doc = dict(template, folio=10_000 + i, rutCliente=f"{70_000_000 + i}-1", montoTotal=1000)
        docs.append(doc)
    body["ventas"]["detalleVentas"] = docs
    body["ventas"]["resumenes"] = [dict(_summary(body, 33), totalDocumentos=n, montoTotal=1000 * n)]
    return body


def _apply_query_counts(n: int) -> tuple[int, int]:
    counts = []
    for _ in range(2):  # primera: crea; segunda: actualiza
        imp = _import()
        report = normalize_report(SALES, _synthetic_body(n))
        with CaptureQueriesContext(connection) as ctx:
            rcv_service.apply_report(imp, report)
        counts.append(len(ctx.captured_queries))
    return counts[0], counts[1]


@pytest.mark.django_db
def test_apply_report_query_count_constant(django_assert_max_num_queries):
    make_rcv_settings()
    RCVSettings.get_settings()  # caché del singleton tibia: no cuenta como query del upsert
    small = _apply_query_counts(4)
    RCVDocument.objects.all().delete()
    large = _apply_query_counts(40)
    assert small == large
    imp, report = _import(), normalize_report(SALES, _synthetic_body(40))
    with django_assert_max_num_queries(max(large)):
        rcv_service.apply_report(imp, report)
