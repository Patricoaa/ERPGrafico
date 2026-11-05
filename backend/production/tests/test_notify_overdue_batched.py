"""notify_overdue_work_orders: las lecturas se agrupan (no una query por OT)."""

from datetime import timedelta
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
import pytest

from core.models import User
from production.models import WorkOrder
from production.tasks import notify_overdue_work_orders
from workflow.models import Notification, Task


def _overdue_ot_with_assignee(make_ot, user, n):
    ot = make_ot(
        description=f"OT atrasada {n}",
        status=WorkOrder.Status.IN_PROGRESS,
        estimated_completion_date=timezone.now().date() - timedelta(days=2),
    )
    Task.objects.create(
        title=f"Tarea {n}",
        task_type="PRODUCTION",
        status=Task.Status.PENDING,
        content_type=ContentType.objects.get_for_model(WorkOrder),
        object_id=ot.id,
        assigned_to=user,
    )
    return ot


def _queries(n, work_order_factory):
    user = User.objects.create_user(f"ovd{n}", f"ovd{n}@test.com", "pass")
    for i in range(n):
        _overdue_ot_with_assignee(work_order_factory, user, i)
    with CaptureQueriesContext(connection) as ctx:
        notify_overdue_work_orders()
    return len(ctx.captured_queries)


@pytest.mark.django_db
def test_notifications_created_per_ot_and_user(work_order_factory):
    user = User.objects.create_user("ovd-single", "ovd-single@test.com", "pass")
    _overdue_ot_with_assignee(work_order_factory, user, 0)
    _overdue_ot_with_assignee(work_order_factory, user, 1)

    assert notify_overdue_work_orders() == 2
    assert Notification.objects.filter(notification_type="OT_OVERDUE", user=user).count() == 2


@pytest.mark.django_db
def test_second_run_same_day_does_not_duplicate(work_order_factory):
    user = User.objects.create_user("ovd-twice", "ovd-twice@test.com", "pass")
    _overdue_ot_with_assignee(work_order_factory, user, 0)

    notify_overdue_work_orders()
    assert notify_overdue_work_orders() == 0


@pytest.mark.django_db
def test_read_query_count_does_not_grow_with_overdue_ots(work_order_factory):
    small = _queries(2, work_order_factory)
    large = _queries(8, work_order_factory)
    # Writes (one Notification per OT) still scale; the reads must not.
    # Each extra OT adds exactly its notification INSERT + savepoint, nothing else.
    assert large - small <= 6 * 3
