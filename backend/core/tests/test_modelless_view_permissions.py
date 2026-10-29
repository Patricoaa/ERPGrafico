import pytest
from rest_framework.test import APIClient

from core.tests.rbac_factories import make_user

MODEL_LESS_GUARDED = [
    ("get", "/api/core/audit/global/"),
    ("get", "/api/finances/api/balance-sheet/"),
    ("get", "/api/finances/api/income-statement/"),
    ("get", "/api/finances/api/trial-balance/"),
    ("get", "/api/finances/api/cash-flow/"),
    ("get", "/api/finances/api/analysis/"),
    ("get", "/api/finances/api/bi-analytics/"),
    ("get", "/api/finances/api/report-status/abc/"),
    ("get", "/api/hr/global-settings/current/"),
    ("patch", "/api/hr/global-settings/current/"),
    ("get", "/api/treasury/dashboard/stats/"),
    ("get", "/api/treasury/dashboard/accounts/"),
    ("get", "/api/treasury/dashboard/future_maturities/"),
    ("post", "/api/treasury/dashboard/register_transfer/"),
]


def _client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.mark.django_db
@pytest.mark.parametrize("method, url", MODEL_LESS_GUARDED)
def test_modelless_view_denies_user_without_permission(method, url):
    client = _client(make_user("nobody"))
    assert getattr(client, method)(url, {}, format="json").status_code == 403


@pytest.mark.django_db
def test_modelless_view_allows_user_with_permission():
    client = _client(make_user("auditor", "core.view_actionlog"))
    # body has an unrelated pre-existing 500; the permission gate is what is tested
    assert client.get("/api/core/audit/global/").status_code != 403


@pytest.mark.django_db
def test_treasury_transfer_requires_add_movement():
    client = _client(make_user("viewer", "treasury.view_dashboard_treasury"))
    assert client.get("/api/treasury/dashboard/stats/").status_code != 403
    assert client.post("/api/treasury/dashboard/register_transfer/", {}, format="json").status_code == 403


@pytest.mark.django_db
def test_hr_global_settings_patch_requires_change():
    client = _client(make_user("hrviewer", "hr.view_globalhrsettings"))
    assert client.get("/api/hr/global-settings/current/").status_code == 200
    assert client.patch("/api/hr/global-settings/current/", {}, format="json").status_code == 403
