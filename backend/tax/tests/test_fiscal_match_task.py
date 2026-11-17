"""Tarea periódica del motor de cuadre y ganchos tras TUU / RCV (spec §5.4)."""

from datetime import date
from unittest.mock import patch

import pytest
from celery.schedules import crontab
from django.conf import settings
from django.core.cache import cache

from accounting import tasks as accounting_tasks
from accounting.models import RCVImport
from tax import tasks
from tax.tasks import FISCAL_MATCH_LOCK_KEY, run_fiscal_match
from tax.tests.reconciliation_helpers import set_match_settings
from treasury import tasks as treasury_tasks
from treasury.models import TerminalSyncRun
from treasury.tests.helpers import make_terminal_provider

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _clean_lock():
    cache.delete(FISCAL_MATCH_LOCK_KEY)
    yield
    cache.delete(FISCAL_MATCH_LOCK_KEY)


def test_lock_prevents_overlap():
    set_match_settings(date(2026, 1, 1))
    cache.add(FISCAL_MATCH_LOCK_KEY, "other", timeout=540)
    with patch("tax.fiscal_match.engine.run_fiscal_match") as engine:
        assert run_fiscal_match() == {"skipped": True}
    engine.assert_not_called()
    assert cache.get(FISCAL_MATCH_LOCK_KEY) == "other"  # no libera el candado ajeno


def test_runs_engine_and_releases_lock():
    with patch("tax.fiscal_match.engine.run_fiscal_match", return_value={"created": 1}) as engine:
        assert run_fiscal_match() == {"created": 1}
    engine.assert_called_once_with()
    assert cache.get(FISCAL_MATCH_LOCK_KEY) is None


def test_engine_error_is_logged_and_lock_released(caplog):
    with patch("tax.fiscal_match.engine.run_fiscal_match", side_effect=ValueError("x")):
        assert run_fiscal_match() == {"error": "ValueError"}
    assert cache.get(FISCAL_MATCH_LOCK_KEY) is None


def test_skipped_without_start_date():
    set_match_settings(None)
    assert run_fiscal_match() == {"skipped": True}
    assert cache.get(FISCAL_MATCH_LOCK_KEY) is None


def test_task_limits_and_beat_entry():
    assert run_fiscal_match.name == "tax.tasks.run_fiscal_match"
    assert run_fiscal_match.soft_time_limit == 520 < tasks.FISCAL_MATCH_LOCK_TIMEOUT == 540
    entry = settings.CELERY_BEAT_SCHEDULE["run_fiscal_match_10min"]
    assert entry["task"] == run_fiscal_match.name
    assert entry["schedule"] == crontab(minute="*/10")
    assert "run_fiscal_reconciliation_10min" not in settings.CELERY_BEAT_SCHEDULE


def test_hooks_enqueue_task(django_capture_on_commit_callbacks):
    provider = make_terminal_provider()
    run = TerminalSyncRun(provider=provider, start_date=date(2026, 11, 1), end_date=date(2026, 11, 2))
    rcv_import = RCVImport(direction=RCVImport.Direction.PURCHASES, year=2026, month=11)
    with patch.object(run_fiscal_match, "delay") as delay:
        with django_capture_on_commit_callbacks(execute=True):
            treasury_tasks._reconcile_after_sync(run)
            accounting_tasks._reconcile_imported_period(rcv_import)
    assert delay.call_count == 2


def test_hook_enqueue_error_is_swallowed(django_capture_on_commit_callbacks, caplog):
    rcv_import = RCVImport(direction=RCVImport.Direction.SALES, year=2026, month=11)
    with patch.object(run_fiscal_match, "delay", side_effect=ConnectionError("broker down")):
        with django_capture_on_commit_callbacks(execute=True):
            accounting_tasks._reconcile_imported_period(rcv_import)
            treasury_tasks._reconcile_after_sync(
                TerminalSyncRun(start_date=date(2026, 11, 1), end_date=date(2026, 11, 1))
            )
    assert "cuadre" in caplog.text
