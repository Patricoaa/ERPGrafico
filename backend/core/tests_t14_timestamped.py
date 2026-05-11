"""
T-14 — Tests de acceptance para TimeStampedModel en modelos sin timestamps previos.

Verifica que:
  1. Las instancias creadas tienen created_at <= updated_at.
  2. Los modelos migrados exponen ambos campos.

Diseño: Tests unitarios con Django TestCase. No requieren datos de producción.
Se puede correr con:
    pytest backend/core/tests_t14_timestamped.py -v
    o bien:
    python manage.py test core.tests_t14_timestamped
"""
from django.test import TestCase
from django.utils import timezone


class TimeStampedModelT14Test(TestCase):
    """
    Verifica que todos los modelos migrados en T-14 exponen created_at / updated_at
    y que para una nueva instancia: created_at <= updated_at.
    """

    def _assert_timestamps(self, instance, label: str):
        self.assertTrue(
            hasattr(instance, 'created_at'),
            f"{label} debe tener created_at (TimeStampedModel)"
        )
        self.assertTrue(
            hasattr(instance, 'updated_at'),
            f"{label} debe tener updated_at (TimeStampedModel)"
        )
        self.assertIsNotNone(instance.created_at, f"{label}.created_at no debe ser None")
        self.assertIsNotNone(instance.updated_at, f"{label}.updated_at no debe ser None")
        self.assertLessEqual(
            instance.created_at,
            instance.updated_at,
            f"{label}: created_at debe ser <= updated_at"
        )

    # ----- accounting -----

    def test_account_has_timestamps(self):
        from accounting.models import Account
        account = Account.objects.create(
            name='Test Activo',
            account_type='ASSET',
        )
        self._assert_timestamps(account, 'Account')

    def test_journal_item_has_timestamps(self):
        from accounting.models import Account, JournalEntry, JournalItem
        entry = JournalEntry.objects.create(
            description='Test Entry',
            date=timezone.now().date(),
        )
        debit_account = Account.objects.create(name='Caja Test', account_type='ASSET')
        credit_account = Account.objects.create(name='Capital Test', account_type='EQUITY')
        JournalItem.objects.create(entry=entry, account=debit_account, debit=1000, credit=0)
        item = JournalItem.objects.create(entry=entry, account=credit_account, debit=0, credit=1000)
        self._assert_timestamps(item, 'JournalItem')

    def test_budget_has_timestamps(self):
        from accounting.models import Budget
        budget = Budget.objects.create(
            name='Presupuesto Test',
            start_date='2024-01-01',
            end_date='2024-12-31',
        )
        self._assert_timestamps(budget, 'Budget')

    def test_budget_item_has_timestamps(self):
        from accounting.models import Account, Budget, BudgetItem
        budget = Budget.objects.create(
            name='Budget Item Test',
            start_date='2024-01-01',
            end_date='2024-12-31',
        )
        account = Account.objects.create(name='Cuenta Gasto Test', account_type='EXPENSE')
        item = BudgetItem.objects.create(budget=budget, account=account, year=2024, month=1, amount=100000)
        self._assert_timestamps(item, 'BudgetItem')

    # ----- inventory -----

    def test_product_category_has_timestamps(self):
        from inventory.models import ProductCategory
        cat = ProductCategory.objects.create(name='Test Category')
        self._assert_timestamps(cat, 'ProductCategory')

    def test_uom_category_has_timestamps(self):
        from inventory.models import UoMCategory
        cat = UoMCategory.objects.create(name='Unidad Test')
        self._assert_timestamps(cat, 'UoMCategory')

    def test_uom_has_timestamps(self):
        from inventory.models import UoMCategory, UoM
        cat = UoMCategory.objects.create(name='UoM Cat Test')
        uom = UoM.objects.create(name='Pieza', category=cat, uom_type='REFERENCE')
        self._assert_timestamps(uom, 'UoM')

    def test_product_attribute_has_timestamps(self):
        from inventory.models import ProductAttribute
        attr = ProductAttribute.objects.create(name='Color')
        self._assert_timestamps(attr, 'ProductAttribute')

    def test_product_attribute_value_has_timestamps(self):
        from inventory.models import ProductAttribute, ProductAttributeValue
        attr = ProductAttribute.objects.create(name='Talla')
        val = ProductAttributeValue.objects.create(attribute=attr, value='XL')
        self._assert_timestamps(val, 'ProductAttributeValue')

    # ----- sales -----

    def test_sales_settings_has_timestamps(self):
        from sales.models import SalesSettings
        s = SalesSettings.objects.create()
        self._assert_timestamps(s, 'SalesSettings')

    # ----- hr -----

    def test_global_hr_settings_has_timestamps(self):
        from hr.models import GlobalHRSettings
        s = GlobalHRSettings.objects.create()
        self._assert_timestamps(s, 'GlobalHRSettings')

    # ----- workflow -----

    def test_workflow_settings_has_timestamps(self):
        from workflow.models import WorkflowSettings
        s = WorkflowSettings.objects.create()
        self._assert_timestamps(s, 'WorkflowSettings')

    # ----- treasury -----

    def test_reconciliation_settings_has_timestamps(self):
        from treasury.models import ReconciliationSettings
        s = ReconciliationSettings.objects.create()
        self._assert_timestamps(s, 'ReconciliationSettings')
