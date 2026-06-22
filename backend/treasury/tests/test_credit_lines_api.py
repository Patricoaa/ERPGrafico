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
from treasury.models import Bank, CreditLine, TreasuryAccount


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
def checking_account(db, bank):
    Account.objects.create(
        name='Efectivo y Equivalentes', code='1.1.01',
        account_type=AccountType.ASSET,
    )
    bank_acc = Account.objects.create(
        name='Cta API Líneas', code='1.1.01.999',
        account_type=AccountType.ASSET,
    )
    return TreasuryAccount.objects.create(
        name='Cta API Líneas', account=bank_acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank, account_number='999',
    )


@pytest.fixture
def credit_line(checking_account):
    return CreditLine.objects.create(
        treasury_account=checking_account,
        code='API-LINEA',
        currency='CLP',
        credit_limit=Decimal('50000000'),
        interest_rate=Decimal('0.80'),
        valid_from=date(2026, 1, 1),
        valid_until=date(2028, 1, 1),
        status='ACTIVE',
    )


class TestCreditLineAPI:

    def test_list_credit_lines(self, api_client, credit_line):
        resp = api_client.get('/api/treasury/credit-lines/')
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) >= 1
        assert resp.data[0]['code'] == 'API-LINEA'

    def test_list_filter_by_treasury_account(self, api_client, checking_account, credit_line):
        resp = api_client.get(f'/api/treasury/credit-lines/?treasury_account_id={checking_account.id}')
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) == 1

    def test_list_filter_by_bank(self, api_client, bank, credit_line):
        resp = api_client.get(f'/api/treasury/credit-lines/?bank_id={bank.id}')
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) == 1

    def test_create_credit_line(self, api_client, checking_account):
        payload = {
            'treasury_account': checking_account.id,
            'code': 'NUEVA-LINEA',
            'currency': 'CLP',
            'credit_limit': '100000000',
            'interest_rate': '1.0',
            'rate_basis': 'MONTHLY',
            'valid_from': '2026-01-01',
            'valid_until': '2028-01-01',
            'status': 'ACTIVE',
        }
        resp = api_client.post('/api/treasury/credit-lines/', payload, format='json')
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        assert resp.data['credit_limit'] == '100000000.00'
        # Read serializer (GET) includes computed fields
        resp2 = api_client.get(f"/api/treasury/credit-lines/{resp.data['id']}/")
        assert resp2.status_code == status.HTTP_200_OK
        assert resp2.data['used_amount'] == '0.00'
        assert resp2.data['available_amount'] == '100000000.00'
        assert resp2.data['account_name'] == checking_account.name

    def test_get_credit_line(self, api_client, credit_line):
        resp = api_client.get(f'/api/treasury/credit-lines/{credit_line.id}/')
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['code'] == 'API-LINEA'

    def test_update_credit_line(self, api_client, credit_line):
        resp = api_client.patch(
            f'/api/treasury/credit-lines/{credit_line.id}/',
            {'credit_limit': '75000000'},
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['credit_limit'] == '75000000.00'

    def test_delete_credit_line(self, api_client, credit_line):
        resp = api_client.delete(f'/api/treasury/credit-lines/{credit_line.id}/')
        assert resp.status_code == status.HTTP_204_NO_CONTENT

    def test_overview_returns_movements(self, api_client, checking_account, credit_line):
        resp = api_client.get(f'/api/treasury/credit-lines/{credit_line.id}/overview/')
        assert resp.status_code == status.HTTP_200_OK
        assert 'credit_line' in resp.data
        assert 'movements' in resp.data
