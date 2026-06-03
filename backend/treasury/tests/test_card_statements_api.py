"""
test_card_statements_api.py — Tests de la API REST de estados de cuenta
de tarjeta de crédito propia (F3.5).

Cubre:
  - CRUD básico de CreditCardStatement.
  - Acciones: pay, apply_charges, cancel.
  - Validación: card_account debe ser CREDIT_CARD, due_date >= cut_off_date.
  - Permisos: solo autenticados.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import Account, AccountType
from billing.models import Invoice
from contacts.models import Contact
from treasury.models import (
    Bank, CreditCardStatement, TreasuryAccount, TreasuryMovement,
)

User = get_user_model()


# ── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def user(db):
    u = User.objects.create_user(username='api_stmt_user', password='x')
    u.is_active = True
    u.is_superuser = True
    u.save()
    return u


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def bank(db):
    return Bank.objects.create(name='Banco API', code='BAPI')


@pytest.fixture
def checking_account(db, bank):
    asset = Account.objects.create(
        name='Cta Cte API', code='1.1.01.200',
        account_type=AccountType.ASSET,
    )
    return TreasuryAccount.objects.create(
        name='Cta Cte Banco API',
        account=asset,
        bank=bank,
        account_number='999',
        account_type=TreasuryAccount.Type.CHECKING,
    )


@pytest.fixture
def card_account(db, bank):
    liability = Account.objects.create(
        name='Tarjeta API', code='2.1.09.300',
        account_type=AccountType.LIABILITY,
    )
    return TreasuryAccount.objects.create(
        name='Visa API',
        account=liability,
        bank=bank,
        account_type=TreasuryAccount.Type.CREDIT_CARD,
    )


def _make_payload(card_account, **overrides):
    base = {
        'card_account': card_account.id,
        'period_year': 2026,
        'period_month': 6,
        'cut_off_date': date(2026, 6, 30).isoformat(),
        'due_date': date(2026, 7, 25).isoformat(),
        'billed_amount': '250000.00',
        'minimum_payment': '25000.00',
        'notes': 'Estado de prueba',
    }
    base.update(overrides)
    return base


# ── CRUD Tests ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_create_statement_happy_path(auth_client, card_account):
    resp = auth_client.post(
        '/api/treasury/card-statements/',
        _make_payload(card_account),
        format='json',
    )
    assert resp.status_code == 201, resp.json()
    data = resp.json()
    assert data['display_id'].startswith('EST-')
    assert data['status'] == 'OPEN'
    assert Decimal(data['billed_amount']) == Decimal('250000')
    assert data['card_account'] == card_account.id


@pytest.mark.django_db
def test_create_statement_requires_auth(client, card_account):
    resp = client.post(
        '/api/treasury/card-statements/',
        _make_payload(card_account),
        format='json',
    )
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_create_statement_rejects_wrong_account_type(auth_client, bank):
    asset = Account.objects.create(
        name='Caja', code='1.1.01.900',
        account_type=AccountType.ASSET,
    )
    bad_account = TreasuryAccount.objects.create(
        name='Caja Mala', account=asset,
        account_type=TreasuryAccount.Type.CASH,
    )
    resp = auth_client.post(
        '/api/treasury/card-statements/',
        _make_payload(bad_account),
        format='json',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_create_statement_rejects_due_before_cutoff(auth_client, card_account):
    resp = auth_client.post(
        '/api/treasury/card-statements/',
        _make_payload(
            card_account,
            cut_off_date=date(2026, 7, 25).isoformat(),
            due_date=date(2026, 6, 30).isoformat(),
        ),
        format='json',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_list_statements(auth_client, card_account):
    auth_client.post(
        '/api/treasury/card-statements/',
        _make_payload(card_account, period_month=5),
        format='json',
    )
    auth_client.post(
        '/api/treasury/card-statements/',
        _make_payload(card_account, period_month=6),
        format='json',
    )
    resp = auth_client.get('/api/treasury/card-statements/')
    assert resp.status_code == 200
    data = resp.json()
    if isinstance(data, dict) and 'results' in data:
        data = data['results']
    assert len(data) == 2


@pytest.mark.django_db
def test_retrieve_statement(auth_client, card_account):
    create = auth_client.post(
        '/api/treasury/card-statements/',
        _make_payload(card_account),
        format='json',
    )
    stmt_id = create.json()['id']
    resp = auth_client.get(f'/api/treasury/card-statements/{stmt_id}/')
    assert resp.status_code == 200
    data = resp.json()
    assert data['id'] == stmt_id
    assert data['total_to_pay'] == '250000.00'


@pytest.mark.django_db
def test_update_statement_notes(auth_client, card_account):
    create = auth_client.post(
        '/api/treasury/card-statements/',
        _make_payload(card_account),
        format='json',
    )
    stmt_id = create.json()['id']
    resp = auth_client.patch(
        f'/api/treasury/card-statements/{stmt_id}/',
        {'notes': 'Notas actualizadas'},
        format='json',
    )
    assert resp.status_code == 200
    assert resp.json()['notes'] == 'Notas actualizadas'


# ── pay action ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_pay_statement_action(auth_client, card_account, checking_account):
    create = auth_client.post(
        '/api/treasury/card-statements/',
        _make_payload(card_account, billed_amount='100000.00'),
        format='json',
    )
    stmt_id = create.json()['id']

    resp = auth_client.post(
        f'/api/treasury/card-statements/{stmt_id}/pay/',
        {'payment_account': checking_account.id},
        format='json',
    )
    assert resp.status_code == 200, resp.json()
    data = resp.json()
    assert data['status'] == 'PAID'
    assert data['payment_account'] == checking_account.id
    assert data['paid_at'] is not None


@pytest.mark.django_db
def test_pay_statement_requires_valid_account(auth_client, card_account):
    create = auth_client.post(
        '/api/treasury/card-statements/',
        _make_payload(card_account, billed_amount='100000.00'),
        format='json',
    )
    stmt_id = create.json()['id']

    resp = auth_client.post(
        f'/api/treasury/card-statements/{stmt_id}/pay/',
        {'payment_account': 99999},
        format='json',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_pay_already_paid_is_idempotent(auth_client, card_account, checking_account):
    create = auth_client.post(
        '/api/treasury/card-statements/',
        _make_payload(card_account, billed_amount='50000.00'),
        format='json',
    )
    stmt_id = create.json()['id']

    r1 = auth_client.post(
        f'/api/treasury/card-statements/{stmt_id}/pay/',
        {'payment_account': checking_account.id},
        format='json',
    )
    assert r1.status_code == 200

    r2 = auth_client.post(
        f'/api/treasury/card-statements/{stmt_id}/pay/',
        {'payment_account': checking_account.id},
        format='json',
    )
    assert r2.status_code == 200  # idempotent
    assert r2.json()['status'] == 'PAID'


@pytest.mark.django_db
def test_pay_canceled_statement_fails(auth_client, card_account, checking_account):
    create = auth_client.post(
        '/api/treasury/card-statements/',
        _make_payload(card_account),
        format='json',
    )
    stmt_id = create.json()['id']

    auth_client.post(
        f'/api/treasury/card-statements/{stmt_id}/cancel/',
        {'notes': 'Error'},
        format='json',
    )

    resp = auth_client.post(
        f'/api/treasury/card-statements/{stmt_id}/pay/',
        {'payment_account': checking_account.id},
        format='json',
    )
    assert resp.status_code == 400


# ── apply_charges action ────────────────────────────────────────────────────


@pytest.mark.django_db
def test_apply_charges_action(auth_client, card_account):
    create = auth_client.post(
        '/api/treasury/card-statements/',
        _make_payload(card_account, interest_charged='5000.00', fees_charged='1000.00'),
        format='json',
    )
    stmt_id = create.json()['id']

    interest_exp = Account.objects.create(
        name='Interés', code='5.2.01.100',
        account_type=AccountType.EXPENSE,
    )
    fees_exp = Account.objects.create(
        name='Comisiones', code='5.2.01.101',
        account_type=AccountType.EXPENSE,
    )

    resp = auth_client.post(
        f'/api/treasury/card-statements/{stmt_id}/apply-charges/',
        {
            'interest_expense_account': interest_exp.id,
            'fees_expense_account': fees_exp.id,
        },
        format='json',
    )
    assert resp.status_code == 200, resp.json()
    data = resp.json()
    assert '[CHARGES]' in data['notes']


@pytest.mark.django_db
def test_apply_charges_on_paid_statement_fails(auth_client, card_account, checking_account):
    create = auth_client.post(
        '/api/treasury/card-statements/',
        _make_payload(card_account),
        format='json',
    )
    stmt_id = create.json()['id']

    auth_client.post(
        f'/api/treasury/card-statements/{stmt_id}/pay/',
        {'payment_account': checking_account.id},
        format='json',
    )

    resp = auth_client.post(
        f'/api/treasury/card-statements/{stmt_id}/apply-charges/',
        {},
        format='json',
    )
    assert resp.status_code == 400


# ── cancel action ───────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_cancel_statement_action(auth_client, card_account):
    create = auth_client.post(
        '/api/treasury/card-statements/',
        _make_payload(card_account),
        format='json',
    )
    stmt_id = create.json()['id']

    resp = auth_client.post(
        f'/api/treasury/card-statements/{stmt_id}/cancel/',
        {'notes': 'Error de carga'},
        format='json',
    )
    assert resp.status_code == 200
    assert resp.json()['status'] == 'CANCELED'
    assert 'Error de carga' in resp.json()['notes']


@pytest.mark.django_db
def test_cancel_paid_statement_fails(auth_client, card_account, checking_account):
    create = auth_client.post(
        '/api/treasury/card-statements/',
        _make_payload(card_account),
        format='json',
    )
    stmt_id = create.json()['id']

    auth_client.post(
        f'/api/treasury/card-statements/{stmt_id}/pay/',
        {'payment_account': checking_account.id},
        format='json',
    )

    resp = auth_client.post(
        f'/api/treasury/card-statements/{stmt_id}/cancel/',
        {},
        format='json',
    )
    assert resp.status_code == 400
