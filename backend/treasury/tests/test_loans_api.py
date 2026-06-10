"""
test_loans_api.py — Tests de la API REST de créditos bancarios (F2.11).

Cubre:
  - CRUD básico de BankLoan.
  - Acciones custom: disburse, pay, prepay.
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
def liability_accounting(db, bank):
    """
    Cuenta contable de PASIVO (LIABILITY) hoja — es lo que el cliente envía
    en el payload de creación. El backend auto-crea la TreasuryAccount LOAN
    correspondiente (ADR-0041 + auto-provisión).
    """
    return Account.objects.create(
        name='Línea de Crédito Banco', code='2.1.04.001',
        account_type=AccountType.LIABILITY,
    )


@pytest.fixture
def liability_account(db, bank, liability_accounting):
    """
    Wrapper TreasuryAccount tipo LOAN pre-creado (útil para tests directos
    del servicio). Para tests de la API, usar `liability_accounting.id` en
    el payload — el backend resuelve/crea la wrapper.
    """
    return TreasuryAccount.objects.create(
        name='Línea Crédito BdCh',
        code='LC-001',
        account=liability_accounting,
        bank=bank,
        account_type=TreasuryAccount.Type.LOAN,
    )


def _make_payload(bank, checking, liability_accounting, **overrides):
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
        'liability_account': liability_accounting.id,
        'notes': 'Crédito de prueba API',
    }
    base.update(overrides)
    return base


# ── Tests ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_create_loan_happy_path(auth_client, bank, checking_account, liability_accounting):
    resp = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting),
        format='json',
    )
    assert resp.status_code == 201, resp.json()
    data = resp.json()
    assert data['display_id'].startswith('CRE-')
    assert data['status'] == 'DRAFT'
    assert data['installments'] == []  # la tabla aún no se genera


@pytest.mark.django_db
def test_create_loan_requires_auth(client, bank, checking_account, liability_accounting):
    resp = client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting),
        format='json',
    )
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_create_loan_rejects_wrong_liability_type(
    auth_client, bank, checking_account,
):
    # Cuenta contable que NO es LIABILITY → debe ser rechazada por el
    # `validate_liability_account` del write serializer.
    other_asset = Account.objects.create(
        name='Caja General', code='1.1.01.099',
        account_type=AccountType.ASSET,
    )
    resp = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, other_asset),
        format='json',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_create_loan_rejects_first_due_before_start(
    auth_client, bank, checking_account, liability_accounting,
):
    resp = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(
            bank, checking_account, liability_accounting,
            start_date=date(2026, 2, 15).isoformat(),
            first_due_date=date(2026, 1, 15).isoformat(),
        ),
        format='json',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_disburse_action_creates_movement_and_active(
    auth_client, bank, checking_account, liability_accounting,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting),
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
    auth_client, bank, checking_account, liability_accounting,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting),
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
    auth_client, bank, checking_account, liability_accounting,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting),
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
    auth_client, bank, checking_account, liability_accounting,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting),
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
    auth_client, bank, checking_account, liability_accounting,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting,
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
    auth_client, bank, checking_account, liability_accounting,
):
    from finances.models import IndicatorValue
    pay_date = date(2026, 3, 15)
    IndicatorValue.objects.create(indicator='UF', date=pay_date, value=Decimal('37000.0000'))

    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting,
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
    auth_client, bank, checking_account, liability_accounting,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting, term_months=1),
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
    auth_client, bank, checking_account, liability_accounting,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting, term_months=6),
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
def test_installments_list_filter_by_loan(
    auth_client, bank, checking_account, liability_accounting,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting, term_months=3),
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
    auth_client, bank, checking_account, liability_accounting,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting, term_months=1),
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


# ── Auto-provisión de TreasuryAccount LOAN (ADR-0041 + auto-create) ─────────


@pytest.mark.django_db
def test_create_loan_auto_creates_loan_treasury_account(
    auth_client, bank, checking_account, liability_accounting,
):
    """
    Al crear un BankLoan con `liability_account = <Account.id>` (no wrapper),
    el backend debe crear (o reutilizar) la TreasuryAccount tipo LOAN para el
    par (banco, cuenta contable) y setearla como `liability_account` del loan.
    """
    from treasury.models import TreasuryAccount

    assert not TreasuryAccount.objects.filter(
        bank=bank, account=liability_accounting,
        account_type=TreasuryAccount.Type.LOAN,
    ).exists(), "precondición: no existe aún la wrapper"

    resp = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting),
        format='json',
    )
    assert resp.status_code == 201, resp.json()
    data = resp.json()
    assert data['liability_account'] == liability_accounting.id + 0  # sanity
    # La wrapper quedó creada
    wrapper = TreasuryAccount.objects.get(
        bank=bank, account=liability_accounting,
        account_type=TreasuryAccount.Type.LOAN,
    )
    # Y apunta a la cuenta contable correcta
    assert wrapper.account_id == liability_accounting.id
    assert wrapper.bank_id == bank.id


@pytest.mark.django_db
def test_create_loan_reuses_existing_loan_treasury_account(
    auth_client, bank, checking_account, liability_accounting,
):
    """
    Si ya existe una TreasuryAccount LOAN para (banco, cuenta contable),
    el backend la reutiliza (idempotencia) en vez de duplicarla.
    """
    from treasury.models import TreasuryAccount

    pre = TreasuryAccount.objects.create(
        name='Wrapper pre-existente',
        account=liability_accounting,
        bank=bank,
        account_type=TreasuryAccount.Type.LOAN,
    )

    resp = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting),
        format='json',
    )
    assert resp.status_code == 201, resp.json()
    # Sigue habiendo exactamente una wrapper LOAN para ese par
    qs = TreasuryAccount.objects.filter(
        bank=bank, account=liability_accounting,
        account_type=TreasuryAccount.Type.LOAN,
    )
    assert qs.count() == 1
    assert qs.first().id == pre.id


@pytest.mark.django_db
def test_create_loan_rejects_liability_account_already_used_by_other_type(
    auth_client, bank, checking_account, liability_accounting,
):
    """
    Si la cuenta contable ya está ocupada por una TreasuryAccount de tipo
    distinto a LOAN, el backend rechaza la creación.
    """
    from treasury.models import TreasuryAccount

    TreasuryAccount.objects.create(
        name='Cta usada como CREDIT_CARD',
        account=liability_accounting,
        bank=bank,
        account_type=TreasuryAccount.Type.CREDIT_CARD,
    )
    resp = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting),
        format='json',
    )
    assert resp.status_code == 400


# ── Override de cargos al desembolsar (one-shot) ────────────────────────────


@pytest.mark.django_db
def test_disburse_with_opening_fee_override(
    auth_client, bank, checking_account, liability_accounting,
):
    """
    El contrato declara `opening_fee=0` pero al desembolsar el operador
    ajusta a 50000 → el asiento del desembolso debe usar 50000 como
    comisión, y el `BankLoan.opening_fee` debe permanecer en 0 (no se
    pisa con el override).
    """
    from decimal import Decimal
    from accounting.models import AccountingSettings

    settings_obj = AccountingSettings.get_solo()
    commission_acc = Account.objects.create(
        name='Gasto Comisión Préstamo', code='5.2.01.030',
        account_type=AccountType.EXPENSE,
    )
    settings_obj.loan_commission_expense_account = commission_acc
    settings_obj.save()

    # Crear crédito con opening_fee=0
    payload = _make_payload(
        bank, checking_account, liability_accounting,
        opening_fee='0',
    )
    create = auth_client.post('/api/treasury/loans/', payload, format='json')
    assert create.status_code == 201
    loan_id = create.json()['id']

    # Desembolsar con override
    resp = auth_client.post(
        f'/api/treasury/loans/{loan_id}/disburse/',
        {'opening_fee': '50000.00'},
        format='json',
    )
    assert resp.status_code == 200, resp.json()

    # El contrato NO se mutó
    loan = BankLoan.objects.get(pk=loan_id)
    assert Decimal(loan.opening_fee) == Decimal('0')
    # El movimiento tiene la nota de ajuste
    movement = loan.disbursement_account.bank  # sanity
    # Buscar el movimiento INBOUND creado al desembolsar
    from treasury.models import TreasuryMovement
    mv = TreasuryMovement.objects.filter(
        to_account=loan.disbursement_account,
        reference=loan.display_id,
    ).latest('id')
    assert 'Comisión apertura ajustada' in (mv.notes or '')


@pytest.mark.django_db
def test_disburse_rejects_negative_override(
    auth_client, bank, checking_account, liability_accounting,
):
    create = auth_client.post(
        '/api/treasury/loans/',
        _make_payload(bank, checking_account, liability_accounting),
        format='json',
    )
    loan_id = create.json()['id']
    resp = auth_client.post(
        f'/api/treasury/loans/{loan_id}/disburse/',
        {'opening_fee': '-100.00'},
        format='json',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_disburse_with_commission_expense_account_override(
    auth_client, bank, checking_account, liability_accounting,
):
    """
    Los settings de tesorería NO están configurados. El operador envía
    `commission_expense_account` en el payload del desembolso: el backend
    debe usar esa cuenta (no fallar con 400). Confirma el patrón híbrido
    del plan (escape per-desembolso).
    """
    from treasury.models import TreasuryMovement
    from accounting.models import AccountingSettings

    # Asegurarse de que los settings están vacíos
    AccountingSettings.get_solo().save()  # no-op; get_solo() ya crea

    # Cuenta de gasto custom que mandaremos como override
    commission_acc = Account.objects.create(
        name='Comisión Apertura (override)', code='5.2.01.030',
        account_type=AccountType.EXPENSE,
    )

    # Crear crédito con opening_fee > 0
    payload = _make_payload(
        bank, checking_account, liability_accounting,
        opening_fee='25000.00',
    )
    create = auth_client.post('/api/treasury/loans/', payload, format='json')
    assert create.status_code == 201
    loan_id = create.json()['id']

    # Desembolsar con override de cuenta de gasto
    resp = auth_client.post(
        f'/api/treasury/loans/{loan_id}/disburse/',
        {
            'opening_fee': '25000.00',
            'commission_expense_account': commission_acc.id,
        },
        format='json',
    )
    assert resp.status_code == 200, resp.json()

    # El movimiento INBOUND existe
    loan = BankLoan.objects.get(pk=loan_id)
    mv = TreasuryMovement.objects.filter(
        to_account=loan.disbursement_account,
        reference=loan.display_id,
    ).latest('id')
    assert mv.journal_entry is not None, "El desembolso debe tener asiento contable"

    # El asiento debe usar la cuenta override (no la del setting)
    used_acc_ids = set(mv.journal_entry.items.values_list('account_id', flat=True))
    assert commission_acc.id in used_acc_ids


@pytest.mark.django_db
def test_disburse_with_stamp_tax_expense_account_override(
    auth_client, bank, checking_account, liability_accounting,
):
    """
    Settings vacíos + override de `stamp_tax_expense_account` en payload:
    el backend debe usar la cuenta custom y no fallar.
    """
    from treasury.models import TreasuryMovement

    stamp_acc = Account.objects.create(
        name='ITE (override)', code='5.2.01.040',
        account_type=AccountType.EXPENSE,
    )

    payload = _make_payload(
        bank, checking_account, liability_accounting,
        stamp_tax='15000.00',
    )
    create = auth_client.post('/api/treasury/loans/', payload, format='json')
    assert create.status_code == 201
    loan_id = create.json()['id']

    resp = auth_client.post(
        f'/api/treasury/loans/{loan_id}/disburse/',
        {
            'stamp_tax': '15000.00',
            'stamp_tax_expense_account': stamp_acc.id,
        },
        format='json',
    )
    assert resp.status_code == 200, resp.json()

    loan = BankLoan.objects.get(pk=loan_id)
    mv = TreasuryMovement.objects.filter(
        to_account=loan.disbursement_account,
        reference=loan.display_id,
    ).latest('id')
    used_acc_ids = set(mv.journal_entry.items.values_list('account_id', flat=True))
    assert stamp_acc.id in used_acc_ids


@pytest.mark.django_db
def test_disburse_payload_rejects_non_expense_commission_account(
    auth_client, bank, checking_account, liability_accounting,
):
    """
    Validación del serializer: si el `commission_expense_account` enviado
    no es de tipo EXPENSE, devolvemos 400 con mensaje legible (no llega
    al servicio).
    """
    wrong_acc = Account.objects.create(
        name='Cta Incorrecta', code='1.1.01.005',
        account_type=AccountType.ASSET,
    )
    payload = _make_payload(
        bank, checking_account, liability_accounting,
        opening_fee='10000.00',
    )
    create = auth_client.post('/api/treasury/loans/', payload, format='json')
    loan_id = create.json()['id']

    resp = auth_client.post(
        f'/api/treasury/loans/{loan_id}/disburse/',
        {
            'opening_fee': '10000.00',
            'commission_expense_account': wrong_acc.id,
        },
        format='json',
    )
    assert resp.status_code == 400
    assert 'comisión' in str(resp.json()).lower()


# ── Bank overview: total_loan_debt ──────────────────────────────────────────


@pytest.mark.django_db
def test_bank_overview_aggregates_active_loan_debt(
    auth_client, bank, checking_account, liability_accounting,
):
    """
    El endpoint `/api/treasury/banks/{id}/overview/` calcula
    `summary.total_loan_debt` como la suma del `principal_amount` de
    las cuotas no pagadas de los créditos activos del banco.

    Antes este cálculo fallaba con AttributeError porque el código
    accedía a `loan.outstanding_balance` (campo inexistente en el
    modelo). Esta test fija el contrato.
    """
    from accounting.models import AccountingSettings
    AccountingSettings.get_solo().save()  # no-op; asegura fila

    # Configurar cuenta de gasto por comisión para poder desembolsar
    from treasury.models import LoanInstallment
    from decimal import Decimal
    commission_acc = Account.objects.create(
        name='Comisión Préstamos', code='5.2.01.030',
        account_type=AccountType.EXPENSE,
    )
    stamp_acc = Account.objects.create(
        name='ITE Préstamos', code='5.2.01.040',
        account_type=AccountType.EXPENSE,
    )
    settings_obj = AccountingSettings.get_solo()
    settings_obj.loan_commission_expense_account = commission_acc
    settings_obj.loan_stamp_tax_expense_account = stamp_acc
    settings_obj.save()

    # Crear y desembolsar un crédito
    payload = _make_payload(bank, checking_account, liability_accounting)
    create = auth_client.post('/api/treasury/loans/', payload, format='json')
    assert create.status_code == 201
    loan_id = create.json()['id']
    disb = auth_client.post(
        f'/api/treasury/loans/{loan_id}/disburse/',
        {
            'opening_fee': '0',
            'stamp_tax': '0',
            'commission_expense_account': commission_acc.id,
            'stamp_tax_expense_account': stamp_acc.id,
        },
        format='json',
    )
    assert disb.status_code == 200, disb.json()

    # El endpoint no debe romper
    resp = auth_client.get(f'/api/treasury/banks/{bank.id}/overview/')
    assert resp.status_code == 200, resp.json()

    body = resp.json()
    assert body['summary']['active_loan_count'] == 1
    # total_loan_debt = suma de principal_amount de cuotas no pagadas
    # Con FRENCH 12 meses, capital total = 10.000.000, ninguna cuota pagada
    # todavía → total_loan_debt ≈ 10.000.000 (puede haber decimales por
    # redondeo en la última cuota).
    expected = LoanInstallment.objects.filter(
        loan_id=loan_id,
    ).exclude(
        status__in=[LoanInstallment.Status.PAID, LoanInstallment.Status.CANCELED]
    ).aggregate(s=__import__('django.db.models', fromlist=['Sum']).Sum('principal_amount'))['s']
    assert Decimal(str(body['summary']['total_loan_debt'])) == expected


@pytest.mark.django_db
def test_bank_overview_with_no_loans(auth_client, bank):
    """
    Sin créditos, el endpoint debe devolver 200 con `total_loan_debt=0`
    y `active_loan_count=0`. Antes del fix, este path también fallaba
    porque el `sum()` se ejecutaba sobre una queryset vacía con la
    misma expresión rota.
    """
    resp = auth_client.get(f'/api/treasury/banks/{bank.id}/overview/')
    assert resp.status_code == 200, resp.json()
    body = resp.json()
    assert body['summary']['active_loan_count'] == 0
    assert float(body['summary']['total_loan_debt']) == 0.0
