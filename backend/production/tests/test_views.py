import pytest
from datetime import date


@pytest.mark.django_db
def test_filter_due_date_after(api_client, work_order_factory):
    wo_past = work_order_factory(estimated_completion_date=date(2026, 4, 15))
    wo_future = work_order_factory(estimated_completion_date=date(2026, 6, 15))

    res = api_client.get('/api/production/orders/?due_date_after=2026-05-01')

    assert res.status_code == 200
    data = res.json()
    items = data['results'] if isinstance(data, dict) else data
    ids = [w['id'] for w in items]
    assert wo_future.id in ids
    assert wo_past.id not in ids


@pytest.mark.django_db
def test_filter_due_date_before(api_client, work_order_factory):
    wo_past = work_order_factory(estimated_completion_date=date(2026, 4, 15))
    wo_future = work_order_factory(estimated_completion_date=date(2026, 6, 15))

    res = api_client.get('/api/production/orders/?due_date_before=2026-05-01')

    assert res.status_code == 200
    data = res.json()
    items = data['results'] if isinstance(data, dict) else data
    ids = [w['id'] for w in items]
    assert wo_past.id in ids
    assert wo_future.id not in ids


@pytest.mark.django_db
def test_filter_due_date_range(api_client, work_order_factory):
    wo_early = work_order_factory(estimated_completion_date=date(2026, 4, 15))
    wo_mid = work_order_factory(estimated_completion_date=date(2026, 5, 15))
    wo_late = work_order_factory(estimated_completion_date=date(2026, 6, 15))

    res = api_client.get('/api/production/orders/?due_date_after=2026-05-01&due_date_before=2026-05-31')

    assert res.status_code == 200
    data = res.json()
    items = data['results'] if isinstance(data, dict) else data
    ids = [w['id'] for w in items]
    assert wo_mid.id in ids
    assert wo_early.id not in ids
    assert wo_late.id not in ids
