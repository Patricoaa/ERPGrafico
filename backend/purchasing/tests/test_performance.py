import pytest
from rest_framework.test import APIClient
from django.urls import reverse
from purchasing.models import PurchaseOrder, PurchaseLine
from contacts.models import Contact

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def purchase_setup(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.create_superuser(username="testuser", password="password")
    
    supplier = Contact.objects.create(name="Test Supplier", tax_id="11111111-1")
    
    # Create 5 orders to test list queries
    orders = []
    for i in range(5):
        order = PurchaseOrder.objects.create(
            supplier=supplier,
            number=f"PO-00{i}",
            status="DRAFT"
        )
        orders.append(order)
    
    return {"user": user, "supplier": supplier, "orders": orders}

@pytest.mark.django_db(transaction=True)
def test_purchase_order_list_queries(api_client, purchase_setup, django_assert_max_num_queries):
    """
    Test that retrieving the list of purchase orders does not scale linearly
    with the number of orders (No N+1 queries).
    """
    api_client.force_authenticate(user=purchase_setup["user"])
    
    # 5 orders, should take a small fixed number of queries (e.g. < 15)
    # 1 for auth/user, 1 for main PO query, a few for prefetches
    with django_assert_max_num_queries(15):
        response = api_client.get("/api/purchasing/orders/")
    
    assert response.status_code == 200
    assert len(response.data["results"]) == 5
