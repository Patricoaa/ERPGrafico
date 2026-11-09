"""
Regression for issue #224: manual date filters in treasury views did not validate
the date string before passing to the ORM. An invalid date caused ValueError → 500.
"""
import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(username="admin_treasury_date", password="x")


@pytest.fixture
def client_auth(superuser):
    c = APIClient()
    c.force_authenticate(superuser)
    return c


def test_treasury_movement_invalid_date_does_not_500(client_auth):
    """GET /api/treasury/movements/?date_from=not-a-date must not 500."""
    r = client_auth.get("/api/treasury/movements/", {"date_from": "not-a-date"})
    assert r.status_code in (200, 400), f"Expected 200 or 400, got {r.status_code}: {r.data}"
    assert r.status_code != 500


def test_treasury_movement_invalid_date_to_does_not_500(client_auth):
    r = client_auth.get("/api/treasury/movements/", {"date_to": "31/13/2024"})
    assert r.status_code != 500


def test_pos_session_invalid_date_does_not_500(client_auth):
    """GET /api/treasury/pos-sessions/?date_from=bad must not 500."""
    r = client_auth.get("/api/treasury/pos-sessions/", {"date_from": "not-a-date"})
    assert r.status_code != 500


def test_pos_session_invalid_date_to_does_not_500(client_auth):
    r = client_auth.get("/api/treasury/pos-sessions/", {"date_to": "not-a-date"})
    assert r.status_code != 500


def test_check_search_does_not_500(client_auth):
    """GET /api/treasury/checks/?search=term must not 500 (amount was in search_fields)."""
    r = client_auth.get("/api/treasury/checks/", {"search": "123"})
    assert r.status_code != 500
