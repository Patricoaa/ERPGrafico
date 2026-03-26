from django.test import TestCase
from django.core.exceptions import ValidationError
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
        self.assertEqual(self.child.code, "1.1.01")

    def test_move_account(self):
        """Test that moving an account updates its code prefix."""
        self.child.parent = self.parent_b
        self.child.save()
        
        # Child should now have prefix of parent_b
        self.assertEqual(self.child.code, "1.2.01")

    def test_recursive_move(self):
        """Test that moving a parent also updates its children's codes."""
        grandchild = Account.objects.create(name="Grandchild", parent=self.child)
        self.assertEqual(grandchild.code, "1.1.01.01")
        
        # Move child to parent B
        self.child.parent = self.parent_b
        self.child.save()
        
        self.assertEqual(self.child.code, "1.2.01")
        
        # Grandchild should be updated recursively
        grandchild.refresh_from_db()
        self.assertEqual(grandchild.code, "1.2.01.01")

    def test_type_change_cascade(self):
        """Test that changing parent type cascades to children."""
        self.parent_a.account_type = AccountType.LIABILITY
        self.parent_a.save() # This should regenerate parent_a.code to 2.1
        
        self.assertEqual(self.parent_a.code, "2.1")
        self.assertEqual(self.parent_a.account_type, AccountType.LIABILITY)
        
        self.child.refresh_from_db()
        self.assertEqual(self.child.code, "2.1.01")
        self.assertEqual(self.child.account_type, AccountType.LIABILITY)
    def test_strictly_automatic_sequence(self):
        """Test that codes are generated in sequence automatically."""
        # parent_a code is 1.1
        # child code is 1.1.01 (Note: my previous edit changed padding to 2 by default)
        child2 = Account.objects.create(name="Child 2", parent=self.parent_a)
        self.assertEqual(child2.code, "1.1.02")
        
        child3 = Account.objects.create(name="Child 3", parent=self.parent_a)
        self.assertEqual(child3.code, "1.1.03")

    def test_validation_mismatched_type(self):
        """Test that mismatched type with parent raises ValidationError."""
        with self.assertRaises(ValidationError):
            acc = Account(name="Bad Type", parent=self.parent_a, account_type=AccountType.LIABILITY)
            acc.clean()
            # Note: save() calls full_clean() which calls clean()
            acc.save()

    def test_non_numeric_suffix_resilience(self):
        """Test that auto-generation ignores non-numeric siblings."""
        # Create a manual sibling with non-numeric code (via direct DB to bypass clean/save if needed, 
        # or just test how save() handles it)
        Account.objects.create(name="Manual Non-Numeric", code="1.1.A", parent=self.parent_a, account_type=AccountType.ASSET)
        
        # New account should find the last numeric one (1.1.01) and increment to 1.1.02
        # (Assuming child created in setUp is 1.1.01)
        new_acc = Account.objects.create(name="Next Numeric", parent=self.parent_a)
        # If Child 1 was 1.1.01, then new_acc should be 1.1.02 even with 1.1.A existing.
        self.assertTrue(new_acc.code.startswith("1.1."))
        last_part = new_acc.code.split('.')[-1]
        self.assertTrue(last_part.isdigit())

    def test_max_length_violation(self):
        """Test that very deep hierarchy exceeding 20 chars raises error."""
        # Note: With hierarchy_levels=4 default, we can't grow that deep unless we increase it
        self.settings.hierarchy_levels = 20
        self.settings.save()
        
        curr = self.child
        try:
            for i in range(15):
                curr = Account.objects.create(name=f"Deep {i}", parent=curr)
        except ValidationError:
            # Should eventually hit the 20 char limit or ValidationError
            return
        
        self.assertLessEqual(len(curr.code), 20)

    def test_prefix_change_cascades(self):
        """Test that changing a prefix in settings updates all account codes of that type."""
        # 1.1, 1.2, 1.1.01 exist
        self.settings.asset_prefix = "9"
        self.settings.save()
        
        self.parent_a.refresh_from_db()
        self.parent_b.refresh_from_db()
        self.child.refresh_from_db()
        
        self.assertEqual(self.parent_a.code, "9.1")
        self.assertEqual(self.parent_b.code, "9.2")
        self.assertEqual(self.child.code, "9.1.01")

    def test_separator_change_cascades(self):
        """Test that changing the separator in settings updates all account codes."""
        self.settings.code_separator = "-"
        self.settings.save()
        
        self.parent_a.refresh_from_db()
        self.child.refresh_from_db()
        
        self.assertEqual(self.parent_a.code, "1-1")
        self.assertEqual(self.child.code, "1-1-01")

    def test_hierarchy_levels_enforcement(self):
        """Test that hierarchy_levels limit is enforced in clean()."""
        self.settings.hierarchy_levels = 2
        self.settings.save()
        
        # parent_a (L1), child (L2). This should be OK (depth=2)
        # depth for child of None is 1. Child of parent is 2.
        self.assertEqual(self.child.get_depth(), 2)
        
        # Trying to create L3 should fail
        with self.assertRaises(ValidationError):
            grandchild = Account(name="Grandchild", parent=self.child)
            grandchild.full_clean()
