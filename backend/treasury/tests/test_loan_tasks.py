"""
Tests de las Celery tasks del módulo de créditos (F2.9 + F2.10).
"""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from accounting.models import Account, AccountType
from treasury.models import (
    Bank,
    BankLoan,
    LoanInstallment,
    TreasuryAccount,
)
from treasury.tasks import (
    accrue_monthly_loan_interest,
    mark_overdue_loan_installments,
)

User = get_user_model()


@pytest.fixture
def base(db):
    user = User.objects.create_user(
        username="admin_loans",
        password="x",
    )
    user.is_superuser = True
    user.is_active = True
    user.save()
    bank = Bank.objects.create(name="Banco Préstamos", code="BPR")

    bank_acc = Account.objects.create(
        name="BCI Cte Préstamos",
        code="1.1.01.090",
        account_type=AccountType.ASSET,
    )
    bank_ta = TreasuryAccount.objects.create(
        name="BCI Cte Préstamos",
        account=bank_acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank,
        account_number="900",
    )
    liab_acc = Account.objects.create(
        name="Préstamo BCI por Pagar",
        code="2.1.01.050",
        account_type=AccountType.LIABILITY,
    )
    liab_ta = TreasuryAccount.objects.create(
        name="Préstamo BCI por Pagar",
        account=liab_acc,
        account_type=TreasuryAccount.Type.LOAN,
        bank=bank,
    )
    return {
        "user": user,
        "bank": bank,
        "bank_ta": bank_ta,
        "liab_ta": liab_ta,
    }


def _make_active_loan(base, **overrides):
    today = timezone.now().date()
    defaults = {
        "lender": base["bank"],
        "loan_number": "OP-001",
        "currency": BankLoan.Currency.CLP,
        "principal": Decimal("1000000"),
        "interest_rate": Decimal("1.00"),
        "rate_basis": BankLoan.RateBasis.MONTHLY,
        "amortization_system": BankLoan.AmortizationSystem.FRENCH,
        "term_months": 3,
        "start_date": today - timedelta(days=60),
        "first_due_date": today - timedelta(days=30),
        "insurance_monthly": Decimal("0"),
        "disbursement_account": base["bank_ta"],
        "liability_account": base["liab_ta"],
        "status": BankLoan.Status.ACTIVE,
        "created_by": base["user"],
    }
    defaults.update(overrides)
    return BankLoan.objects.create(**defaults)


# ── F2.10 mark_overdue_loan_installments ────────────────────────────────


@pytest.mark.django_db
def test_overdue_task_marks_pending_as_overdue(base):
    from treasury.loan_service import LoanService

    today = timezone.now().date()

    loan = _make_active_loan(base)
    LoanService.generate_schedule(loan)
    # Forzar: una cuota en el pasado y otra en el futuro.
    installments = list(loan.installments.order_by("number"))
    installments[0].due_date = today - timedelta(days=5)
    installments[0].status = LoanInstallment.Status.PENDING
    installments[0].save()
    installments[1].due_date = today + timedelta(days=3)
    installments[1].status = LoanInstallment.Status.PENDING
    installments[1].save()
    installments[2].due_date = today + timedelta(days=33)
    installments[2].status = LoanInstallment.Status.PENDING
    installments[2].save()

    result = mark_overdue_loan_installments(days_ahead=5, notify=False)
    assert result["overdue_marked"] == 1
    installments[0].refresh_from_db()
    installments[1].refresh_from_db()
    installments[2].refresh_from_db()
    assert installments[0].status == LoanInstallment.Status.OVERDUE
    assert installments[1].status == LoanInstallment.Status.PENDING
    assert installments[2].status == LoanInstallment.Status.PENDING


@pytest.mark.django_db
def test_overdue_task_creates_notifications(base):
    from treasury.loan_service import LoanService
    from workflow.models import Notification

    today = timezone.now().date()
    loan = _make_active_loan(base)
    LoanService.generate_schedule(loan)
    # Mover las 3 cuotas: 1 al pasado, 1 al futuro cercano, 1 al futuro lejano.
    installments = list(loan.installments.order_by("number"))
    installments[0].due_date = today - timedelta(days=10)
    installments[0].status = LoanInstallment.Status.PENDING
    installments[0].save()
    installments[1].due_date = today + timedelta(days=3)
    installments[1].status = LoanInstallment.Status.PENDING
    installments[1].save()
    installments[2].due_date = today + timedelta(days=40)
    installments[2].status = LoanInstallment.Status.PENDING
    installments[2].save()

    result = mark_overdue_loan_installments(days_ahead=5, notify=True)
    # 1 overdue marcada + 1 upcoming dentro de 5 días
    assert result["overdue_marked"] == 1
    assert result["upcoming_count"] == 1
    assert result["upcoming_notified"] == 1

    # El usuario admin debe tener la notificación
    assert (
        Notification.objects.filter(
            user=base["user"],
            notification_type="LOAN_INSTALLMENT_UPCOMING",
        ).count()
        == 1
    )

    # Segunda corrida no duplica (deduplicación por día)
    result2 = mark_overdue_loan_installments(days_ahead=5, notify=True)
    assert result2["upcoming_notified"] == 0


# ── F2.9 accrue_monthly_loan_interest ───────────────────────────────────


@pytest.mark.django_db
def test_accrual_task_is_noop_without_accounts(base):
    """Sin cuentas configuradas en AccountingSettings (F5.1) → no hace nada."""
    from treasury.loan_service import LoanService

    loan = _make_active_loan(base)
    LoanService.generate_schedule(loan)

    result = accrue_monthly_loan_interest()
    assert result["accrued"] == 0
    assert "no interest accounts" in result["reason"] or result.get("reason") is None


@pytest.mark.django_db
def test_accrual_task_returns_zero_when_accounts_missing(base):
    """
    Sin `loan_interest_expense_account` / `loan_interest_payable_account`
    en AccountingSettings (los añade F5.1), la task debe ser un no-op
    seguro: retorna 0 sin crear asientos. Esto es el modo 'opt-in' que
    el playbook pide para PYME.
    """
    from treasury.loan_service import LoanService

    loan = _make_active_loan(base)
    LoanService.generate_schedule(loan)

    result = accrue_monthly_loan_interest()
    assert result["accrued"] == 0
    assert "no interest accounts" in result.get("reason", "")
