import pytest
from rest_framework.test import APIClient

from core.tests.rbac_factories import make_user

pytestmark = pytest.mark.django_db


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def test_assignment_rules_list_returns_200_for_authorized_user():
    user = make_user("w1", "workflow.view_taskassignmentrule")
    assert _client(user).get("/api/workflow/assignment-rules/").status_code == 200


def test_operator_cannot_modify_assignment_or_notification_rules():
    user = make_user("w2", "workflow.view_taskassignmentrule", "workflow.view_notificationrule")
    c = _client(user)
    assert c.post("/api/workflow/assignment-rules/", {}, format="json").status_code == 403
    assert c.post("/api/workflow/notification-rules/", {}, format="json").status_code == 403


def test_workflow_settings_current_get_open_write_guarded():
    user = make_user("w3")
    c = _client(user)
    assert c.get("/api/workflow/settings/current/").status_code == 200
    assert c.patch("/api/workflow/settings/current/", {}, format="json").status_code == 403
    editor = make_user("w4", "workflow.change_workflowsettings")
    assert _client(editor).patch("/api/workflow/settings/current/", {}, format="json").status_code == 200
