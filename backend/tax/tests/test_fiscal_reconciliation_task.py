"""Tarea periódica del cuadre fiscal cada 10 minutos (ADR-0140 D4)."""

from datetime import date
from unittest.mock import patch

import pytest
from django.conf import settings
from django.core.cache import cache

from tax import tasks
from tax.tasks import LOCK_KEY, months_to_reconcile, run_fiscal_reconciliation
from tax.tests.reconciliation_helpers import set_match_settings

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _clean_lock():
    cache.delete(LOCK_KEY)
    yield
    cache.delete(LOCK_KEY)


def _patches(calls, **overrides):
    def mk(name, value):
        def fn(*args):
            calls.append((name, *args))
            if isinstance(value, Exception):
                raise value
            return value
        return fn

    values = {"terminal": {"t": 1}, "boletas": {"b": 1}, "issue": {"issued": 2, "failed": 0}}
    values.update(overrides)
    return (
        patch.object(tasks, "reconcile_terminal_sales", mk("terminal", values["terminal"])),
        patch.object(tasks, "reconcile_rcv_boletas", mk("boletas", values["boletas"])),
        patch.object(tasks, "issue_fiscal_drafts", mk("issue", values["issue"])),
    )


def _run(calls, today, **overrides):
    p1, p2, p3 = _patches(calls, **overrides)
    with p1, p2, p3, patch.object(tasks, "_local_today", return_value=today):
        return run_fiscal_reconciliation()


def test_months_to_reconcile():
    assert months_to_reconcile(date(2026, 11, 16)) == [(2026, 11)]
    assert months_to_reconcile(date(2026, 11, 10)) == [(2026, 11), (2026, 10)]
    assert months_to_reconcile(date(2026, 1, 3)) == [(2026, 1), (2025, 12)]


def test_runs_chain_in_order():
    set_match_settings(date(2026, 1, 1))
    calls = []
    result = _run(calls, date(2026, 11, 16))
    assert calls == [
        ("terminal", date(2026, 11, 1), date(2026, 11, 30)),
        ("boletas", 2026, 11),
        ("issue", 2026, 11),
        ("boletas", 2026, 11),
    ]
    assert result == {"months": {"2026-11": {
        "terminal": {"t": 1}, "boletas": {"b": 1}, "issued": {"issued": 2, "failed": 0},
    }}}
    assert cache.get(LOCK_KEY) is None


def test_includes_previous_month_first_days():
    set_match_settings(date(2026, 1, 1))
    calls = []
    result = _run(calls, date(2026, 11, 5))
    assert set(result["months"]) == {"2026-11", "2026-10"}
    assert ("terminal", date(2026, 10, 1), date(2026, 10, 31)) in calls


def test_lock_skips_concurrent_run():
    set_match_settings(date(2026, 1, 1))
    cache.add(LOCK_KEY, "1", timeout=540)
    calls = []
    assert _run(calls, date(2026, 11, 16)) == {"skipped": True}
    assert calls == []
    assert cache.get(LOCK_KEY) == "1"  # no libera el candado ajeno


def test_no_start_date_skips():
    set_match_settings(None)
    calls = []
    assert _run(calls, date(2026, 11, 16)) == {"skipped": True}
    assert calls == []
    assert cache.get(LOCK_KEY) is None


def test_step_failure_does_not_stop_others():
    set_match_settings(date(2026, 1, 1))
    calls = []
    result = _run(calls, date(2026, 11, 16), terminal=ValueError("x"))
    assert [c[0] for c in calls] == ["terminal", "boletas", "issue", "boletas"]
    month = result["months"]["2026-11"]
    assert month["terminal"] == {"error": "ValueError"}
    assert month["issued"] == {"issued": 2, "failed": 0}


def test_beat_schedule_registered():
    entry = settings.CELERY_BEAT_SCHEDULE["run_fiscal_reconciliation_10min"]
    assert entry["task"] == "tax.tasks.run_fiscal_reconciliation"
    assert entry["task"] == run_fiscal_reconciliation.name


def test_expired_lock_taken_by_other_run_is_not_released():
    set_match_settings(date(2026, 1, 1))

    def other_run_takes_lock(*args):
        cache.set(LOCK_KEY, "other-run", timeout=540)  # el candado propio expiró
        return {"t": 1}

    p1, p2, p3 = _patches([])
    with p1, p2, p3, patch.object(tasks, "reconcile_terminal_sales", other_run_takes_lock), \
            patch.object(tasks, "_local_today", return_value=date(2026, 11, 16)):
        run_fiscal_reconciliation()

    assert cache.get(LOCK_KEY) == "other-run"


def test_task_has_soft_time_limit_below_lock():
    assert run_fiscal_reconciliation.soft_time_limit == 520
    assert run_fiscal_reconciliation.soft_time_limit < tasks.LOCK_TIMEOUT


def test_soft_time_limit_stops_chain_and_releases_lock():
    from celery.exceptions import SoftTimeLimitExceeded

    set_match_settings(date(2026, 1, 1))
    calls = []
    with pytest.raises(SoftTimeLimitExceeded):
        _run(calls, date(2026, 11, 16), terminal=SoftTimeLimitExceeded())
    assert [c[0] for c in calls] == ["terminal"]
    assert cache.get(LOCK_KEY) is None
