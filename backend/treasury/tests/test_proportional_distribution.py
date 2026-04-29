import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from treasury.models import BankStatement, BankStatementLine, TreasuryMovement, TreasuryAccount
from treasury.matching_service import MatchingService
from accounting.models import Account, AccountType

User = get_user_model()

@pytest.fixture
def setup_data(db):
    user = User.objects.create_user(username='testuser', password='password')
    
    # Setup Accounting Account
    acc = Account.objects.create(
        name='Bank Account',
        code='1.1.01.001',
        account_type=AccountType.ASSET
    )
    
    # Setup Bank
    from treasury.models import Bank
    bank = Bank.objects.create(name='Test Bank', code='TB')
    
    # Setup Treasury Account
    treasury_acc = TreasuryAccount.objects.create(
        name='Main Bank',
        account=acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank,
        account_number='123456'
    )
    
    # Setup Statement
    statement = BankStatement.objects.create(
        treasury_account=treasury_acc,
        statement_date='2026-01-01',
        opening_balance=0,
        closing_balance=1000,
        imported_by=user
    )
    
    return {
        'user': user,
        'treasury_acc': treasury_acc,
        'statement': statement
    }

@pytest.mark.django_db
def test_proportional_difference_distribution(setup_data):
    user = setup_data['user']
    statement = setup_data['statement']
    
    # Create 2 lines: L1 ($600) and L2 ($400) = $1000
    l1 = BankStatementLine.objects.create(
        statement=statement,
        line_number=1,
        transaction_date='2026-01-01',
        description='Line 1',
        credit=Decimal('600.00'),
        debit=0,
        balance=Decimal('600.00')
    )
    l2 = BankStatementLine.objects.create(
        statement=statement,
        line_number=2,
        transaction_date='2026-01-01',
        description='Line 2',
        credit=Decimal('400.00'),
        debit=0,
        balance=Decimal('1000.00')
    )
    
    # Create 1 payment: $900
    p1 = TreasuryMovement.objects.create(
        movement_type='INBOUND',
        to_account=setup_data['treasury_acc'],
        amount=Decimal('900.00'),
        date='2026-01-01',
        created_by=user
    )
    
    # Create match group
    # Total lines = 1000, Total payments = 900, Diff = 100
    group = MatchingService.create_match_group(
        line_ids=[l1.id, l2.id],
        movement_ids=[p1.id],
        user=user,
        difference_reason='COMMISSION'
    )
    
    # Refresh lines
    l1.refresh_from_db()
    l2.refresh_from_db()
    
    # Verify distribution
    # L1: 60% of 100 = 60
    # L2: 40% of 100 = 40
    assert l1.difference_amount == Decimal('60.00')
    assert l2.difference_amount == Decimal('40.00')
    assert l1.difference_reason == 'COMMISSION'
    assert l2.difference_reason == 'COMMISSION'
    
    # Verify group notes
    group.refresh_from_db()
    assert "[Reparto proporcional: L1: 60.00, L2: 40.00]" in group.notes

@pytest.mark.django_db
def test_rounding_adjustment_in_distribution(setup_data):
    user = setup_data['user']
    statement = setup_data['statement']
    
    # Create 3 lines: L1 ($333.33), L2 ($333.33), L3 ($333.34) = $1000
    # Payment: $900
    # Diff: $100
    # Proportions: 0.33333, 0.33333, 0.33334
    # L1: 100 * 0.33333 = 33.33
    # L2: 100 * 0.33333 = 33.33
    # L3: Remainder = 100 - 33.33 - 33.33 = 33.34
    
    l1 = BankStatementLine.objects.create(
        statement=statement,
        line_number=3,
        transaction_date='2026-01-01',
        description='L1',
        credit=Decimal('333.33'),
        debit=0,
        balance=Decimal('333.33')
    )
    l2 = BankStatementLine.objects.create(
        statement=statement,
        line_number=4,
        transaction_date='2026-01-01',
        description='L2',
        credit=Decimal('333.33'),
        debit=0,
        balance=Decimal('666.66')
    )
    l3 = BankStatementLine.objects.create(
        statement=statement,
        line_number=5,
        transaction_date='2026-01-01',
        description='L3',
        credit=Decimal('333.34'),
        debit=0,
        balance=Decimal('1000.00')
    )
    
    p1 = TreasuryMovement.objects.create(
        movement_type='INBOUND',
        to_account=setup_data['treasury_acc'],
        amount=Decimal('900.00'),
        date='2026-01-01',
        created_by=user
    )
    
    group = MatchingService.create_match_group(
        line_ids=[l1.id, l2.id, l3.id],
        movement_ids=[p1.id],
        user=user
    )
    
    l1.refresh_from_db()
    l2.refresh_from_db()
    l3.refresh_from_db()
    
    assert l1.difference_amount == Decimal('33.33')
    assert l2.difference_amount == Decimal('33.33')
    assert l3.difference_amount == Decimal('33.34')
    assert l1.difference_amount + l2.difference_amount + l3.difference_amount == Decimal('100.00')

@pytest.mark.django_db
def test_adjustment_entry_is_draft(setup_data):
    from treasury.difference_service import DifferenceService
    from accounting.models import JournalEntry, AccountingSettings
    
    user = setup_data['user']
    statement = setup_data['statement']
    
    # Setup Accounting Settings with dummy accounts
    acc_diff = Account.objects.create(
        name='Commision Account',
        code='5.1.01.001',
        account_type=AccountType.EXPENSE
    )
    AccountingSettings.objects.create(
        bank_commission_account=acc_diff
    )
    
    l1 = BankStatementLine.objects.create(
        statement=statement,
        line_number=6,
        transaction_date='2026-01-01',
        description='Diff Line',
        credit=Decimal('100.00'),
        debit=0,
        balance=Decimal('100.00'),
        difference_amount=Decimal('10.00') # Must have diff
    )
    
    # Create adjustment
    entry = DifferenceService.create_difference_adjustment(
        line=l1,
        difference_type=DifferenceService.COMMISSION,
        user=user
    )
    
    assert entry.status == JournalEntry.State.DRAFT
    assert l1.difference_journal_entry == entry


