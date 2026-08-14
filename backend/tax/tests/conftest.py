import pytest
from rest_framework.test import APIClient

from core.models import User


@pytest.fixture
def api_client(db):
    client = APIClient()
    user = User.objects.create_superuser("taxdoc", "taxdoc@test.com", "pass")
    client.force_authenticate(user=user)
    return client
