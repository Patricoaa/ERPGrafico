import pytest
from rest_framework.test import APIClient

from core.tests.rbac_factories import make_user

pytestmark = pytest.mark.django_db


def test_f29_declaration_requires_model_permission():
    c = APIClient()
    c.force_authenticate(user=make_user("t1"))
    assert c.get("/api/tax/declarations/").status_code == 403
    c.force_authenticate(user=make_user("t2", "tax.view_f29declaration"))
    assert c.get("/api/tax/declarations/").status_code == 200


@pytest.mark.parametrize("url", ["/api/tax/periods/check_closed/", "/api/tax/accounting-periods/check_closed/"])
def test_check_closed_requires_authentication(url):
    c = APIClient()
    assert c.get(url).status_code in (401, 403)
    c.force_authenticate(user=make_user("t3"))
    assert c.get(url).status_code != 401
    assert c.get(url).status_code != 403
