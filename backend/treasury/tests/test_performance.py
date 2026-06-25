import pytest
from rest_framework.test import APIClient
from treasury.models import TreasuryMovement, TreasuryAccount
from contacts.models import Contact

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def treasury_setup(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.create_superuser(username="treasuryuser", password="password")
    
    contact = Contact.objects.create(name="Test Contact", tax_id="12345678-9")
    account = TreasuryAccount.objects.create(name="Test Account", currency="CLP", account_type="CASH")
    
    movements = []
    for i in range(5):
        mov = TreasuryMovement.objects.create(
            movement_type="INBOUND",
            payment_method="TRANSFER",
            amount=1000,
            contact=contact,
            to_account=account,
            status="DRAFT"
        )
        movements.append(mov)
    
    return {"user": user, "contact": contact, "account": account, "movements": movements}

@pytest.mark.django_db(transaction=True)
def test_treasury_movements_list_queries(api_client, treasury_setup, django_assert_max_num_queries):
    """
    Test that retrieving the list of treasury movements does not scale linearly
    with the number of movements (No N+1 queries).
    """
    api_client.force_authenticate(user=treasury_setup["user"])
    
    # Check that it requires < 15 queries to retrieve 5 movements
    with django_assert_max_num_queries(15):
        response = api_client.get("/api/treasury/movements/")
    
    assert response.status_code == 200
    assert len(response.data["results"]) == 5
