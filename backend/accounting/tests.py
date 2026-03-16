from django.test import TestCase
from django.core.exceptions import ValidationError
from decimal import Decimal
from .models import Account, AccountType, JournalEntry, JournalItem
from .services import JournalEntryService
from datetime import date

class AccountingServiceTest(TestCase):
    def setUp(self):
        self.asset_account = Account.objects.create(code="1.1.01", name="Caja", account_type=AccountType.ASSET)
        self.income_account = Account.objects.create(code="4.1.01", name="Ventas", account_type=AccountType.INCOME)

    def test_post_balanced_entry(self):
        """Test that a balanced entry can be posted."""
        entry = JournalEntry.objects.create(date=date.today(), description="Venta contado")
        JournalItem.objects.create(entry=entry, account=self.asset_account, debit=Decimal('100.00'), credit=Decimal('0.00'))
        JournalItem.objects.create(entry=entry, account=self.income_account, debit=Decimal('0.00'), credit=Decimal('100.00'))
        
        posted_entry = JournalEntryService.post_entry(entry)
        self.assertEqual(posted_entry.status, JournalEntry.State.POSTED)

    def test_prevent_unbalanced_entry(self):
        """Test that an unbalanced entry raises ValidationError."""
        entry = JournalEntry.objects.create(date=date.today(), description="Venta error")
        JournalItem.objects.create(entry=entry, account=self.asset_account, debit=Decimal('100.00'), credit=Decimal('0.00'))
        JournalItem.objects.create(entry=entry, account=self.income_account, debit=Decimal('0.00'), credit=Decimal('50.00')) # Missing 50
        
        with self.assertRaises(ValidationError):
            JournalEntryService.post_entry(entry)

    def test_prevent_empty_entry(self):
        """Test that an entry with no items raises ValidationError."""
        entry = JournalEntry.objects.create(date=date.today(), description="Venta vacía")
        with self.assertRaises(ValidationError):
            JournalEntryService.post_entry(entry)
