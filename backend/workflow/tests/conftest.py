import pytest
from django.contrib.auth import get_user_model

from workflow.models import NotificationRule, TaskAssignmentRule, Task

User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username="testuser", password="x")
    return {"user": user}


@pytest.fixture
def task(env):
    return Task.objects.create(
        title="Test Task",
        description="Test",
        task_type="TEST",
        status=Task.Status.PENDING,
        created_by=env["user"],
    )


@pytest.fixture
def rule_with_assignee(env):
    return TaskAssignmentRule.objects.create(
        task_type="TEST_TYPE", assigned_user=env["user"]
    )
