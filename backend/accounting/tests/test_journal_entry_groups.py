"""`GET /api/accounting/entries/groups/?group_by=origin` (ADR-0158 §7): origin is derived in SQL."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import JournalEntry

pytestmark = pytest.mark.ci_gate

User = get_user_model()


@pytest.fixture
def client(db):
    api = APIClient()
    api.force_authenticate(user=User.objects.create_superuser(username="grouper", password="x"))
    return api


def test_origin_groups_list_exactly_their_rows(client):
    from datetime import date

    auto = JournalEntry.objects.create(date=date(2026, 1, 5), description="Auto")
    JournalEntry.objects.create(date=date(2026, 1, 6), description="Manual", is_manual=True)
    JournalEntry.objects.create(date=date(2026, 1, 7), description="Reversa", reversal_of=auto)

    url = "/api/accounting/entries/"
    groups = client.get(f"{url}groups/", {"group_by": "origin"}).json()

    assert {g["key"]: (g["label"], g["count"]) for g in groups} == {
        "auto": ("Automático", 1),
        "manual": ("Manual", 1),
        "reversal": ("Reversión", 1),
    }
    for group in groups:
        assert client.get(url, group["params"]).json()["count"] == group["count"]
