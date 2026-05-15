import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from accounting.models import AccountingSettings


@pytest.fixture
def auth_client(db):
    User = get_user_model()
    user = User.objects.create_superuser(username='vat_tester', password='pass', email='vat@test.com')
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_vat_endpoint_returns_rate_and_multiplier(auth_client):
    """GET /accounting/settings/vat/ returns rate and multiplier derived from AccountingSettings."""
    settings = AccountingSettings.get_solo()
    settings.default_vat_rate = Decimal('19.00')
    settings.save()

    res = auth_client.get('/api/accounting/settings/vat/')

    assert res.status_code == 200
    data = res.json()
    assert data['rate'] == 19.0
    assert abs(data['multiplier'] - 1.19) < 1e-9


@pytest.mark.django_db
def test_vat_endpoint_reflects_custom_rate(auth_client):
    """When vat_rate is customized, endpoint returns updated multiplier."""
    settings = AccountingSettings.get_solo()
    settings.default_vat_rate = Decimal('10.00')
    settings.save()

    res = auth_client.get('/api/accounting/settings/vat/')

    assert res.status_code == 200
    data = res.json()
    assert data['rate'] == 10.0
    assert abs(data['multiplier'] - 1.10) < 1e-9
