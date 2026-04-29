import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from treasury.models import BankStatement, BankStatementLine, TreasuryMovement, TreasuryAccount, Bank
from treasury.matching_service import MatchingService
from accounting.models import Account, AccountType, JournalEntry

User = get_user_model()

@pytest.fixture
def setup_data(db):
    user = User.objects.create_user(username='testuser', password='password')
    
    # Setup Accounting Accounts
    bank_acc_cont = Account.objects.create(
        name='Bank Account',
        code='1.1.01.001',
        account_type=AccountType.ASSET
    )
    card_acc_cont = Account.objects.create(
        name='Card Account',
        code='1.1.01.002',
        account_type=AccountType.ASSET
    )
    
    # Setup Bank
    bank = Bank.objects.create(name='Test Bank', code='TB')
    
    # Setup Treasury Accounts
    bank_treasury = TreasuryAccount.objects.create(
        name='Bank Treasury',
        account=bank_acc_cont,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank,
        account_number='123456'
    )
    card_treasury = TreasuryAccount.objects.create(
        name='Card Treasury',
        account=card_acc_cont,
        account_type=TreasuryAccount.Type.MERCHANT,
        bank=bank
    )
    
    # Setup Statement in Bank Treasury
    statement = BankStatement.objects.create(
        treasury_account=bank_treasury,
        statement_date='2026-01-01',
        opening_balance=0,
        closing_balance=1000,
        imported_by=user
    )
    
    return {
        'user': user,
        'bank_treasury': bank_treasury,
        'card_treasury': card_treasury,
        'statement': statement,
        'bank_acc_cont': bank_acc_cont,
        'card_acc_cont': card_acc_cont
    }

@pytest.mark.django_db
def test_transfer_traceability_on_confirm_match(setup_data):
    user = setup_data['user']
    statement = setup_data['statement']
    
    # Line in Bank Treasury: $100
    line = BankStatementLine.objects.create(
        statement=statement,
        line_number=1,
        transaction_date='2026-01-01',
        description='Payment received',
        credit=Decimal('100.00'),
        debit=0,
        balance=Decimal('100.00')
    )
    
    # Movement in Card Treasury: $100
    # This simulates a mismatch: payment in Card, statement in Bank.
    movement = TreasuryMovement.objects.create(
        movement_type='INBOUND',
        to_account=setup_data['card_treasury'],
        amount=Decimal('100.00'),
        date='2026-01-01',
        created_by=user,
        account=setup_data['card_acc_cont'] # Use Card account
    )
    
    # Create Match
    group = MatchingService.create_match_group(
        line_ids=[line.id],
        movement_ids=[movement.id],
        user=user
    )
    
    # Confirm Match
    MatchingService.confirm_match(line.id, user)
    
    group.refresh_from_db()
    
    # Verify that a transfer entry was created and linked
    assert group.transfer_journal_entries.count() == 1
    transfer = group.transfer_journal_entries.first()
    assert transfer.reference == f"Transferencia Conciliación {statement.display_id}"
    assert transfer.status == JournalEntry.State.DRAFT
    
    # Verify items
    items = transfer.items.all()
    assert items.count() == 2
    
    # Dr Bank ($100), Cr Card ($100)
    dr_item = items.get(account=setup_data['bank_acc_cont'])
    cr_item = items.get(account=setup_data['card_acc_cont'])
    
    assert dr_item.debit == Decimal('100.00')
    assert cr_item.credit == Decimal('100.00')
