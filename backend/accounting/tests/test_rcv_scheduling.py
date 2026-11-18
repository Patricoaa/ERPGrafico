from datetime import date, datetime, timedelta
from unittest.mock import MagicMock
from zoneinfo import ZoneInfo

import pytest
from django.conf import settings as django_settings
from django.utils import timezone

from accounting import rcv_service, tasks
from accounting.models import RCVImport, RCVSettings
from accounting.tests.rcv_helpers import make_rcv_settings
from config.celery import app as celery_app

pytestmark = pytest.mark.django_db

SANTIAGO = ZoneInfo("America/Santiago")
PURCHASES = RCVImport.Direction.PURCHASES
SALES = RCVImport.Direction.SALES


def test_period_for():
    assert rcv_service.period_for(date(2026, 11, 2)) == (2026, 10)
    assert rcv_service.period_for(date(2026, 11, 3)) == (2026, 10)
    assert rcv_service.period_for(date(2026, 11, 4)) == (2026, 11)
    assert rcv_service.period_for(date(2026, 11, 20)) == (2026, 11)
    assert rcv_service.period_for(date(2027, 1, 2)) == (2026, 12)


def test_is_scheduled_run_due():
    now = datetime(2026, 11, 20, 6, 30, tzinfo=SANTIAGO)
    cfg = RCVSettings(enabled=True, run_hour=6, interval_days=7)
    due = rcv_service.is_scheduled_run_due
    assert due(RCVSettings(enabled=False, run_hour=6), now, None) is False
    assert due(cfg, now.replace(hour=5), None) is False
    assert due(cfg, now, now.date() - timedelta(days=6)) is False
    assert due(cfg, now, now.date() - timedelta(days=7)) is True
    assert due(cfg, now, None) is True


def _success(direction, year, month, started):
    return RCVImport.objects.create(
        direction=direction,
        year=year,
        month=month,
        trigger=RCVImport.Trigger.MANUAL,
        status=RCVImport.Status.SUCCESS,
        started_at=started,
    )


def test_scheduled_targets_adds_previous_month_when_not_closed():
    today = date(2026, 11, 20)
    both = [PURCHASES, SALES]
    assert rcv_service.scheduled_targets(today, both) == [
        (2026, 10, PURCHASES),
        (2026, 10, SALES),
        (2026, 11, PURCHASES),
        (2026, 11, SALES),
    ]
    _success(SALES, 2026, 10, datetime(2026, 11, 2, 9, 0, tzinfo=SANTIAGO))
    assert rcv_service.scheduled_targets(today, both) == [
        (2026, 10, PURCHASES),
        (2026, 11, PURCHASES),
        (2026, 11, SALES),
    ]


def test_scheduled_targets_ignores_success_before_month_end():
    _success(SALES, 2026, 10, datetime(2026, 10, 31, 23, 0, tzinfo=SANTIAGO))
    assert (2026, 10, SALES) in rcv_service.scheduled_targets(date(2026, 11, 20), [SALES])


def test_scheduled_targets_january_previous_is_december():
    targets = rcv_service.scheduled_targets(date(2027, 1, 20), [SALES])
    assert targets == [(2026, 12, SALES), (2027, 1, SALES)]


def test_estimated_monthly_queries():
    both = RCVSettings(interval_days=7, include_purchases=True, include_sales=True)
    assert rcv_service.estimated_monthly_queries(both) == 12
    sales = RCVSettings(interval_days=30, include_purchases=False, include_sales=True)
    assert rcv_service.estimated_monthly_queries(sales) == 2


def _fix_now(monkeypatch, day=20, hour=7):
    frozen = datetime(2026, 11, day, hour, 20, tzinfo=SANTIAGO)
    monkeypatch.setattr(tasks, "_now", lambda: frozen)
    # create_imports valida contra la fecha local real; basta con que no sea futura
    monkeypatch.setattr(timezone, "localdate", lambda *a, **k: frozen.date())


def test_dispatch_creates_and_enqueues(monkeypatch, django_capture_on_commit_callbacks):
    _fix_now(monkeypatch)
    make_rcv_settings(enabled=True, run_hour=6)
    delay = MagicMock()
    monkeypatch.setattr(tasks.run_rcv_imports, "delay", delay)
    with django_capture_on_commit_callbacks(execute=True):
        assert tasks.dispatch_rcv_imports() == 4
    delay.assert_called_once()
    assert len(delay.call_args.args[0]) == 4
    assert RCVImport.objects.filter(trigger=RCVImport.Trigger.SCHEDULED).count() == 4
    assert tasks.dispatch_rcv_imports() == 0
    delay.assert_called_once()


def test_dispatch_disabled_does_nothing(monkeypatch):
    _fix_now(monkeypatch)
    make_rcv_settings(enabled=False)
    assert tasks.dispatch_rcv_imports() == 0
    assert not RCVImport.objects.exists()


def test_dispatch_skips_duplicates(monkeypatch):
    _fix_now(monkeypatch)
    make_rcv_settings(enabled=True, run_hour=6, include_purchases=False)
    RCVImport.objects.create(direction=SALES, year=2026, month=11, trigger=RCVImport.Trigger.MANUAL)
    monkeypatch.setattr(tasks.run_rcv_imports, "delay", MagicMock())
    assert tasks.dispatch_rcv_imports() == 1  # solo octubre


def test_dispatch_marks_failed_when_broker_down(monkeypatch, django_capture_on_commit_callbacks):
    _fix_now(monkeypatch)
    make_rcv_settings(enabled=True, run_hour=6, include_purchases=False)

    def boom(ids):
        raise ConnectionError("broker down")

    monkeypatch.setattr(tasks.run_rcv_imports, "delay", boom)
    with django_capture_on_commit_callbacks(execute=True):
        assert tasks.dispatch_rcv_imports() == 2
    assert set(RCVImport.objects.values_list("status", "error_code")) == {
        (RCVImport.Status.FAILED, "ENQUEUE")
    }


def test_dispatch_recovers_stale_imports_first(monkeypatch):
    make_rcv_settings(enabled=False)
    stale = RCVImport.objects.create(
        direction=SALES, year=2026, month=10, trigger=RCVImport.Trigger.SCHEDULED
    )
    RCVImport.objects.filter(pk=stale.pk).update(
        created_at=timezone.now() - timedelta(minutes=rcv_service.STALE_IMPORT_MINUTES + 1)
    )
    assert tasks.dispatch_rcv_imports() == 0
    stale.refresh_from_db()
    assert stale.status == RCVImport.Status.FAILED
    assert stale.error_code == "INTERRUPTED"
    assert stale.finished_at is not None


def _queued(month=11):
    return RCVImport.objects.create(
        direction=SALES, year=2026, month=month, trigger=RCVImport.Trigger.SCHEDULED
    )


def test_run_rcv_imports_sequential(monkeypatch):
    first, second = _queued(), _queued(month=10)
    sleep = MagicMock()
    monkeypatch.setattr(tasks.time, "sleep", sleep)

    def fake_execute(rcv_import):
        rcv_import.status = RCVImport.Status.SUCCESS
        return rcv_import

    monkeypatch.setattr(tasks.rcv_service, "execute_import", fake_execute)
    assert tasks.run_rcv_imports([first.id, second.id]) == ["SUCCESS", "SUCCESS"]
    sleep.assert_called_once_with(15)


def test_run_rcv_imports_continues_after_exception(monkeypatch):
    first, second = _queued(), _queued(month=10)
    monkeypatch.setattr(tasks.time, "sleep", MagicMock())
    calls = []

    def fake_execute(rcv_import):
        calls.append(rcv_import.id)
        if rcv_import.id == first.id:
            raise RuntimeError("secreto-xyz")
        rcv_import.status = RCVImport.Status.SUCCESS
        return rcv_import

    monkeypatch.setattr(tasks.rcv_service, "execute_import", fake_execute)
    assert tasks.run_rcv_imports([first.id, second.id]) == ["QUEUED", "SUCCESS"]
    assert calls == [first.id, second.id]


def test_beat_entry_matches_registered_task():
    entry = django_settings.CELERY_BEAT_SCHEDULE["dispatch_rcv_imports_hourly"]
    assert entry["task"] in celery_app.tasks


def _run_with_fakes(monkeypatch, direction, delay):
    from tax.tasks import run_fiscal_match

    rcv_import = RCVImport.objects.create(
        direction=direction, year=2026, month=11, trigger=RCVImport.Trigger.SCHEDULED
    )

    def fake_execute(i):
        i.status = RCVImport.Status.SUCCESS
        return i

    monkeypatch.setattr(tasks.rcv_service, "execute_import", fake_execute)
    monkeypatch.setattr(run_fiscal_match, "delay", delay)
    tasks.run_rcv_imports([rcv_import.id])


@pytest.mark.parametrize("direction", [SALES, RCVImport.Direction.PURCHASES])
def test_rcv_import_enqueues_fiscal_match(monkeypatch, django_capture_on_commit_callbacks, direction):
    calls = []
    with django_capture_on_commit_callbacks(execute=True):
        _run_with_fakes(monkeypatch, direction, lambda: calls.append(1))
    assert calls == [1]


def test_rcv_enqueue_error_does_not_fail_import(monkeypatch, django_capture_on_commit_callbacks, caplog):
    def boom():
        raise ConnectionError("broker down")

    with django_capture_on_commit_callbacks(execute=True):
        _run_with_fakes(monkeypatch, SALES, boom)
    assert "cuadre" in caplog.text
