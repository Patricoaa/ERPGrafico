"""Regression for Sentry FRONTEND-ERP-7Q: N+1 in GET /api/workflow/tasks/ (polled every 30 s)."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from core.models import Attachment
from workflow.models import Task, TaskEvent

User = get_user_model()


def _make_task(index: int, group: Group) -> Task:
    assignee = User.objects.create_user(username=f"assignee{index}", password="x")
    creator = User.objects.create_user(username=f"creator{index}", password="x")
    completer = User.objects.create_user(username=f"completer{index}", password="x")
    for user in (assignee, creator, completer):
        user.groups.add(group)
    task = Task.objects.create(
        title=f"Task {index}",
        task_type="TEST",
        assigned_to=assignee,
        created_by=creator,
        completed_by=completer,
    )
    attachment = Attachment.objects.create(
        content_object=task,
        file=SimpleUploadedFile(f"{index}.txt", b"evidence"),
        original_filename=f"{index}.txt",
        user=creator,
    )
    TaskEvent.objects.create(task=task, action="COMPLETED", user=completer, attachment_ids=[attachment.id])
    return task


def _count_list_queries(client: APIClient) -> tuple[int, dict]:
    with CaptureQueriesContext(connection) as ctx:
        response = client.get("/api/workflow/tasks/")
    assert response.status_code == 200
    return len(ctx), response.data


@pytest.mark.django_db
def test_task_list_query_count_does_not_grow_with_rows():
    viewer = User.objects.create_superuser(username="viewer", password="x")
    client = APIClient()
    client.force_authenticate(user=viewer)
    group = Group.objects.create(name="Aprobadores")

    _make_task(0, group)
    one_task_queries, _ = _count_list_queries(client)

    for index in range(1, 6):
        _make_task(index, group)
    many_tasks_queries, data = _count_list_queries(client)

    assert len(data["results"]) == 6
    assert many_tasks_queries == one_task_queries


@pytest.mark.django_db
def test_task_list_keeps_the_fields_the_ui_reads():
    viewer = User.objects.create_superuser(username="viewer", password="x")
    client = APIClient()
    client.force_authenticate(user=viewer)
    group = Group.objects.create(name="Aprobadores")
    task = _make_task(0, group)

    row = client.get("/api/workflow/tasks/").data["results"][0]

    assert row["assigned_to_data"]["username"] == task.assigned_to.username
    assert row["created_by_data"]["username"] == task.created_by.username
    assert row["completed_by_data"]["username"] == task.completed_by.username
    assert set(row["assigned_to_data"]) == {"id", "username", "first_name", "last_name"}
    assert row["attachments_data"][0]["user_name"] == task.created_by.username
    event = row["events_data"][0]
    assert event["user_name"] == task.completed_by.username
    assert event["attachments_data"][0]["original_filename"] == "0.txt"
