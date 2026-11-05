"""El endpoint de audit log global debe acotar `limit` (Big O: sin tope = O(n) por modelo)."""

from unittest import mock

import pytest

from core.views import GLOBAL_AUDIT_LOG_MAX_LIMIT

URL = "/api/core/audit-log/global/"


@pytest.fixture
def audit_url():
    from django.urls import reverse, NoReverseMatch

    for name in ("global-audit-log", "core:global-audit-log"):
        try:
            return reverse(name)
        except NoReverseMatch:
            continue
    return URL


@pytest.mark.django_db
@pytest.mark.parametrize(
    "raw, expected",
    [
        ("100000", GLOBAL_AUDIT_LOG_MAX_LIMIT),
        ("0", 1),
        ("-5", 1),
        ("abc", 50),
        ("25", 25),
    ],
)
def test_global_audit_log_limit_is_clamped(api_client, audit_url, raw, expected):
    with mock.patch(
        "core.services.selectors.CoreSelector.get_global_audit_log",
        return_value=[],
    ) as selector:
        response = api_client.get(audit_url, {"limit": raw})

    assert response.status_code == 200
    selector.assert_called_once_with(expected)
