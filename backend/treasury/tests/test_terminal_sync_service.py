import copy
import json
from datetime import date
from pathlib import Path

import pytest
from django.core.exceptions import ValidationError

from treasury.integrations.tuu_client import (
    REPORT_BRANCH_CARD,
    REPORT_BRANCH_CASH,
    REPORT_GENERAL,
    TuuAuthError,
    TuuError,
    TuuPage,
    TuuPlanError,
    TuuTransientError,
)
from treasury.models import (
    PaymentTerminalDevice,
    TerminalSale,
    TerminalSyncPayload,
    TerminalSyncRun,
    TerminalSyncSettings,
)
from treasury.terminal_sync_service import (
    create_run,
    daily_range,
    eligible_providers,
    execute_run,
    manual_range,
    split_range,
)
from treasury.tests.helpers import make_terminal_provider

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).parent / "fixtures" / "tuu"
SERIAL = "6010B232530402079"


def _load(name):
    return json.loads((FIXTURES / f"{name}.json").read_text())


def _pages(report, names, rows_of):
    bodies = [_load(n) for n in names]
    return [
        TuuPage(
            report=report,
            page=i + 1,
            total_pages=len(bodies),
            http_status=200,
            request_body={"page": i + 1},
            response_body=body,
            rows=rows_of(body),
        )
        for i, body in enumerate(bodies)
    ]


def _branch_rows(body):
    return body["data"]["transactions"]


def _general_rows(body):
    return body["content"]["reports"]


def _a():
    return _pages(REPORT_BRANCH_CARD, ["branch_card_p1", "branch_card_p2"], _branch_rows)


def _b():
    return _pages(REPORT_BRANCH_CASH, ["branch_cash_p1", "branch_cash_p2"], _branch_rows)


def _c(reconciliation_id=None):
    pages = _pages(REPORT_GENERAL, ["general_p1", "general_p2", "general_p3"], _general_rows)
    if reconciliation_id is not None:
        for page in pages:
            for row in page.rows:
                for rec in row.get("reconciliations") or []:
                    rec["reconciliationId"] = reconciliation_id
    return pages


class FakeClient:
    """Cliente falso: ``chunks`` es una lista (una entrada por llamada de tramo)."""

    def __init__(self, c_pages=None, errors=None):
        self.c_pages = c_pages if c_pages is not None else _c()
        self.errors = errors or {}  # índice de tramo -> excepción
        self.chunk_calls = []

    def _check(self, start):
        idx = len(self.chunk_calls) - 1
        if idx in self.errors:
            raise self.errors[idx]

    def fetch_branch(self, start, end, cash):
        if not cash:
            self.chunk_calls.append((start, end))
        return _b() if cash else _a()

    def fetch_general(self, start, end):
        self._check(start)
        return copy.deepcopy(self.c_pages)


def _run(provider, start=date(2026, 10, 26), end=date(2026, 10, 26)):
    return create_run(provider, start, end, TerminalSyncRun.Trigger.MANUAL)


def test_split_range():
    assert split_range(date(2026, 1, 1), date(2026, 3, 1)) == [
        (date(2026, 1, 1), date(2026, 1, 30)),
        (date(2026, 1, 31), date(2026, 3, 1)),
    ]
    assert split_range(date(2026, 1, 1), date(2026, 1, 1)) == [(date(2026, 1, 1), date(2026, 1, 1))]


def test_daily_range_respects_history_floor():
    s = TerminalSyncSettings(lookback_days=7, history_start_date=date(2026, 11, 10))
    assert daily_range(s, date(2026, 11, 13)) == (date(2026, 11, 10), date(2026, 11, 12))
    s.history_start_date = None
    assert daily_range(s, date(2026, 11, 13)) == (date(2026, 11, 6), date(2026, 11, 12))
    s.history_start_date = date(2026, 11, 13)
    assert daily_range(s, date(2026, 11, 13)) is None


def test_manual_range_defaults_and_validation():
    today = date(2026, 11, 13)
    s = TerminalSyncSettings(lookback_days=7, history_start_date=None)
    assert manual_range(s, today, None, None) == (date(2026, 11, 6), today)
    s.history_start_date = date(2026, 1, 1)
    assert manual_range(s, today, None, None) == (date(2026, 1, 1), today)
    with pytest.raises(ValidationError):
        manual_range(s, today, date(2026, 11, 5), date(2026, 11, 1))
    with pytest.raises(ValidationError):
        manual_range(s, today, None, date(2026, 11, 14))


def test_eligible_providers():
    ok = make_terminal_provider()
    ok.set_api_key("k")
    ok.save()
    make_terminal_provider()  # sin key
    inactive = make_terminal_provider()
    inactive.set_api_key("k")
    inactive.is_active = False
    inactive.save()
    other = make_terminal_provider(provider_type="TRANSBANK")
    other.set_api_key("k")
    other.save()
    assert list(eligible_providers()) == [ok]


def test_create_run_is_running():
    run = _run(make_terminal_provider())
    assert run.status == TerminalSyncRun.Status.RUNNING
    assert run.started_at is not None


def test_execute_run_creates_sales_and_payloads():
    run = execute_run(_run(make_terminal_provider()), client=FakeClient())
    assert run.status == TerminalSyncRun.Status.SUCCESS
    assert run.created_count == 47
    assert run.fetched_count == 47
    assert run.finished_at is not None
    assert TerminalSale.objects.count() == 47
    assert TerminalSyncPayload.objects.filter(run=run).count() == 7


def test_device_linked_by_serial():
    provider = make_terminal_provider()
    device = PaymentTerminalDevice.objects.create(
        name="Caja", provider=provider, serial_number=SERIAL
    )
    execute_run(_run(provider), client=FakeClient())
    linked = TerminalSale.objects.filter(serial_number=SERIAL)
    assert linked.exists()
    assert all(s.device_id == device.pk for s in linked)

    other = make_terminal_provider()
    execute_run(_run(other), client=FakeClient())
    unlinked = TerminalSale.objects.filter(provider=other, serial_number=SERIAL)
    assert unlinked.exists()
    assert all(s.device is None for s in unlinked)


def test_resync_updates_settlement_without_duplicates():
    provider = make_terminal_provider()
    execute_run(_run(provider), client=FakeClient(_c("0")))
    assert TerminalSale.objects.filter(settlement_id="19720426").count() == 0
    run2 = execute_run(_run(provider), client=FakeClient(_c("19720426")))
    assert TerminalSale.objects.count() == 47
    assert TerminalSale.objects.filter(settlement_id="19720426").exists()
    assert run2.updated_count > 0
    assert run2.created_count == 0


def test_resync_without_changes_counts_no_updates():
    provider = make_terminal_provider()
    first = execute_run(_run(provider), client=FakeClient())
    second = execute_run(_run(provider), client=FakeClient())
    assert second.updated_count == 0
    sale = TerminalSale.objects.first()
    assert sale.first_seen_run_id == first.pk
    assert sale.last_seen_run_id == second.pk


def test_chunk_failure_keeps_previous_chunks():
    provider = make_terminal_provider()
    run = _run(provider, date(2026, 10, 1), date(2026, 11, 5))  # 2 tramos
    client = FakeClient(errors={1: TuuError("boom")})
    run = execute_run(run, client=client)
    assert run.status == TerminalSyncRun.Status.PARTIAL
    assert TerminalSale.objects.count() == 47
    assert "boom" in run.error_message
    # los crudos del tramo fallido (A y B) quedaron guardados
    assert TerminalSyncPayload.objects.filter(run=run, chunk_start=date(2026, 10, 31)).count() == 4


def test_all_chunks_failing_marks_failed():
    run = execute_run(_run(make_terminal_provider()), client=FakeClient(errors={0: TuuError("x")}))
    assert run.status == TerminalSyncRun.Status.FAILED
    assert run.finished_at is not None


def test_auth_error_marks_failed():
    run = _run(make_terminal_provider())
    run = execute_run(run, client=FakeClient(errors={0: TuuAuthError("secret-key-123")}))
    assert run.status == TerminalSyncRun.Status.FAILED
    assert "rechazada" in run.error_message
    assert "secret-key-123" not in run.error_message


def test_plan_error_marks_failed():
    run = execute_run(
        _run(make_terminal_provider()), client=FakeClient(errors={0: TuuPlanError("x")})
    )
    assert run.status == TerminalSyncRun.Status.FAILED
    assert "plan" in run.error_message


def test_transient_error_reraises_after_saving_progress():
    provider = make_terminal_provider()
    run = _run(provider, date(2026, 10, 1), date(2026, 11, 5))
    client = FakeClient(errors={1: TuuTransientError("timeout")})
    with pytest.raises(TuuTransientError):
        execute_run(run, client=client)
    run.refresh_from_db()
    assert run.status == TerminalSyncRun.Status.RUNNING
    assert run.finished_at is None
    assert run.created_count == 47
    assert run.error_message


def test_serial_conflict_adds_warning():
    provider = make_terminal_provider()
    execute_run(_run(provider), client=FakeClient())
    sale = TerminalSale.objects.filter(serial_number=SERIAL).first()
    TerminalSale.objects.filter(pk=sale.pk).update(serial_number="OTRO")
    run = execute_run(_run(provider), client=FakeClient())
    sale.refresh_from_db()
    assert sale.serial_number == "OTRO"
    assert any(sale.natural_key in w for w in run.warnings)
    assert run.status == TerminalSyncRun.Status.PARTIAL
    # el resto de los campos sí se refresca
    TerminalSale.objects.filter(pk=sale.pk).update(card_brand="CAMBIADA")
    execute_run(_run(provider), client=FakeClient())
    sale.refresh_from_db()
    assert sale.card_brand != "CAMBIADA"
    assert sale.serial_number == "OTRO"


def test_empty_stored_serial_is_filled_in_and_linked():
    provider = make_terminal_provider()
    device = PaymentTerminalDevice.objects.create(
        name="Caja", provider=provider, serial_number=SERIAL
    )
    execute_run(_run(provider), client=FakeClient())
    sale = TerminalSale.objects.filter(serial_number=SERIAL).first()
    TerminalSale.objects.filter(pk=sale.pk).update(serial_number="", device=None)
    run = execute_run(_run(provider), client=FakeClient())
    sale.refresh_from_db()
    assert sale.serial_number == SERIAL
    assert sale.device_id == device.pk
    assert not any(sale.natural_key in w for w in run.warnings)


def test_retry_after_transient_does_not_duplicate_payloads_or_counts():
    provider = make_terminal_provider()
    run = _run(provider, date(2026, 10, 1), date(2026, 11, 5))
    with pytest.raises(TuuTransientError):
        execute_run(run, client=FakeClient(errors={1: TuuTransientError("t")}))
    run = execute_run(run, client=FakeClient())
    assert run.status == TerminalSyncRun.Status.SUCCESS
    assert TerminalSyncPayload.objects.filter(run=run).count() == 14
    assert run.fetched_count == 94
    assert run.created_count == 47
    assert run.error_message == ""


def test_resync_refreshes_updated_at_and_counts_unchanged_in_one_query():
    provider = make_terminal_provider()
    execute_run(_run(provider), client=FakeClient())
    before = {s.pk: s.updated_at for s in TerminalSale.objects.all()}
    execute_run(_run(provider), client=FakeClient())
    assert all(s.updated_at > before[s.pk] for s in TerminalSale.objects.all())


def test_unexpected_exception_marks_failed_and_reraises(monkeypatch):
    run = _run(make_terminal_provider())

    def boom(*a, **k):
        raise RuntimeError("secret")

    monkeypatch.setattr("treasury.terminal_sync_service._upsert_chunk", boom)
    with pytest.raises(RuntimeError):
        execute_run(run, client=FakeClient())
    run.refresh_from_db()
    assert run.status == TerminalSyncRun.Status.FAILED
    assert run.error_message == "Error interno al sincronizar: RuntimeError"
    assert run.finished_at is not None


@pytest.mark.django_db
def test_unreadable_api_key_fails_run_instead_of_staying_running():
    from treasury.tests.helpers import make_terminal_provider

    provider = make_terminal_provider()
    provider.gateway_config = {"api_key_encrypted": "garbage-token"}
    provider.save()
    run = _run(provider)
    result = execute_run(run)
    run.refresh_from_db()
    assert result.pk == run.pk
    assert run.status == TerminalSyncRun.Status.FAILED
    assert run.error_message == "No se pudo leer la API key del proveedor. Vuelva a ingresarla."
    assert run.finished_at is not None
