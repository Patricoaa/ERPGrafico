"""Reloj de depuración (ADR-0139 D4): desfase en caché aplicado con time-machine."""

import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from django.core.management import CommandError, call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core import debug_clock
from core.models import ActionLog, User

SANTIAGO = ZoneInfo("America/Santiago")
CLOCK_URL = "/api/core/debug/clock/"
SERVER_TIME_URL = "/api/core/server-time/"
DISABLED_MSG = "El reloj de depuración solo funciona con DEBUG=True y DEBUG_CLOCK_ENABLED=1."


def _real_now() -> datetime:
    return datetime.fromtimestamp(time.time(), tz=SANTIAGO)


@pytest.fixture(autouse=True)
def _reset_debug_clock():
    yield
    debug_clock.reset_clock()
    debug_clock.apply_debug_clock()
    debug_clock.stop_travel()
    assert not debug_clock.is_active()


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setenv("DEBUG_CLOCK_ENABLED", "1")
    with override_settings(DEBUG=True):
        yield


@pytest.fixture
def superuser_client(db):
    user = User.objects.create_superuser(username="clockadmin", email="c@example.com", password="x")
    client = APIClient()
    client.force_authenticate(user)
    return client, user


def _assert_close(actual: datetime, expected: datetime, seconds: float = 5) -> None:
    assert abs((actual - expected).total_seconds()) <= seconds, (actual, expected)


def test_set_clock_moves_timezone_now(enabled):
    target = datetime(2026, 11, 13, 17, 35, tzinfo=SANTIAGO)
    debug_clock.set_clock(target)
    debug_clock.apply_debug_clock()
    assert debug_clock.is_active()
    _assert_close(timezone.localtime(), target)


def test_clock_ticks(enabled):
    debug_clock.set_clock(datetime(2026, 11, 13, 17, 35, tzinfo=SANTIAGO))
    debug_clock.apply_debug_clock()
    first = timezone.now()
    time.sleep(0.05)
    second = timezone.now()
    assert second > first


def test_change_without_restart_and_reset(enabled):
    debug_clock.set_clock(datetime(2026, 11, 13, 17, 35, tzinfo=SANTIAGO))
    debug_clock.apply_debug_clock()
    new_target = datetime(2025, 3, 1, 9, 0, tzinfo=SANTIAGO)
    debug_clock.set_clock(new_target)
    debug_clock.apply_debug_clock()
    _assert_close(timezone.localtime(), new_target)

    debug_clock.reset_clock()
    debug_clock.apply_debug_clock()
    assert debug_clock.current_offset() is None
    assert not debug_clock.is_active()
    _assert_close(timezone.localtime(), _real_now())


def test_apply_is_idempotent_for_same_offset(enabled):
    debug_clock.set_clock(datetime(2026, 11, 13, 17, 35, tzinfo=SANTIAGO))
    debug_clock.apply_debug_clock()
    traveller = debug_clock._traveller
    debug_clock.apply_debug_clock()
    assert debug_clock._traveller is traveller


def test_disabled_when_not_debug(monkeypatch):
    monkeypatch.setenv("DEBUG_CLOCK_ENABLED", "1")
    with override_settings(DEBUG=False):
        assert not debug_clock.is_enabled()
        from django.core.cache import cache

        cache.set(debug_clock.CACHE_KEY, -86400.0 * 365, None)
        debug_clock.apply_debug_clock()
        assert not debug_clock.is_active()
        _assert_close(timezone.localtime(), _real_now())
        for args in (("set", "2026-11-13 17:35"), ("reset",), ("show",)):
            with pytest.raises(CommandError) as exc:
                call_command("debug_clock", *args)
            assert str(exc.value) == DISABLED_MSG


def test_disabled_without_env(monkeypatch):
    monkeypatch.delenv("DEBUG_CLOCK_ENABLED", raising=False)
    with override_settings(DEBUG=True):
        assert not debug_clock.is_enabled()


def test_command_set_show_reset(enabled, capsys):
    call_command("debug_clock", "set", "2026-11-13 17:35")
    offset = debug_clock.current_offset()
    assert offset is not None
    expected = datetime(2026, 11, 13, 17, 35, tzinfo=SANTIAGO)
    _assert_close(_real_now() + timedelta(seconds=offset), expected)
    call_command("debug_clock", "show")
    assert "2026-11-13" in capsys.readouterr().out
    call_command("debug_clock", "reset")
    assert debug_clock.current_offset() is None


def test_server_time_reports_flag(db, monkeypatch):
    client = APIClient()
    client.force_authenticate(User.objects.create_user(username="plain", password="x"))
    monkeypatch.delenv("DEBUG_CLOCK_ENABLED", raising=False)
    data = client.get(SERVER_TIME_URL).json()
    assert data["debug_clock"] is False
    assert data["debug_tools"] is False

    monkeypatch.setenv("DEBUG_CLOCK_ENABLED", "1")
    with override_settings(DEBUG=True):
        data = client.get(SERVER_TIME_URL).json()
        assert data["debug_clock"] is False
        assert data["debug_tools"] is True

        debug_clock.set_clock(datetime(2026, 11, 13, 17, 35, tzinfo=SANTIAGO))
        data = client.get(SERVER_TIME_URL).json()
        assert data["debug_clock"] is True
        assert data["debug_tools"] is True
        assert data["date"] == "2026-11-13"


def test_clock_endpoint_404_when_disabled(superuser_client, monkeypatch):
    client, _ = superuser_client
    monkeypatch.delenv("DEBUG_CLOCK_ENABLED", raising=False)
    assert client.get(CLOCK_URL).status_code == 404
    assert client.post(CLOCK_URL, {"datetime": "2026-11-13T17:35"}, format="json").status_code == 404
    assert client.delete(CLOCK_URL).status_code == 404


def test_clock_endpoint_requires_superuser(db, enabled):
    staff = User.objects.create_user(username="staffer", password="x", is_staff=True)
    client = APIClient()
    client.force_authenticate(staff)
    assert client.get(CLOCK_URL).status_code == 403
    assert client.post(CLOCK_URL, {"datetime": "2026-11-13T17:35"}, format="json").status_code == 403
    assert client.delete(CLOCK_URL).status_code == 403
    anon = APIClient()
    assert anon.get(CLOCK_URL).status_code in (401, 403)


def test_clock_endpoint_set_get_reset(superuser_client, enabled):
    client, _ = superuser_client
    data = client.get(CLOCK_URL).json()
    assert data["active"] is False
    assert data["offset_seconds"] is None

    target = datetime(2026, 11, 13, 17, 35, tzinfo=SANTIAGO)
    resp = client.post(CLOCK_URL, {"datetime": "2026-11-13T17:35"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["active"] is True

    data = client.get(CLOCK_URL).json()
    assert data["active"] is True
    assert data["offset_seconds"] is not None
    _assert_close(datetime.fromisoformat(data["now"]), target)
    _assert_close(timezone.localtime(), target)

    resp = client.delete(CLOCK_URL)
    assert resp.status_code == 200
    assert resp.json()["active"] is False
    data = client.get(CLOCK_URL).json()
    assert data["active"] is False
    _assert_close(datetime.fromisoformat(data["now"]), _real_now())
    _assert_close(timezone.localtime(), _real_now())


def test_clock_endpoint_rejects_bad_datetime(superuser_client, enabled):
    client, _ = superuser_client
    resp = client.post(CLOCK_URL, {"datetime": "mañana"}, format="json")
    assert resp.status_code == 400
    assert debug_clock.current_offset() is None


def test_clock_endpoint_audits_changes(superuser_client, enabled):
    client, user = superuser_client
    client.post(CLOCK_URL, {"datetime": "2026-11-13T17:35"}, format="json")
    client.delete(CLOCK_URL)
    logs = ActionLog.objects.filter(metadata__event__startswith="debug_clock.").order_by("id")
    events = [log.metadata["event"] for log in logs]
    assert events == ["debug_clock.set", "debug_clock.reset"]
    assert all(log.user_id == user.id for log in logs)
    assert logs[0].metadata["target"].startswith("2026-11-13T17:35")


def test_celery_prerun_applies_clock(enabled):
    from config.celery import apply_debug_clock_for_task

    debug_clock.set_clock(datetime(2026, 11, 13, 17, 35, tzinfo=SANTIAGO))
    apply_debug_clock_for_task()
    assert debug_clock.is_active()


def test_celery_prerun_noop_when_disabled(monkeypatch):
    from django.core.cache import cache

    from config.celery import apply_debug_clock_for_task

    monkeypatch.delenv("DEBUG_CLOCK_ENABLED", raising=False)
    cache.set(debug_clock.CACHE_KEY, 3600.0, None)
    apply_debug_clock_for_task()
    assert not debug_clock.is_active()
