"""
Regression for issue #224: JournalEntryViewSet.search_fields contained "display_id"
(a Python @property), which caused FieldError → 500 on any search query.
"""
import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(username="admin_je_test", password="x")


@pytest.fixture
def client_auth(superuser):
    c = APIClient()
    c.force_authenticate(superuser)
    return c


def test_journal_entry_search_does_not_500(client_auth):
    """GET /api/accounting/journal-entries/?search=term must return 200, not 500."""
    r = client_auth.get("/api/accounting/entries/", {"search": "test"})
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.data}"


def test_journal_entry_search_empty_term(client_auth):
    r = client_auth.get("/api/accounting/entries/", {"search": ""})
    assert r.status_code == 200
