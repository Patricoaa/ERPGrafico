from django.test import TestCase
from datetime import date
from decimal import Decimal
from django.core.exceptions import ValidationError
from accounting.models import Account, AccountType, CFCategory, JournalEntry, JournalItem
from accounting.services import AccountingService
from treasury.models import TreasuryAccount
from finances.services import FinanceService

class TestCashFlowIntegrity(TestCase):
    
    def setUp(self):
        AccountingService.populate_ifrs_coa()
        # Create a Treasury Account (Cash)
        cash_acc = Account.objects.get(code='1.1.01.01')
        self.t_acc = TreasuryAccount.objects.create(
            name="Caja Test",
            account=cash_acc,
            account_type=TreasuryAccount.Type.CASH,
            allows_cash=True
        )

    def test_cash_flow_balanced_operating(self):
        """
        Tests that common operating movement (Customer Payment) balances correctly.
        """
        start_date = date(2024, 1, 1)
        end_date = date(2024, 1, 31)
        
        # 1. Initial State: Starting Cash 0
        cf = FinanceService.get_cash_flow(start_date, end_date)
        self.assertEqual(cf['beginning_cash'], 0)
        self.assertEqual(cf['ending_cash'], 0)
        self.assertTrue(cf['is_balanced'])
        
        # 2. Simulate Payment: Dr Cash (100) / Cr Receivable (100)
        entry = JournalEntry.objects.create(date=date(2024, 1, 15), description="Pago Cliente", status='POSTED')
        JournalItem.objects.create(entry=entry, account=self.t_acc.account, debit=100)
        JournalItem.objects.create(entry=entry, account=Account.objects.get(code='1.1.02.01'), credit=100)
        
        # 3. Validation
        cf = FinanceService.get_cash_flow(start_date, end_date)
        
        self.assertEqual(cf['beginning_cash'], 0)
        self.assertEqual(cf['ending_cash'], 100)
        self.assertEqual(cf['net_increase'], 100)
        
        found_wc = False
        for op in cf['operating']:
            if "Clientes" in op['name']:
                self.assertEqual(op['amount'], 100)
                found_wc = True
        
        self.assertTrue(found_wc)
        self.assertTrue(cf['is_balanced'])
        self.assertEqual(cf['discrepancy'], 0)

    def test_cash_flow_discrepancy_detection(self):
        """
        Tests that an unmapped movement triggers a discrepancy alert.
        """
        start_date = date(2024, 2, 1)
        end_date = date(2024, 2, 28)
        
        # 1. Post a movement to an UNMAPPED account
        bridge_acc = Account.objects.get(code='1.1.06.01')
        self.assertIsNone(bridge_acc.cf_category)
        
        entry = JournalEntry.objects.create(date=date(2024, 2, 10), description="Movimiento Huérfano", status='POSTED')
        JournalItem.objects.create(entry=entry, account=self.t_acc.account, debit=500)
        JournalItem.objects.create(entry=entry, account=bridge_acc, credit=500)
        
        # 2. Validation
        cf = FinanceService.get_cash_flow(start_date, end_date)
        
        self.assertEqual(cf['ending_cash'], 500)
        self.assertEqual(cf['calculated_net_increase'], 0)
        self.assertFalse(cf['is_balanced'])
        self.assertEqual(cf['discrepancy'], 500)
        
        self.assertGreater(len(cf['culprit_accounts']), 0)
        culprit = cf['culprit_accounts'][0]
        self.assertEqual(culprit['code'], '1.1.06.01')
        self.assertEqual(culprit['variation'], -500)

    def test_internal_transfer_neutrality(self):
        """
        Tests that transfers between cash pool accounts have zero effect on net flow.
        """
        # Create another pool account (1.1.01.02)
        acc_2 = Account.objects.get(code='1.1.01.02')
        TreasuryAccount.objects.create(
            name="Caja Secundaria",
            account=acc_2,
            account_type=TreasuryAccount.Type.CASH
        )
        
        start_date = date(2024, 3, 1)
        end_date = date(2024, 3, 31)
        
        # Move 1000 from one cash account to another
        entry = JournalEntry.objects.create(date=date(2024, 3, 10), description="Traspaso", status='POSTED')
        JournalItem.objects.create(entry=entry, account=acc_2, debit=1000)
        JournalItem.objects.create(entry=entry, account=self.t_acc.account, credit=1000)
        
        cf = FinanceService.get_cash_flow(start_date, end_date)
        
        self.assertEqual(cf['net_increase'], 0)
        self.assertEqual(cf['ending_cash'], 0)
        self.assertTrue(cf['is_balanced'])
