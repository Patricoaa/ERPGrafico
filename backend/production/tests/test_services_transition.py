import pytest
from django.core.exceptions import ValidationError
from production.models import WorkOrder
from production.services import WorkOrderService

Stage = WorkOrder.Stage


@pytest.mark.django_db
def test_invalid_transition_rejected(work_order_factory):
    """Direct jump from MATERIAL_ASSIGNMENT to FINISHED must be rejected."""
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT)
    with pytest.raises(ValidationError, match="Transición inválida"):
        WorkOrderService.transition_to(wo, Stage.FINISHED)


@pytest.mark.django_db
def test_invalid_transition_skipping_middle_stages(work_order_factory):
    """Jump from MATERIAL_ASSIGNMENT to RECTIFICATION must be rejected."""
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT)
    with pytest.raises(ValidationError, match="Transición inválida"):
        WorkOrderService.transition_to(wo, Stage.RECTIFICATION)


@pytest.mark.django_db
def test_valid_forward_transition(work_order_factory):
    """MATERIAL_ASSIGNMENT → MATERIAL_APPROVAL is valid."""
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT)
    WorkOrderService.transition_to(wo, Stage.MATERIAL_APPROVAL)
    wo.refresh_from_db()
    assert wo.current_stage == Stage.MATERIAL_APPROVAL


@pytest.mark.django_db
def test_valid_skip_optional_stage(work_order_factory):
    """MATERIAL_ASSIGNMENT → PRESS is valid (skipping optional outsourcing+prepress)."""
    wo = work_order_factory(current_stage=Stage.MATERIAL_ASSIGNMENT)
    WorkOrderService.transition_to(wo, Stage.PRESS)
    wo.refresh_from_db()
    assert wo.current_stage == Stage.PRESS


@pytest.mark.django_db
def test_valid_backward_transition(work_order_factory):
    """Backward move (PRESS → MATERIAL_APPROVAL) is always allowed."""
    wo = work_order_factory(
        current_stage=Stage.PRESS,
        status=WorkOrder.Status.IN_PROGRESS,
    )
    WorkOrderService.transition_to(wo, Stage.MATERIAL_APPROVAL)
    wo.refresh_from_db()
    assert wo.current_stage == Stage.MATERIAL_APPROVAL


@pytest.mark.django_db
def test_terminal_finished_cannot_transition(work_order_factory):
    """No transition allowed out of FINISHED."""
    wo = work_order_factory(
        current_stage=Stage.FINISHED,
        status=WorkOrder.Status.FINISHED,
    )
    with pytest.raises(ValidationError, match="terminal"):
        WorkOrderService.transition_to(wo, Stage.RECTIFICATION)


@pytest.mark.django_db
def test_terminal_cancelled_cannot_transition(work_order_factory):
    """No transition allowed out of CANCELLED."""
    wo = work_order_factory(
        current_stage=Stage.CANCELLED,
        status=WorkOrder.Status.CANCELLED,
    )
    with pytest.raises(ValidationError, match="terminal"):
        WorkOrderService.transition_to(wo, Stage.MATERIAL_ASSIGNMENT)
