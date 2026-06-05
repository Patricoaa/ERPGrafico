"""
Tests de la API de compras en tarjeta en cuotas (Onda 2,
ADR-0043). Cubre el endpoint `POST /api/treasury/movements/card-purchase/`.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import Account, AccountType
from contacts.models import Contact
from treasury.models import (
    Bank, CardPurchaseGroup, TreasuryAccount, TreasuryMovement,
)
from treasury.services import TreasuryService


User = get_user_model()


@pytest.fixture
def user(db):
    u = User.objects.create_user(username='cp_api_user', password='x')
    u.is_superuser = True
    u.is_active = True
    u.save()
    return u


@pytest.fixture
def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def bank(db):
    return Bank.objects.create(name='Banco CP API')


@pytest.fixture
def card_account(db, bank):
    liability = Account.objects.create(
        name='Visa API', code='2.1.09.500',
        account_type=AccountType.LIABILITY,
    )
    return TreasuryAccount.objects.create(
        name='Visa Cuotas API',
        account=liability, bank=bank,
        account_type=TreasuryAccount.Type.CREDIT_CARD,
    )


@pytest.fixture
def supplier(db):
    payable = Account.objects.create(
        name='Prov Cuotas', code='2.1.01.050',
        account_type=AccountType.LIABILITY,
    )
    return Contact.objects.create(
        name='Proveedor CP', tax_id='76.444.444-4',
        account_payable=payable,
    )


def _url():
    return '/api/treasury/movements/card-purchase/'


@pytest.mark.django_db
def test_card_purchase_action_creates_group(auth_client, card_account, supplier):
    """POST /card-purchase/ con 3 cuotas sin interés crea el grupo
    con 3 OUTBOUNDs."""
    resp = auth_client.post(
        _url(),
        {
            'amount': '90000.00',
            'from_account': card_account.id,
            'installments': 3,
            'monthly_rate': '0',
            'date': '2026-06-15',
            'partner': supplier.id,
            'client_reference': 'API-CP-001',
        },
        format='json',
    )
    assert resp.status_code == 201, resp.json()
    data = resp.json()
    assert data['group']['installments'] == 3
    assert data['group']['total_amount'] == '90000.00'
    assert data['group']['client_reference'] == 'API-CP-001'
    assert len(data['installments']) == 3
    amounts = [Decimal(i['amount']) for i in data['installments']]
    assert sum(amounts) == Decimal('90000.00')


@pytest.mark.django_db
def test_card_purchase_action_with_interest(auth_client, card_account, supplier):
    """POST /card-purchase/ con 3 cuotas y 1.5% mensual genera
    3 OUTBOUNDs + 3 ADJUSTMENTs."""
    resp = auth_client.post(
        _url(),
        {
            'amount': '60000.00',
            'from_account': card_account.id,
            'installments': 3,
            'monthly_rate': '0.015',
            'date': '2026-06-15',
            'partner': supplier.id,
        },
        format='json',
    )
    assert resp.status_code == 201, resp.json()
    data = resp.json()
    # Cuota francesa: 60k @ 1.5% × 3 cuotas.
    #   Cuota 1: 60000 × 0.015 = 900
    #   Cuota 2: 40000 × 0.015 = 600
    #   Cuota 3: 20000 × 0.015 = 300
    # Total interés: 1800. Total a pagar: 61800.
    assert Decimal(data['group']['total_interest']) == Decimal('1800.00')
    assert Decimal(data['group']['total_payable']) == Decimal('61800.00')
    # 6 movimientos: 3 OUTBOUNDs + 3 ADJUSTMENTs.
    assert len(data['installments']) == 6


@pytest.mark.django_db
def test_card_purchase_action_rejects_non_card_account(
    auth_client, card_account, bank,
):
    """POST con `from_account` que no es CREDIT_CARD → 400."""
    asset = Account.objects.create(
        name='Cta', code='1.1.01.900', account_type=AccountType.ASSET,
    )
    bank_ta = TreasuryAccount.objects.create(
        name='Banco', account=asset, bank=bank,
        account_type=TreasuryAccount.Type.CHECKING,
        account_number='1',
    )
    resp = auth_client.post(
        _url(),
        {
            'amount': '10000.00',
            'from_account': bank_ta.id,
            'installments': 1,
        },
        format='json',
    )
    assert resp.status_code == 400
    assert 'CREDIT_CARD' in resp.json()['error']


@pytest.mark.django_db
def test_card_purchase_action_validates_amount(
    auth_client, card_account,
):
    """amount <= 0 → 400."""
    resp = auth_client.post(
        _url(),
        {
            'amount': '0',
            'from_account': card_account.id,
            'installments': 1,
        },
        format='json',
    )
    assert resp.status_code == 400
    assert 'monto' in resp.json()['error']


@pytest.mark.django_db
def test_card_purchase_action_idempotent(
    auth_client, card_account, supplier,
):
    """Dos POSTs con misma `client_reference` no duplican."""
    payload = {
        'amount': '30000.00',
        'from_account': card_account.id,
        'installments': 2,
        'client_reference': 'API-IDEM-001',
        'partner': supplier.id,
    }
    r1 = auth_client.post(_url(), payload, format='json')
    r2 = auth_client.post(_url(), payload, format='json')
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()['group']['uuid'] == r2.json()['group']['uuid']
    # Sólo 2 movimientos, no 4.
    assert len(r1.json()['installments']) == 2
    assert len(r2.json()['installments']) == 2
