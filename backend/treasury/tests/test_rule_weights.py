"""
Tests — S1.2: Fix RuleService.simulate_rule weights
===================================================

DoD del roadmap:
  "test: simular regla con weights {amount:80, date:20} produce score distinto del default"
"""

import pytest
from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model

from treasury.models import (
    ReconciliationRule,
    BankStatement,
    BankStatementLine,
    TreasuryMovement,
    TreasuryAccount,
    Bank
)
from treasury.rule_service import RuleService

User = get_user_model()

@pytest.fixture
def user(db):
    return User.objects.create_user(username="testuser", password="pass")

@pytest.fixture
def test_data(db, user):
    from accounting.models import Account, AccountType
    
    # 1. Crear cuentas
    acct = Account.objects.create(name="Banco", code="1.1.01.01", account_type=AccountType.ASSET)
    bank = Bank.objects.create(name="Bank Test")
    treasury_account = TreasuryAccount.objects.create(
        name="Cuenta Test",
        account_number="123",
        bank=bank,
        account=acct,
        account_type="CHECKING",
        currency="CLP",
    )
    
    # 2. Crear statement & line
    statement = BankStatement.objects.create(
        treasury_account=treasury_account,
        statement_date=date(2026, 4, 1),
        opening_balance=0,
        closing_balance=1000,
        imported_by=user,
    )
    line = BankStatementLine.objects.create(
        statement=statement,
        line_number=1,
        transaction_date=date(2026, 4, 1),
        description="Pago Cliente",
        reference="REF123",
        credit=1000,
        debit=0,
        balance=1000,
        reconciliation_status="UNRECONCILED",
    )
    
    # 3. Crear movement exacto
    movement = TreasuryMovement.objects.create(
        account=acct,
        date=date(2026, 4, 1),
        amount=1000,
        movement_type="INBOUND",
        transaction_number="REF123",
    )
    
    return {
        "line": line,
        "movement": movement,
        "treasury_account": treasury_account,
    }


class TestCalculateRuleScore:
    def test_default_weights(self, test_data):
        line = test_data["line"]
        movement = test_data["movement"]
        
        # Regla sin weights => usa defaults: amount=40, date=30, reference=20, contact=10
        rule = ReconciliationRule(match_config={})
        
        score = RuleService._calculate_rule_score(line, movement, rule)
        # amount exacto (+40), date exacto (+30), ref coincide (+20), contact no hay (+0) = 90
        assert score == 90

    def test_custom_weights_no_fallback_mixing(self, test_data):
        """
        DoD: Simular regla con weights {amount:80, date:20} produce score distinto del default.
        Además, garantiza que 'reference' no suma 20 mágicamente por default.
        """
        line = test_data["line"]
        movement = test_data["movement"]
        
        # Regla con custom weights
        rule = ReconciliationRule(match_config={"weights": {"amount": 80, "date": 20}})
        
        score = RuleService._calculate_rule_score(line, movement, rule)
        # amount exacto (+80), date exacto (+20), ref coincide pero peso es 0 (+0) = 100
        assert score == 100


class TestSimulateRule:
    def test_simulate_rule_respects_custom_weights(self, test_data):
        treasury_account = test_data["treasury_account"]
        
        # Ejecutamos simulate_rule que llama internamente a _calculate_rule_score
        results = RuleService.simulate_rule(
            rule_data={"match_config": {"criteria": ["amount_exact"], "weights": {"amount": 80, "date": 20}, "min_score": 50}},
            treasury_account_id=treasury_account.id
        )
        
        assert len(results) == 1
        assert results[0]["score"] == 100
