import pytest
from django.utils import timezone
from production.models import WorkOrder, ProductionSettings

@pytest.mark.django_db
def test_task206_workorder_numeration_without_year_prefix(work_order_factory):
    # Set year prefix to False
    settings = ProductionSettings.load()
    settings.use_year_prefix = False
    settings.save()

    # The first OT should just be '000001'
    wo1 = work_order_factory()
    assert wo1.number == '000001'

    # The second OT should be '000002'
    wo2 = work_order_factory()
    assert wo2.number == '000002'

@pytest.mark.django_db
def test_task206_workorder_numeration_with_year_prefix(work_order_factory):
    # Enable year prefix
    settings = ProductionSettings.load()
    settings.use_year_prefix = True
    settings.save()

    current_year = timezone.now().year

    # First OT should be YYYY-000001
    wo1 = work_order_factory()
    assert wo1.number == f"{current_year}-000001"

    # Second OT should be YYYY-000002
    wo2 = work_order_factory()
    assert wo2.number == f"{current_year}-000002"

@pytest.mark.django_db
def test_task206_workorder_numeration_handles_transition(work_order_factory):
    # Transitioning from no-prefix to prefix should reset or increment correctly.
    # In our implementation, since the prefix isn't present in previous,
    # the regex extracts the sequence.
    
    settings = ProductionSettings.load()
    settings.use_year_prefix = False
    settings.save()

    wo1 = work_order_factory()
    assert wo1.number == '000001'

    settings.use_year_prefix = True
    settings.save()
    
    current_year = timezone.now().year
    
    # Since filter_kwargs restricts by year when year_prefix=True, 
    # wo1 doesn't match the year (if we use filter_kwargs), but actually we didn't pass filter_kwargs!
    # Let's see what happens. Our SequenceService regex parses \d+.
    wo2 = work_order_factory()
    # It will extract '1' from '000001', increment to 2, and prepend year.
    assert wo2.number == f"{current_year}-000002"
