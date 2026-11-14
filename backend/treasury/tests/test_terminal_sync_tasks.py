from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from django.conf import settings as django_settings
from django.utils import timezone

from config.celery import app as celery_app
from treasury import tasks
from treasury.integrations.tuu_client import TuuAuthError, TuuTransientError
from treasury.models import TerminalSyncRun, TerminalSyncSettings
from treasury.terminal_sync_service import AUTH_MESSAGE
from treasury.tests.helpers import make_terminal_provider

pytestmark = pytest.mark.django_db

SANTIAGO = ZoneInfo("America/Santiago")


def _freeze(monkeypatch, hour, minute=10):
    # Fecha local real (create_run usa timezone.now()); solo se fija la hora del día.
    today = timezone.localtime().date()
    frozen = datetime(today.year, today.month, today.day, hour, minute, tzinfo=SANTIAGO)
    monkeypatch.setattr(tasks, "_now", lambda: frozen)


def _configure(**kwargs):
    cfg = TerminalSyncSettings.get_settings()
    cfg.enabled = kwargs.pop("enabled", True)
    for key, value in kwargs.items():
        setattr(cfg, key, value)
    cfg.save()
    return cfg


def _keyed_provider():
    provider = make_terminal_provider()
    provider.set_api_key("k")
    provider.save()
    return provider


@pytest.fixture(autouse=True)
def _eager_without_propagation(settings, monkeypatch):
    # conftest propaga excepciones en modo eager; los reintentos eager lo requieren apagado.
    settings.CELERY_TASK_EAGER_PROPAGATES = False
    monkeypatch.setattr(celery_app.conf, "task_eager_propagates", False)


@pytest.fixture
def enqueued(monkeypatch):
    calls = []
    monkeypatch.setattr(tasks.sync_terminal_run, "delay", lambda run_id: calls.append(run_id))
    return calls


def test_dispatcher_disabled_does_nothing(monkeypatch, enqueued):
    _configure(enabled=False, run_hour=3)
    _keyed_provider()
    _freeze(monkeypatch, 5)
    assert tasks.dispatch_terminal_sales_sync() == 0
    assert enqueued == []
    assert TerminalSyncRun.objects.count() == 0


def test_dispatcher_before_run_hour_does_nothing(monkeypatch, enqueued):
    _configure(run_hour=3)
    _keyed_provider()
    _freeze(monkeypatch, 2)
    assert tasks.dispatch_terminal_sales_sync() == 0
    assert enqueued == []
    assert TerminalSyncRun.objects.count() == 0


def test_dispatcher_runs_once_per_provider_per_day(monkeypatch, enqueued):
    _configure(run_hour=3)
    a, b = _keyed_provider(), _keyed_provider()
    _freeze(monkeypatch, 3)
    assert tasks.dispatch_terminal_sales_sync() == 2
    TerminalSyncRun.objects.filter(provider=a).update(status=TerminalSyncRun.Status.FAILED)
    _freeze(monkeypatch, 4)
    assert tasks.dispatch_terminal_sales_sync() == 0
    for provider in (a, b):
        runs = TerminalSyncRun.objects.filter(
            provider=provider, trigger=TerminalSyncRun.Trigger.SCHEDULED
        )
        assert runs.count() == 1
    assert len(enqueued) == 2


def test_dispatcher_skips_inactive_and_keyless_providers(monkeypatch, enqueued):
    _configure(run_hour=3)
    ok = _keyed_provider()
    make_terminal_provider()  # sin key
    inactive = _keyed_provider()
    inactive.is_active = False
    inactive.save()
    _freeze(monkeypatch, 3)
    assert tasks.dispatch_terminal_sales_sync() == 1
    assert list(TerminalSyncRun.objects.values_list("provider_id", flat=True)) == [ok.pk]


def test_dispatcher_skips_when_no_daily_range(monkeypatch, enqueued):
    _configure(run_hour=3, history_start_date=timezone.localtime().date() + timedelta(days=1))
    _keyed_provider()
    _freeze(monkeypatch, 3)
    assert tasks.dispatch_terminal_sales_sync() == 0
    assert TerminalSyncRun.objects.count() == 0


def _scheduled_run():
    from treasury.terminal_sync_service import create_run

    return create_run(
        _keyed_provider(),
        date(2026, 11, 12),
        date(2026, 11, 12),
        TerminalSyncRun.Trigger.SCHEDULED,
    )


def test_auth_error_fails_without_retry_and_hides_key(monkeypatch):
    class AuthClient:
        def __init__(self, api_key):
            pass

        def fetch_branch(self, *args, **kwargs):
            raise TuuAuthError("bad key k")

    monkeypatch.setattr("treasury.terminal_sync_service.TuuClient", AuthClient)
    run = _scheduled_run()
    assert tasks.sync_terminal_run.apply(args=[run.id]).get() == TerminalSyncRun.Status.FAILED
    run.refresh_from_db()
    assert run.status == TerminalSyncRun.Status.FAILED
    assert run.attempts == 1
    assert run.error_message == AUTH_MESSAGE
    assert "bad key" not in run.error_message


def test_transient_error_retries_then_fails(monkeypatch):
    _configure(max_retries=2, retry_delay_minutes=1)
    calls = []

    def boom(run, client=None):
        calls.append(1)
        raise TuuTransientError("timeout")

    monkeypatch.setattr(tasks, "execute_run", boom)
    run = _scheduled_run()
    tasks.sync_terminal_run.apply(args=[run.id])
    run.refresh_from_db()
    assert len(calls) == 3
    assert run.attempts == 3
    assert run.status == TerminalSyncRun.Status.FAILED
    assert run.error_message == "TUU no respondió tras 3 intentos"
    assert run.finished_at is not None


def test_transient_error_honors_max_retries_above_celery_default(monkeypatch):
    _configure(max_retries=5, retry_delay_minutes=1)
    calls = []

    def boom(run, client=None):
        calls.append(1)
        raise TuuTransientError("timeout")

    monkeypatch.setattr(tasks, "execute_run", boom)
    run = _scheduled_run()
    tasks.sync_terminal_run.apply(args=[run.id])
    run.refresh_from_db()
    assert len(calls) == 6
    assert run.attempts == 6
    assert run.status == TerminalSyncRun.Status.FAILED
    assert run.error_message == "TUU no respondió tras 6 intentos"


def test_transient_error_then_success_returns_final_status(monkeypatch):
    _configure(max_retries=2, retry_delay_minutes=1)
    calls = []

    def flaky(run, client=None):
        calls.append(1)
        if len(calls) == 1:
            raise TuuTransientError("timeout")
        run.status = TerminalSyncRun.Status.SUCCESS
        run.save()
        return run

    monkeypatch.setattr(tasks, "execute_run", flaky)
    run = _scheduled_run()
    tasks.sync_terminal_run.apply(args=[run.id])
    run.refresh_from_db()
    assert run.attempts == 2
    assert run.status == TerminalSyncRun.Status.SUCCESS


def test_beat_entry_matches_registered_task():
    entry = django_settings.CELERY_BEAT_SCHEDULE["dispatch_terminal_sales_sync_hourly"]
    assert entry["task"] in celery_app.tasks


def test_dispatcher_marks_run_failed_when_broker_down(monkeypatch):
    _freeze(monkeypatch, 9)
    _configure(run_hour=3)
    _keyed_provider()

    def boom(run_id):
        raise ConnectionError("broker down")

    monkeypatch.setattr(tasks.sync_terminal_run, "delay", boom)
    assert tasks.dispatch_terminal_sales_sync() == 1
    run = TerminalSyncRun.objects.get()
    assert run.status == TerminalSyncRun.Status.FAILED
    assert run.finished_at is not None
