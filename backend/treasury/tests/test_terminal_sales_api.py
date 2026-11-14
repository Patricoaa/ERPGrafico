"""API de ventas de terminal y sincronización TUU (Task 6)."""

import json
from datetime import date, datetime, timedelta
from datetime import timezone as dt_tz
from decimal import Decimal
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from core.rbac.bundles import expand
from treasury.models import (
    PaymentTerminalDevice,
    TerminalSale,
    TerminalSyncRun,
    TerminalSyncSettings,
)
from treasury.tests.helpers import make_terminal_provider

SECRET = "tuu-secret-key-123"
_seq = iter(range(1, 10_000))


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _user_with_bundle(bundle: str, name: str):
    user = get_user_model().objects.create_user(username=name, password="x")
    codes = [p.split(".", 1)[1] for p in expand([bundle]) if p.startswith("treasury.")]
    user.user_permissions.set(Permission.objects.filter(content_type__app_label="treasury", codename__in=codes))
    return user


@pytest.fixture
def admin_client(db):
    return _client(get_user_model().objects.create_superuser(username="tsadmin", password="x"))


@pytest.fixture
def provider(db):
    p = make_terminal_provider()
    p.gateway_config = {"api_key_encrypted": SECRET}
    p.is_active = True
    p.save()
    return p


def make_sale(provider, **kw):
    n = next(_seq)
    defaults = {
        "provider": provider,
        "natural_key": f"nk-{n}",
        "serial_number": "SN1",
        "sale_id": f"S{n}",
        "sequence_number": str(n),
        "transaction_at": datetime(2026, 11, 10, 15, 0, tzinfo=dt_tz.utc),
        "status": TerminalSale.Status.COMPLETED,
        "payment_type": TerminalSale.PaymentType.DEBIT,
        "document_type": 39,
        "total_amount": Decimal("10000"),
        "commission_amount": Decimal("100"),
        "net_amount": Decimal("9900"),
        "raw": {"secret_raw": "RAWDATA"},
        "items": [{"name": "ITEMDATA"}],
        "reconciliations": [{"x": 1}],
    }
    defaults.update(kw)
    return TerminalSale.objects.create(**defaults)


@pytest.mark.django_db
def test_sales_list_filters(admin_client, provider):
    a = make_sale(provider, payment_type="CREDIT", document_type=33,
                  transaction_at=datetime(2026, 11, 1, 15, 0, tzinfo=dt_tz.utc))
    b = make_sale(provider, payment_type="DEBIT", document_type=39, settlement_id="ST1",
                  transaction_at=datetime(2026, 11, 10, 15, 0, tzinfo=dt_tz.utc))

    def ids(**params):
        r = admin_client.get("/api/treasury/terminal-sales/", params)
        assert r.status_code == 200
        return {row["id"] for row in r.json()["results"]}

    assert ids(payment_type="CREDIT") == {a.id}
    assert ids(document_type=39) == {b.id}
    assert ids(date_from="2026-11-05") == {b.id}
    assert ids(date_to="2026-11-05") == {a.id}
    assert ids(settled="true") == {b.id}
    assert ids(settled="false") == {a.id}
    assert ids(provider=provider.id) == {a.id, b.id}


@pytest.mark.django_db
def test_sales_list_excludes_raw_detail_includes_it(admin_client, provider):
    dev = PaymentTerminalDevice.objects.create(name="Caja 1", serial_number="SN1", provider=provider)
    sale = make_sale(provider, device=dev)
    row = admin_client.get("/api/treasury/terminal-sales/").json()["results"][0]
    for k in ("raw", "items", "reconciliations"):
        assert k not in row
    assert row["provider_name"] == provider.name
    assert row["device_name"] == "Caja 1"
    assert row["document_type_label"] == "Boleta"
    detail = admin_client.get(f"/api/treasury/terminal-sales/{sale.id}/").json()
    assert detail["raw"] == {"secret_raw": "RAWDATA"}
    assert detail["items"] and detail["reconciliations"]


@pytest.mark.django_db
def test_summary_excludes_non_completed(admin_client, provider):
    make_sale(provider, total_amount=Decimal("10000"), commission_amount=Decimal("100"), net_amount=Decimal("9900"))
    make_sale(provider, payment_type="CREDIT", total_amount=Decimal("5000"),
              commission_amount=Decimal("50"), net_amount=Decimal("4950"))
    make_sale(provider, status="REVERSED", total_amount=Decimal("7000"))
    data = admin_client.get("/api/treasury/terminal-sales/summary/").json()
    assert data["count"] == 3
    assert Decimal(data["gross"]) == Decimal("15000")
    assert Decimal(data["commission"]) == Decimal("150")
    assert Decimal(data["net"]) == Decimal("14850")
    assert data["non_completed"] == {"count": 1, "total": "7000"}
    by = {r["payment_type"]: r for r in data["by_payment_type"]}
    assert by["DEBIT"]["count"] == 1 and Decimal(by["DEBIT"]["gross"]) == Decimal("10000")
    assert by["CREDIT"]["count"] == 1


@pytest.mark.django_db
def test_settings_get_patch_permissions(db):
    reader = _client(_user_with_bundle("treasury.read", "reader"))
    manager = _client(_user_with_bundle("treasury.manage", "manager"))
    url = "/api/treasury/terminal-sync-settings/current/"
    r = reader.get(url)
    assert r.status_code == 200
    assert r.json()["last_run"] is None
    assert reader.patch(url, {"lookback_days": 9}, format="json").status_code == 403
    r = manager.patch(url, {"lookback_days": 9, "enabled": True}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["lookback_days"] == 9
    assert TerminalSyncSettings.get_settings().lookback_days == 9


@pytest.mark.django_db
def test_settings_includes_last_run(admin_client, provider):
    run = TerminalSyncRun.objects.create(
        provider=provider, trigger="MANUAL", status="SUCCESS",
        start_date=date(2026, 11, 1), end_date=date(2026, 11, 2),
        started_at=datetime(2026, 11, 3, tzinfo=dt_tz.utc),
    )
    last = admin_client.get("/api/treasury/terminal-sync-settings/current/").json()["last_run"]
    assert last["id"] == run.id and last["provider_name"] == provider.name and last["status"] == "SUCCESS"
    assert last["warnings"] == []


@pytest.mark.django_db
def test_manual_sync_enqueues_runs(db, provider):
    other = make_terminal_provider()  # sin api key → no elegible
    user = get_user_model().objects.create_superuser(username="syncer", password="x")
    client = _client(user)
    with mock.patch("treasury.tasks.sync_terminal_run.delay") as delay:
        r = client.post("/api/treasury/terminal-sync-runs/sync/", {}, format="json",
                        HTTP_IDEMPOTENCY_KEY="k-1")
    assert r.status_code == 202, r.content
    body = r.json()
    assert len(body) == 1
    run = TerminalSyncRun.objects.get(pk=body[0]["id"])
    assert run.provider_id == provider.id and run.trigger == "MANUAL" and run.triggered_by_id == user.id
    assert other.id != run.provider_id
    delay.assert_called_once_with(run.id)


@pytest.mark.django_db
def test_manual_sync_rejects_future_end_date(admin_client, provider):
    future = (timezone.localdate() + timedelta(days=5)).isoformat()
    with mock.patch("treasury.tasks.sync_terminal_run.delay") as delay:
        r = admin_client.post("/api/treasury/terminal-sync-runs/sync/", {"end_date": future},
                              format="json", HTTP_IDEMPOTENCY_KEY="k-2")
    assert r.status_code == 400
    delay.assert_not_called()
    assert TerminalSyncRun.objects.count() == 0


@pytest.mark.django_db
def test_manual_sync_without_eligible_providers(admin_client):
    r = admin_client.post("/api/treasury/terminal-sync-runs/sync/", {}, format="json",
                          HTTP_IDEMPOTENCY_KEY="k-3")
    assert r.status_code == 400


@pytest.mark.django_db
def test_manual_sync_requires_add_permission(db, provider):
    reader = _client(_user_with_bundle("treasury.read", "reader2"))
    r = reader.post("/api/treasury/terminal-sync-runs/sync/", {}, format="json", HTTP_IDEMPOTENCY_KEY="k-4")
    assert r.status_code == 403


@pytest.mark.django_db
def test_runs_list_has_names_and_no_payloads(admin_client, provider):
    TerminalSyncRun.objects.create(
        provider=provider, trigger="MANUAL", status="FAILED",
        start_date=date(2026, 11, 1), end_date=date(2026, 11, 2),
        started_at=datetime(2026, 11, 3, tzinfo=dt_tz.utc),
        triggered_by=get_user_model().objects.create_user(username="trig", password="x"),
    )
    row = admin_client.get("/api/treasury/terminal-sync-runs/", {"status": "FAILED"}).json()["results"][0]
    assert row["provider_name"] == provider.name
    assert row["triggered_by_name"] == "trig"
    assert "payloads" not in row
    assert admin_client.get("/api/treasury/terminal-sync-runs/", {"status": "SUCCESS"}).json()["count"] == 0


@pytest.mark.django_db
def test_api_never_exposes_api_key(admin_client, provider):
    sale = make_sale(provider)
    TerminalSyncRun.objects.create(
        provider=provider, trigger="MANUAL", start_date=date(2026, 11, 1), end_date=date(2026, 11, 2),
        started_at=datetime(2026, 11, 3, tzinfo=dt_tz.utc),
    )
    urls = [
        "/api/treasury/terminal-sales/",
        f"/api/treasury/terminal-sales/{sale.id}/",
        "/api/treasury/terminal-sales/summary/",
        "/api/treasury/terminal-sync-runs/",
        "/api/treasury/terminal-sync-settings/current/",
    ]
    for url in urls:
        text = admin_client.get(url).content.decode()
        assert SECRET not in text and "api_key_encrypted" not in text
    with mock.patch("treasury.tasks.sync_terminal_run.delay"):
        r = admin_client.post("/api/treasury/terminal-sync-runs/sync/", {}, format="json",
                              HTTP_IDEMPOTENCY_KEY="k-5")
    text = json.dumps(r.json())
    assert SECRET not in text and "api_key_encrypted" not in text


@pytest.mark.django_db
@pytest.mark.parametrize(
    "url,params",
    [
        ("/api/treasury/terminal-sales/", {"provider": "abc"}),
        ("/api/treasury/terminal-sales/", {"document_type": "x"}),
        ("/api/treasury/terminal-sales/", {"date_from": "2026-13-45"}),
        ("/api/treasury/terminal-sales/", {"payment_type": "BITCOIN"}),
        ("/api/treasury/terminal-sales/", {"status": "NOPE"}),
        ("/api/treasury/terminal-sales/summary/", {"device": "zz"}),
        ("/api/treasury/terminal-sync-runs/", {"provider": "abc"}),
        ("/api/treasury/terminal-sync-runs/", {"status": "NOPE"}),
    ],
)
def test_malformed_filters_return_400(admin_client, url, params):
    assert admin_client.get(url, params).status_code == 400


@pytest.mark.django_db
def test_manual_sync_enqueue_failure_marks_run_failed(db):
    first, second = make_terminal_provider(), make_terminal_provider()
    for p in (first, second):
        p.gateway_config = {"api_key_encrypted": SECRET}
        p.save()
    client = _client(get_user_model().objects.create_superuser(username="enq", password="x"))
    calls = []

    def flaky(run_id):
        calls.append(run_id)
        if len(calls) == 1:
            raise RuntimeError("broker down")

    with mock.patch("treasury.tasks.sync_terminal_run.delay", side_effect=flaky):
        r = client.post("/api/treasury/terminal-sync-runs/sync/", {}, format="json", HTTP_IDEMPOTENCY_KEY="k-6")
    assert r.status_code == 202
    assert len(calls) == 2
    failed = TerminalSyncRun.objects.get(pk=calls[0])
    assert failed.status == "FAILED" and failed.finished_at is not None
    assert failed.error_message == "No se pudo encolar la sincronización"
    assert TerminalSyncRun.objects.get(pk=calls[1]).status == "RUNNING"


@pytest.mark.django_db
def test_settings_viewset_exposes_only_current(admin_client):
    assert admin_client.get("/api/treasury/terminal-sync-settings/").status_code == 404
    assert admin_client.get("/api/treasury/terminal-sync-settings/1/").status_code == 404
