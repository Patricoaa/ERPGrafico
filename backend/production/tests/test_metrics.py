import pytest
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from production.models import WorkOrder, WorkOrderHistory
from production.services import WorkOrderMetricsService

@pytest.mark.django_db
def test_task204_metrics_endpoint_response(work_order_factory, warehouse_factory):
    """
    TASK-204: Verify the /production/orders/metrics/ endpoint
    """
    # Prepare some data
    wh = warehouse_factory()
    now = timezone.now()
    
    # 1 Overdue OT
    wo_overdue = work_order_factory(
        status=WorkOrder.Status.IN_PROGRESS,
        current_stage=WorkOrder.Stage.PRESS,
        estimated_completion_date=now.date() - timedelta(days=2),
        warehouse=wh
    )
    
    # 1 Draft OT
    wo_draft = work_order_factory(
        status=WorkOrder.Status.DRAFT,
        current_stage=WorkOrder.Stage.PREPRESS,
        estimated_completion_date=now.date() + timedelta(days=2),
        warehouse=wh
    )
    
    # 1 Finished OT in last 30d
    wo_finished = work_order_factory(
        status=WorkOrder.Status.FINISHED,
        current_stage=WorkOrder.Stage.FINISHED,
        warehouse=wh
    )
    wo_finished.created_at = now - timedelta(days=5)
    wo_finished.save()
    
    # Add history for duration calculation (Requires window function so need 2 entries for one OT)
    h1 = WorkOrderHistory.objects.create(
        work_order=wo_overdue,
        stage=WorkOrder.Stage.PREPRESS,
        status=WorkOrder.Status.IN_PROGRESS,
    )
    # Manipulate created_at to be exactly 2 days ago
    WorkOrderHistory.objects.filter(pk=h1.pk).update(created_at=now - timedelta(days=2))
    
    h2 = WorkOrderHistory.objects.create(
        work_order=wo_overdue,
        stage=WorkOrder.Stage.PRESS,
        status=WorkOrder.Status.IN_PROGRESS,
    )
    WorkOrderHistory.objects.filter(pk=h2.pk).update(created_at=now)

    client = APIClient()
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user, _ = User.objects.get_or_create(username='testadmin', email='admin@test.com', defaults={'is_superuser': True})
    client.force_authenticate(user=user)
    
    response = client.get("/api/production/orders/metrics/")
    assert response.status_code == 200
    data = response.json()
    
    assert data["overdue_ots"] == 1
    assert data["throughput_last_30d"] == 1
    assert data["ots_by_stage"]["PREPRESS"] == 1
    assert data["ots_by_stage"]["PRESS"] == 1
    
    # Duration for PREPRESS is exactly 2 days (now - (now - 2 days))
    # It might be ~2.0 days due to execution time differences, so assert approx
    assert "PREPRESS" in data["avg_time_by_stage"]
    assert 1.9 < data["avg_time_by_stage"]["PREPRESS"] < 2.1
