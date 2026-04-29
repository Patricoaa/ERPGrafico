import pytest
from decimal import Decimal
from datetime import date, timedelta
from django.utils import timezone
from treasury.models import BankStatement, BankStatementLine, TreasuryAccount
from treasury.reconciliation_service import ReconciliationService

@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(username='tester', password='pwd')

from accounting.models import Account

@pytest.fixture
def account(db):
    accounting_account = Account.objects.create(
        name="Caja Test",
        code="1.1.01.999",
        account_type="ASSET"
    )
    return TreasuryAccount.objects.create(
        name="Test Account",
        account_type="CASH",
        currency="CLP",
        account=accounting_account
    )

@pytest.mark.django_db
class TestReconciliationOverlap:
    def test_overlapping_with_confirmed(self, account, user):
        # Crear cartola existente confirmada
        existing_stmt = BankStatement.objects.create(
            treasury_account=account,
            statement_date=date(2023, 2, 15),
            period_start=date(2023, 2, 1),
            period_end=date(2023, 2, 15),
            opening_balance=1000,
            closing_balance=1500,
            imported_by=user,
            status='CONFIRMED'
        )
        
        parsed_data = {
            'statement_date': date(2023, 2, 10),
            'opening_balance': Decimal('1000.00'),
            'closing_balance': Decimal('1500.00'),
            'lines': [
                {
                    'line_number': 1,
                    'transaction_date': date(2023, 2, 10),
                    'description': 'Test',
                    'debit': Decimal('0'),
                    'credit': Decimal('500'),
                    'balance': Decimal('1500')
                }
            ]
        }
        
        result = ReconciliationService.validate_statement(parsed_data, account)
        
        assert not result['is_valid']
        assert any('se solapa con una cartola confirmada existente' in err for err in result['errors'])

    def test_overlapping_with_draft(self, account, user):
        # Crear cartola existente en borrador
        existing_stmt = BankStatement.objects.create(
            treasury_account=account,
            statement_date=date(2023, 2, 15),
            period_start=date(2023, 2, 1),
            period_end=date(2023, 2, 15),
            opening_balance=1000,
            closing_balance=1500,
            imported_by=user,
            status='DRAFT'
        )
        
        parsed_data = {
            'statement_date': date(2023, 2, 10),
            'opening_balance': Decimal('1000.00'),
            'closing_balance': Decimal('1500.00'),
            'lines': [
                {
                    'line_number': 1,
                    'transaction_date': date(2023, 2, 10),
                    'description': 'Test',
                    'debit': Decimal('0'),
                    'credit': Decimal('500'),
                    'balance': Decimal('1500')
                }
            ]
        }
           # El mock parser creará fechas en ese mismo periodo
        result = ReconciliationService.validate_statement(parsed_data, account)
    
        # Debería ser válida, pero con advertencia
        assert result['is_valid']
        assert any('se solapa con una cartola en borrador' in warn['message'] for warn in result['warnings'])

    def test_balance_discontinuity(self, account, user):
        # Crear cartola anterior confirmada
        existing_stmt = BankStatement.objects.create(
            treasury_account=account,
            statement_date=date(2023, 1, 31),
            period_start=date(2023, 1, 1),
            period_end=date(2023, 1, 31),
            opening_balance=0,
            closing_balance=1000, # Saldo final 1000
            imported_by=user,
            status='CONFIRMED'
        )
        
        # Nueva cartola de febrero, saldo inicial 900 (inconsistente)
        parsed_data = {
            'statement_date': date(2023, 2, 28),
            'opening_balance': Decimal('900.00'), 
            'closing_balance': Decimal('1400.00'),
            'lines': [
                {
                    'line_number': 1,
                    'transaction_date': date(2023, 2, 10),
                    'description': 'Test',
                    'debit': Decimal('0'),
                    'credit': Decimal('500'),
                    'balance': Decimal('1400')
                }
            ]
        }
        
        result = ReconciliationService.validate_statement(parsed_data, account)
    
        # Debería ser válida, pero con advertencia de discontinuidad
        assert result['is_valid']
        assert any('Discontinuidad de saldos' in warn['message'] for warn in result['warnings'])
