"""
Búsqueda global en PostgreSQL: `GlobalSearchIndex.search_vector` usa un campo propio
(core/db_compat.SearchVectorField) que no traía el lookup de FTS → `tsvector = tsquery`
y la búsqueda fallaba siempre. Solo corre con PostgreSQL.
"""

import pytest
from django.contrib.auth import get_user_model
from django.db import connection

from contacts.models import Contact
from core.registry import UniversalRegistry
from sales.models import SaleOrder

pytestmark = pytest.mark.skipif(connection.vendor != "postgresql", reason="requiere PostgreSQL")


@pytest.mark.django_db
def test_universal_search_runs_full_text_on_postgres():
    user = get_user_model().objects.create_superuser(username="fts", password="x", email="fts@x.cl")
    customer = Contact.objects.create(name="Imprenta Aurora", tax_id="12345678-9")
    order = SaleOrder.objects.create(customer=customer, date="2026-10-15")

    results = UniversalRegistry.search("Aurora", user=user, limit=5)

    assert any(r["label"] == "sales.saleorder" and str(r["id"]) == str(order.pk) for r in results), results
    assert all("detail_url" in r for r in results)
