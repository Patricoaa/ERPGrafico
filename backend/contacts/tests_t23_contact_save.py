from django.test import TestCase
from accounting.models import AccountingSettings, Account, AccountType
from contacts.models import Contact
from contacts.services import ContactPartnerService

class ContactSaveT23Tests(TestCase):
    
    def setUp(self):
        self.settings = AccountingSettings.get_solo()
        asset_parent = Account.objects.create(name="Assets", account_type=AccountType.ASSET, code="1")
        equity_parent = Account.objects.create(name="Equity", account_type=AccountType.EQUITY, code="3")
        liability_parent = Account.objects.create(name="Liability", account_type=AccountType.LIABILITY, code="2")
        
        self.settings.partner_capital_contribution_account = equity_parent
        self.settings.partner_provisional_withdrawal_account = equity_parent
        self.settings.partner_current_year_earnings_account = equity_parent
        self.settings.partner_dividends_payable_account = liability_parent
        self.settings.save()

    def test_contact_save_does_not_create_partner_accounts(self):
        """
        Test for T-23.
        Creating a contact with is_partner=True directly should succeed without errors.
        Per-contact account FKs have been removed; global defaults from AccountingSettings are used.
        """
        contact = Contact.objects.create(
            name="Test Partner",
            tax_id="12345678-9",
            is_partner=True
        )
        
        promoted = ContactPartnerService.promote_to_partner(contact)
        self.assertTrue(promoted.is_partner)

    def test_promote_to_partner_succeeds(self):
        """
        Test that ContactPartnerService.promote_to_partner succeeds.
        Per-contact account FKs have been removed; global defaults from AccountingSettings are used.
        """
        contact = Contact.objects.create(
            name="Test Partner Service",
            tax_id="98765432-1",
            is_partner=False
        )
        
        ContactPartnerService.promote_to_partner(contact)
        contact.refresh_from_db()
        
        self.assertTrue(contact.is_partner)

    def test_default_customer_signal_switch(self):
        """
        Test that the post_save signal switches off other default customers.
        """
        c1 = Contact.objects.create(name="C1", tax_id="111-1", is_default_customer=True)
        c2 = Contact.objects.create(name="C2", tax_id="222-2", is_default_customer=True)
        
        c1.refresh_from_db()
        self.assertFalse(c1.is_default_customer)
        self.assertTrue(c2.is_default_customer)
