import pytest
from rest_framework.test import APIClient
from sales.models import SaleOrder
from contacts.models import Contact

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def sales_setup(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.create_superuser(username="salesuser", password="password")
    
    customer = Contact.objects.create(name="Test Customer", tax_id="12345678-9")
    
    orders = []
    for i in range(5):
        order = SaleOrder.objects.create(
            customer=customer,
            status="DRAFT"
        )
        orders.append(order)
    
    return {"user": user, "orders": orders}

@pytest.mark.django_db(transaction=True)
def test_sale_order_list_queries(api_client, sales_setup, django_assert_max_num_queries):
    """
    Test that retrieving the list of sale orders does not scale linearly
    with the number of orders (No N+1 queries).
    """
    api_client.force_authenticate(user=sales_setup["user"])
    
    with django_assert_max_num_queries(15):
        response = api_client.get("/api/sales/orders/")
    
    assert response.status_code == 200
    assert len(response.data["results"]) == 5
