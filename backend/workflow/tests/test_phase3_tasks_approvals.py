"""
Phase 3 — Tasks & Approvals tests.
TaskAssignmentRule.assigned_group FK migration, candidate_group cleanup,
Task.required_permission, ApprovalPolicy model.
"""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group


User = get_user_model()


# ---------------------------------------------------------------------------
# Task 1 — TaskAssignmentRule.assigned_group is a FK
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_task_assignment_rule_assigned_group_is_fk():
    group = Group.objects.create(name="Aprobadores")
    from workflow.models import TaskAssignmentRule
    rule = TaskAssignmentRule.objects.create(
        task_type="TEST_APPROVAL",
        assigned_group=group,
    )
    rule.refresh_from_db()
    assert rule.assigned_group_id == group.pk
    assert rule.assigned_group.name == "Aprobadores"
