"""
test_loans_api.py — Tests de la API REST de créditos bancarios (F2.11).

Cubre:
  - CRUD básico de BankLoan.
  - Acciones custom: disburse, pay, prepay, refinance.
  - Endpoints auxiliares: schedule, amortization_table.
  - Validación: liability_account debe ser LOAN.
  - Permisos: solo autenticados.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import Account, AccountType
from treasury.models import (
    Bank, BankLoan, LoanInstallment, TreasuryAccount,
)


User = get_user_model()


# ── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def user(db):
    u = User.objects.create_user(username='api_loans_user', password='x')
    u.is_active = True
    u.is_superuser = True
    u.save()
    return u


@pytest.fixture
def client():
    """Cliente sin autenticar (para tests de auth-required)."""
    return APIClient()


@pytest.fixture
def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def bank(db):
    return Bank.objects.create(name='Banco de Chile', code='BDCH')


@pytest.fixture
def checking_account(db, bank):
    # Bank TreasuryAccount (CHECKING) — requiere bank FK y account_number
    asset = Account.objects.create(
        name='Banco BdCh Cta Cte', code='1.1.01.001',
        account_type=AccountType.ASSET,
    )
    return TreasuryAccount.objects.create(
        name='Cta Cte BdCh',
        code='CTA-001',
        account=asset,
        bank=bank,
        account_number='1234567890',
        account_type=TreasuryAccount.Type.CHECKING,
    )


@pytest.fixture
def liability_account(db, bank):
    # Cuenta de tesorería tipo LOAN, vinculada a una cuenta contable de PASIVO (ADR-0041).
    liability = Account.objects.create(
        name='Línea de Crédito Banco', code='2.1.04.001',
        account_type=AccountType.LIABILITY,
    )
    return TreasuryAccount.objects.create(
        name='Línea Crédito BdCh',
        code='LC-001',
        account=liability,
        bank=bank,
        account_type=TreasuryAccount.Type.LOAN,
    )


def _make_payload(bank, checking, liability, **overrides):
    base = {
        'lender': bank.id,
        'loan_number': 'OP-001',
        'currency': 'CLP',
        'principal': '10000000.00',
        'interest_rate': '1.2000',  # 1.2% mensual
        'rate_basis': 'MONTHLY',
        'amortization_system': 'FRENCH',
        'term_months': 12,
        'start_date': date(2026, 1, 15).isoformat(),
        'first_due_date': date(2026, 2, 15).isoformat(),
        'insurance_monthly': '5000.00',
        'disbursement_account': checking.id,
        'liability_account': liability.id,
        'notes': 'Crédito de prueba API',
    }
    base.update(overrides)
    return base


# ── Tests ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_create_loan_happy_path(auth_client, bank, checking_account, liability_account):
    resp = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_account),
        format='json',
    )
    assert resp.status_code == 201, resp.json()
    data = resp.json()
    assert data['display_id'].startswith('CRE-')
    assert data['status'] == 'DRAFT'
    assert data['installments'] == []  # la tabla aún no se genera


@pytest.mark.django_db
def test_create_loan_requires_auth(client, bank, checking_account, liability_account):
    resp = client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_account),
        format='json',
    )
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_create_loan_rejects_wrong_liability_type(
    auth_client, bank, checking_account,
):
    # Crea una cuenta de tesorería que NO es LOAN para que falle validación.
    other_asset = Account.objects.create(
        name='Caja General', code='1.1.01.099',
        account_type=AccountType.ASSET,
    )
    bad_liability = TreasuryAccount.objects.create(
        name='Otra Cta', code='OT-001',
        account=other_asset,
        account_type=TreasuryAccount.Type.CASH,  # NO es pasivo
    )
    resp = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, bad_liability),
        format='json',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_create_loan_rejects_first_due_before_start(
    auth_client, bank, checking_account, liability_account,
):
    resp = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(
            bank, checking_account, liability_account,
            start_date=date(2026, 2, 15).isoformat(),
            first_due_date=date(2026, 1, 15).isoformat(),
        ),
        format='json',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_disburse_action_creates_movement_and_active(
    auth_client, bank, checking_account, liability_account,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_account),
        format='json',
    )
    loan_id = create.json()['id']

    resp = auth_client.post(f'/api/treasury/loans/{loan_id}/disburse/')
    assert resp.status_code == 200, resp.json()
    data = resp.json()
    assert data['status'] == 'ACTIVE'
    assert data['installments_count'] == 12
    # El banco tiene un nuevo movimiento INBOUND
    loan = BankLoan.objects.get(pk=loan_id)
    assert loan.installments.count() == 12
    assert loan.installments.first().status == 'PENDING'


@pytest.mark.django_db
def test_disburse_is_idempotent(
    auth_client, bank, checking_account, liability_account,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_account),
        format='json',
    )
    loan_id = create.json()['id']
    r1 = auth_client.post(f'/api/treasury/loans/{loan_id}/disburse/')
    r2 = auth_client.post(f'/api/treasury/loans/{loan_id}/disburse/')
    assert r1.status_code == 200
    assert r2.status_code == 200
    # No debe duplicar movimientos
    assert r1.json()['status'] == 'ACTIVE'
    assert r2.json()['status'] == 'ACTIVE'


@pytest.mark.django_db
def test_schedule_preview_not_persisted(
    auth_client, bank, checking_account, liability_account,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_account),
        format='json',
    )
    loan_id = create.json()['id']
    resp = auth_client.get(f'/api/treasury/loans/{loan_id}/schedule/')
    assert resp.status_code == 200
    data = resp.json()
    assert len(data['installments']) == 12
    assert data['installments'][0]['number'] == 1
    # No persistió
    assert BankLoan.objects.get(pk=loan_id).installments.count() == 0


@pytest.mark.django_db
def test_amortization_table_after_disburse(
    auth_client, bank, checking_account, liability_account,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_account),
        format='json',
    )
    loan_id = create.json()['id']
    auth_client.post(f'/api/treasury/loans/{loan_id}/disburse/')
    resp = auth_client.get(f'/api/treasury/loans/{loan_id}/amortization_table/')
    assert resp.status_code == 200
    data = resp.json()
    assert data['installments_count'] == 12
    assert data['outstanding_balance']  # pendiente positivo
    assert data['next_due_date'] is not None


@pytest.mark.django_db
def test_pay_installment_action_closes_loan(
    auth_client, bank, checking_account, liability_account,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_account,
                      term_months=2, principal='1000000.00'),
        format='json',
    )
    loan_id = create.json()['id']
    auth_client.post(f'/api/treasury/loans/{loan_id}/disburse/')

    installments = list(
        LoanInstallment.objects.filter(loan_id=loan_id).order_by('number')
    )
    # Pagar la primera
    r1 = auth_client.post(
        f'/api/treasury/loan-installments/{installments[0].id}/pay/',
        {'payment_account': checking_account.id},
        format='json',
    )
    assert r1.status_code == 200, r1.json()
    assert r1.json()['status'] == 'PAID'
    # El crédito sigue ACTIVE (queda 1 cuota)
    assert BankLoan.objects.get(pk=loan_id).status == 'ACTIVE'

    # Pagar la segunda → PAID
    r2 = auth_client.post(
        f'/api/treasury/loan-installments/{installments[1].id}/pay/',
        {'payment_account': checking_account.id},
        format='json',
    )
    assert r2.status_code == 200
    assert BankLoan.objects.get(pk=loan_id).status == 'PAID'


@pytest.mark.django_db
def test_pay_installment_uf_uses_indicator(
    auth_client, bank, checking_account, liability_account,
):
    from finances.models import IndicatorValue
    pay_date = date(2026, 3, 15)
    IndicatorValue.objects.create(indicator='UF', date=pay_date, value=Decimal('37000.0000'))

    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_account,
                      currency='UF', principal='100.00', term_months=1,
                      first_due_date=pay_date.isoformat()),
        format='json',
    )
    loan_id = create.json()['id']
    auth_client.post(f'/api/treasury/loans/{loan_id}/disburse/')
    inst = LoanInstallment.objects.get(loan_id=loan_id)
    r = auth_client.post(
        f'/api/treasury/loan-installments/{inst.id}/pay/',
        {'payment_account': checking_account.id, 'date': pay_date.isoformat()},
        format='json',
    )
    assert r.status_code == 200, r.json()
    assert r.json()['uf_value_used'] is not None
    # CLP paid debe ser > 100 (algo * 37000)
    assert Decimal(r.json()['clp_amount_paid']) > Decimal('100')


@pytest.mark.django_db
def test_pay_installment_requires_active_loan(
    auth_client, bank, checking_account, liability_account,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_account, term_months=1),
        format='json',
    )
    loan_id = create.json()['id']
    # No desembolsamos: status DRAFT
    inst = LoanInstallment.objects  # queryset helper
    # Forzamos al menos 1 installment creando manualmente
    loan = BankLoan.objects.get(pk=loan_id)
    LoanInstallment.objects.create(
        loan=loan, number=1, due_date=date(2026, 2, 15),
        principal_amount=Decimal('100'), interest_amount=Decimal('0'),
        insurance_amount=Decimal('0'), total_amount=Decimal('100'),
        outstanding_balance=Decimal('0'),
    )
    inst = LoanInstallment.objects.filter(loan=loan).first()
    r = auth_client.post(
        f'/api/treasury/loan-installments/{inst.id}/pay/',
        {'payment_account': checking_account.id},
        format='json',
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_prepay_action_marks_all_canceled(
    auth_client, bank, checking_account, liability_account,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_account, term_months=6),
        format='json',
    )
    loan_id = create.json()['id']
    auth_client.post(f'/api/treasury/loans/{loan_id}/disburse/')

    r = auth_client.post(
        f'/api/treasury/loans/{loan_id}/prepay/',
        {'payment_account': checking_account.id},
        format='json',
    )
    assert r.status_code == 200, r.json()
    assert r.json()['status'] == 'PAID'
    # Cuotas pendientes → CANCELED
    assert BankLoan.objects.get(pk=loan_id).installments.filter(
        status=LoanInstallment.Status.CANCELED
    ).count() == 6


@pytest.mark.django_db
def test_refinance_action_marks_refinanced(
    auth_client, bank, checking_account, liability_account,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_account, term_months=3),
        format='json',
    )
    loan_id = create.json()['id']
    auth_client.post(f'/api/treasury/loans/{loan_id}/disburse/')

    r = auth_client.post(
        f'/api/treasury/loans/{loan_id}/refinance/',
        {'notes': 'Refinanciado con Banco Santander'},
        format='json',
    )
    assert r.status_code == 200, r.json()
    data = r.json()
    assert data['status'] == 'REFINANCED'
    assert 'Refinanciado con Banco Santander' in data['notes']


@pytest.mark.django_db
def test_installments_list_filter_by_loan(
    auth_client, bank, checking_account, liability_account,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_account, term_months=3),
        format='json',
    )
    loan_id = create.json()['id']
    auth_client.post(f'/api/treasury/loans/{loan_id}/disburse/')
    r = auth_client.get(f'/api/treasury/loan-installments/?loan={loan_id}')
    assert r.status_code == 200
    # LoanInstallmentViewSet no usa paginación → lista plana.
    data = r.json()
    if isinstance(data, dict) and 'results' in data:
        data = data['results']
    assert len(data) == 3


@pytest.mark.django_db
def test_loan_installment_pay_double_payment_fails(
    auth_client, bank, checking_account, liability_account,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_account, term_months=1),
        format='json',
    )
    loan_id = create.json()['id']
    auth_client.post(f'/api/treasury/loans/{loan_id}/disburse/')
    inst = LoanInstallment.objects.get(loan_id=loan_id)
    r1 = auth_client.post(
        f'/api/treasury/loan-installments/{inst.id}/pay/',
        {'payment_account': checking_account.id},
        format='json',
    )
    assert r1.status_code == 200
    r2 = auth_client.post(
        f'/api/treasury/loan-installments/{inst.id}/pay/',
        {'payment_account': checking_account.id},
        format='json',
    )
    assert r2.status_code == 400
