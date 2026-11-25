"""`GET /api/production/orders/groups/` (ADR-0158 §7): status and stage groups list their rows."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from production.models import WorkOrder

pytestmark = pytest.mark.ci_gate

User = get_user_model()
URL = "/api/production/orders/"


@pytest.fixture
def client(db):
    api = APIClient()
    api.force_authenticate(user=User.objects.create_superuser(username="grouper", password="x"))
    return api


@pytest.mark.parametrize("group_by", ["status", "current_stage"])
def test_groups_list_exactly_their_rows(client, group_by):
    for status in ["DRAFT", "DRAFT", "IN_PROGRESS"]:
        WorkOrder.objects.create(description="OT", status=status)

    groups = client.get(f"{URL}groups/", {"group_by": group_by}).json()

    assert sum(g["count"] for g in groups) == 3
    assert all(g["label"] for g in groups)
    for group in groups:
        assert client.get(URL, group["params"]).json()["count"] == group["count"]
