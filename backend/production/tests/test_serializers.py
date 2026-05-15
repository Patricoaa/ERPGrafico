import pytest
from datetime import date
from production.models import WorkOrder
from production.serializers import WorkOrderSerializer


@pytest.fixture
def minimal_work_order(db):
    return WorkOrder.objects.create(
        description='Test OT',
        status=WorkOrder.Status.DRAFT,
        current_stage=WorkOrder.Stage.MATERIAL_ASSIGNMENT,
        estimated_completion_date=date(2026, 6, 1),
    )


@pytest.mark.django_db
def test_workorder_serializer_exposes_due_date_alias(minimal_work_order):
    data = WorkOrderSerializer(minimal_work_order).data
    assert 'due_date' in data, "due_date alias must be present in serializer output"
    assert 'estimated_completion_date' in data, "estimated_completion_date must remain present"
    assert data['due_date'] == data['estimated_completion_date'] == '2026-06-01'


@pytest.mark.django_db
def test_workorder_serializer_due_date_null_when_not_set(db):
    wo = WorkOrder.objects.create(
        description='Sin fecha',
        status=WorkOrder.Status.DRAFT,
        current_stage=WorkOrder.Stage.MATERIAL_ASSIGNMENT,
    )
    data = WorkOrderSerializer(wo).data
    assert data['due_date'] is None
    assert data['estimated_completion_date'] is None
