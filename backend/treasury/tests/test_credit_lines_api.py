"""
Tests de la API REST para CreditLine (CRUD + overview).
"""
from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from accounting.models import Account, AccountType
from treasury.models import (
    Bank, BankLoan, CreditLine, TreasuryAccount,
)


@pytest.fixture
def api_client(db):
    user = get_user_model().objects.create_superuser(username='clapi', password='x')
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def bank(db):
    return Bank.objects.create(name='Banco API Líneas', code='BAP')


@pytest.fixture
def credit_line(bank):
    return CreditLine.objects.create(
        bank=bank,
        code='API-LINEA',
        credit_line_type=CreditLine.Type.REVOLVING,
        currency='CLP',
        approved_amount=Decimal('50000000'),
        interest_rate=Decimal('0.80'),
        valid_from=date(2026, 1, 1),
        valid_until=date(2028, 1, 1),
        status=CreditLine.Status.ACTIVE,
    )


class TestCreditLineAPI:

    def test_list_credit_lines(self, api_client, credit_line):
        resp = api_client.get('/api/treasury/credit-lines/')
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) >= 1
        assert resp.data[0]['code'] == 'API-LINEA'

    def test_list_filter_by_bank(self, api_client, bank, credit_line):
        resp = api_client.get(f'/api/treasury/credit-lines/?bank_id={bank.id}')
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) == 1

    def test_create_credit_line(self, api_client, bank):
        payload = {
            'bank': bank.id,
            'code': 'NUEVA-LINEA',
            'credit_line_type': 'REVOLVING',
            'currency': 'CLP',
            'approved_amount': '100000000',
            'interest_rate': '1.0',
            'rate_basis': 'MONTHLY',
            'valid_from': '2026-01-01',
            'valid_until': '2028-01-01',
            'status': 'ACTIVE',
        }
        resp = api_client.post('/api/treasury/credit-lines/', payload, format='json')
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        # Verify via GET (read serializer includes computed fields)
        resp2 = api_client.get('/api/treasury/credit-lines/?search=NUEVA-LINEA')
        assert resp2.status_code == status.HTTP_200_OK
        data = [d for d in resp2.data if d['code'] == 'NUEVA-LINEA']
        assert len(data) == 1
        assert data[0]['drawn_amount'] == '0.00'
        assert data[0]['available_amount'] == '100000000.00'

    def test_get_credit_line(self, api_client, credit_line):
        resp = api_client.get(f'/api/treasury/credit-lines/{credit_line.id}/')
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['code'] == 'API-LINEA'

    def test_update_credit_line(self, api_client, credit_line):
        resp = api_client.patch(
            f'/api/treasury/credit-lines/{credit_line.id}/',
            {'approved_amount': '75000000'},
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['approved_amount'] == '75000000.00'

    def test_delete_credit_line(self, api_client, credit_line):
        resp = api_client.delete(f'/api/treasury/credit-lines/{credit_line.id}/')
        assert resp.status_code == status.HTTP_204_NO_CONTENT

    def test_overview_with_loans(self, api_client, bank, credit_line):
        Account.objects.create(
            name='Efectivo y Equivalentes', code='1.1.01',
            account_type=AccountType.ASSET,
        )
        bank_acc = Account.objects.create(
            name='Cta Test', code='1.1.01.999',
            account_type=AccountType.ASSET,
        )
        bank_ta = TreasuryAccount.objects.create(
            name='Cta Test', account=bank_acc,
            account_type=TreasuryAccount.Type.CHECKING,
            bank=bank, account_number='999',
        )
        liab_acc = Account.objects.create(
            name='Pasivo Test', code='2.1.99',
            account_type=AccountType.LIABILITY,
        )
        liab_ta = TreasuryAccount.objects.create(
            name='Pasivo Test', account=liab_acc,
            account_type=TreasuryAccount.Type.LOAN,
            bank=bank,
        )
        user = get_user_model().objects.first()
        BankLoan.objects.create(
            lender=bank,
            loan_number='OP-LINEA',
            currency='CLP',
            principal=Decimal('10000000'),
            interest_rate=Decimal('1.00'),
            term_months=6,
            start_date=date(2026, 6, 1),
            first_due_date=date(2026, 7, 1),
            disbursement_account=bank_ta,
            liability_account=liab_ta,
            credit_line=credit_line,
            status=BankLoan.Status.ACTIVE,
            created_by=user,
        )

        resp = api_client.get(f'/api/treasury/credit-lines/{credit_line.id}/overview/')
        assert resp.status_code == status.HTTP_200_OK
        assert 'credit_line' in resp.data
        assert 'loans' in resp.data
        assert len(resp.data['loans']) == 1
