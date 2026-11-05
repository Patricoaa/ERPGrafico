"""La lista de contactos calcula last_sale_date con subquery correlacionada (sin GROUP BY).

Debe devolver exactamente lo que devolvía Max("sale_orders__date"): la fecha más reciente,
None si no hay órdenes, y las fechas NULL no ganan.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from contacts.models import Contact
from core.models import User
from sales.models import SaleOrder

TODAY = date(2026, 5, 1)


@pytest.fixture
def api_client(db):
    client = APIClient(HTTP_HOST="localhost")
    client.force_authenticate(user=User.objects.create_superuser("lsd", "lsd@test.com", "pass"))
    return client


def _order(customer, when):
    return SaleOrder.objects.create(
        customer=customer,
        date=when,
        total=Decimal("100"),
        status=SaleOrder.Status.CONFIRMED,
    )


@pytest.mark.django_db
def test_last_sale_date_is_latest_order_date(api_client):
    with_orders = Contact.objects.create(name="Con ordenes", tax_id="LSD-1")
    _order(with_orders, TODAY - timedelta(days=30))
    _order(with_orders, TODAY - timedelta(days=2))
    _order(with_orders, TODAY - timedelta(days=10))
    no_orders = Contact.objects.create(name="Sin ordenes", tax_id="LSD-2")

    rows = {c["id"]: c for c in api_client.get("/api/contacts/", {"page_size": 50}).json()["results"]}

    assert rows[with_orders.id]["last_sale_date"] == str(TODAY - timedelta(days=2))
    assert rows[no_orders.id]["last_sale_date"] is None


@pytest.mark.django_db
def test_contact_list_query_has_no_group_by(api_client):
    Contact.objects.create(name="Uno", tax_id="LSD-4")

    with CaptureQueriesContext(connection) as ctx:
        response = api_client.get("/api/contacts/", {"page_size": 50})

    assert response.status_code == 200
    list_sql = [q["sql"] for q in ctx.captured_queries if '"contacts_contact"' in q["sql"] and "LIMIT" in q["sql"]]
    assert list_sql, "expected a paginated contacts query"
    def outer_level(sql):
        """SQL sin el contenido de paréntesis: solo el nivel externo de la query."""
        depth, out = 0, []
        for ch in sql:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            elif depth == 0:
                out.append(ch)
        return "".join(out)

    assert all("GROUP BY" not in outer_level(sql) for sql in list_sql)
