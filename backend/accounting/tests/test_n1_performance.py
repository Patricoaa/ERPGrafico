import pytest
from rest_framework.test import APIClient
from accounting.models import JournalEntry, JournalItem, Account
from contacts.models import Contact

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def accounting_setup(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.create_superuser(username="accountinguser", password="password")
    
    # We need a contact
    contact = Contact.objects.create(name="Test Contact", tax_id="12345678-9")
    
    # Needs two accounts
    debit_account = Account.objects.create(code="10000000", name="Assets", account_type="ASSET")
    credit_account = Account.objects.create(code="20000000", name="Liabilities", account_type="LIABILITY")
    
    entries = []
    for i in range(5):
        entry = JournalEntry.objects.create(
            description=f"Test Entry {i}",
            date="2024-01-01",
            status="DRAFT"
        )
        JournalItem.objects.create(
            entry=entry,
            account=debit_account,
            debit=1000,
            credit=0,
            partner=contact
        )
        JournalItem.objects.create(
            entry=entry,
            account=credit_account,
            debit=0,
            credit=1000,
            partner=contact
        )
        entries.append(entry)
    
    return {"user": user, "entries": entries}

@pytest.mark.django_db(transaction=True)
def test_journal_entries_list_queries(api_client, accounting_setup, django_assert_max_num_queries):
    """
    Test that retrieving the list of journal entries does not scale linearly
    with the number of entries (No N+1 queries).
    """
    api_client.force_authenticate(user=accounting_setup["user"])
    
    with django_assert_max_num_queries(15):
        response = api_client.get("/api/accounting/entries/")
    
    assert response.status_code == 200
    assert len(response.data["results"]) == 5
