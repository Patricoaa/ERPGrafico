from django.test import TestCase
from .models import Account, AccountType, AccountingSettings

class AccountHierarchyTest(TestCase):
    def setUp(self):
        self.settings = AccountingSettings.objects.create(
            asset_prefix="1",
            liability_prefix="2",
            equity_prefix="3",
            income_prefix="4",
            expense_prefix="5"
        )
        self.parent_a = Account.objects.create(name="Parent A", account_type=AccountType.ASSET)
        # Parent A code should be 1.1
        
        self.parent_b = Account.objects.create(name="Parent B", account_type=AccountType.ASSET)
        # Parent B code should be 1.2
        
        self.child = Account.objects.create(name="Child", parent=self.parent_a)
        # Child code should be 1.1.1

    def test_code_generation(self):
        self.assertEqual(self.parent_a.code, "1.1")
        self.assertEqual(self.parent_b.code, "1.2")
        self.assertEqual(self.child.code, "1.1.1")

    def test_move_account(self):
        """Test that moving an account updates its code prefix."""
        self.child.parent = self.parent_b
        self.child.save()
        
        # Child should now have prefix of parent_b
        self.assertEqual(self.child.code, "1.2.1")

    def test_recursive_move(self):
        """Test that moving a parent also updates its children's codes."""
        grandchild = Account.objects.create(name="Grandchild", parent=self.child)
        self.assertEqual(grandchild.code, "1.1.1.1")
        
        # Move child to parent B
        self.child.parent = self.parent_b
        self.child.save()
        
        self.assertEqual(self.child.code, "1.2.1")
        
        # Grandchild should be updated recursively
        grandchild.refresh_from_db()
        self.assertEqual(grandchild.code, "1.2.1.1")

    def test_type_change_cascade(self):
        """Test that changing parent type cascades to children."""
        self.parent_a.account_type = AccountType.LIABILITY
        self.parent_a.save() # This should regenerate parent_a.code to 2.1
        
        self.assertEqual(self.parent_a.code, "2.1")
        self.assertEqual(self.parent_a.account_type, AccountType.LIABILITY)
        
        self.child.refresh_from_db()
        self.assertEqual(self.child.code, "2.1.1")
        self.assertEqual(self.child.account_type, AccountType.LIABILITY)
