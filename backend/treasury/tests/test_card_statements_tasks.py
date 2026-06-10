"""
Tests: tareas Celery del módulo de tarjeta de crédito propia (F3.7, ADR-0037).

Cubre:
  - mark_overdue_credit_card_statements: marca OPEN con due_date < hoy como OVERDUE.
  - mark_overdue_credit_card_statements: no re-marca statements ya OVERDUE.
  - mark_overdue_credit_card_statements: emite Notification para próximos a vencer.
  - mark_overdue_credit_card_statements: deduplica notificaciones por día.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from accounting.models import Account, AccountType
from treasury.models import Bank, TreasuryAccount, CreditCardStatement
from treasury.tasks import mark_overdue_credit_card_statements


User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username='cc_admin', password='x')
    user.is_superuser = True
    user.is_active = True
    user.save()

    bank = Bank.objects.create(name='Banco Tarjeta', code='BCC')

    card_acc = Account.objects.create(
        name='Visa Empresa', code='2.1.09.020',
        account_type=AccountType.LIABILITY,
    )
    card_ta = TreasuryAccount.objects.create(
        name='Visa Empresa', account=card_acc,
        account_type=TreasuryAccount.Type.CREDIT_CARD, bank=bank,
    )
    return {
        'user': user, 'bank': bank, 'card_ta': card_ta, 'card_acc': card_acc,
    }


def _open(env, *, year, month, due, billed=Decimal('0')):
    """Crea un statement en estado OPEN. Helper local."""
    return CreditCardStatement.objects.create(
        card_account=env['card_ta'],
        period_year=year, period_month=month,
        cut_off_date=due - timedelta(days=20),
        due_date=due,
        billed_amount=billed,
        created_by=env['user'],
    )


# ── mark_overdue_credit_card_statements ───────────────────────────────────


def _next_month(today):
    """Devuelve (year, month) del mes siguiente, manejando cambio de año."""
    if today.month == 12:
        return today.year + 1, 1
    return today.year, today.month + 1


@pytest.mark.django_db
def test_mark_overdue_credits_open_past_due_as_overdue(env):
    today = timezone.now().date()
    ny, nm = _next_month(today)

    past = _open(env, year=today.year, month=today.month, due=today - timedelta(days=3),
                 billed=Decimal('100000'))
    future = _open(env, year=ny, month=nm, due=today + timedelta(days=3),
                   billed=Decimal('50000'))

    result = mark_overdue_credit_card_statements(days_ahead=5, notify=False)

    assert result['overdue_marked'] == 1
    past.refresh_from_db()
    future.refresh_from_db()
    assert past.status == CreditCardStatement.Status.OVERDUE
    assert future.status == CreditCardStatement.Status.OPEN


@pytest.mark.django_db
def test_mark_overdue_is_idempotent_for_already_overdue(env):
    today = timezone.now().date()

    stmt = _open(env, year=today.year, month=today.month,
                 due=today - timedelta(days=10), billed=Decimal('100000'))
    stmt.status = CreditCardStatement.Status.OVERDUE
    stmt.save()

    # Segunda corrida: ya está OVERDUE, no debe re-marcar ni crashear.
    result = mark_overdue_credit_card_statements(days_ahead=5, notify=False)
    assert result['overdue_marked'] == 0
    stmt.refresh_from_db()
    assert stmt.status == CreditCardStatement.Status.OVERDUE


@pytest.mark.django_db
def test_mark_overdue_creates_notifications_for_upcoming(env):
    today = timezone.now().date()
    ny, nm = _next_month(today)

    # Próximo a vencer (dentro del horizonte de 5 días).
    _open(env, year=today.year, month=today.month,
          due=today + timedelta(days=2), billed=Decimal('75000'))
    # Lejano: fuera del horizonte — NO debe notificar.
    _open(env, year=ny, month=nm, due=today + timedelta(days=30), billed=Decimal('50000'))

    from workflow.models import Notification
    Notification.objects.all().delete()  # limpiar estado previo

    result = mark_overdue_credit_card_statements(days_ahead=5, notify=True)
    assert result['upcoming_count'] == 1
    assert result['upcoming_notified'] == 1

    notifs = Notification.objects.filter(
        user=env['user'],
        notification_type='CARD_STATEMENT_UPCOMING',
    )
    assert notifs.count() == 1
    assert 'Visa Empresa' in notifs.first().message


@pytest.mark.django_db
def test_mark_overdue_dedupes_notifications_same_day(env):
    """Segunda corrida en el mismo día no duplica la notificación."""
    today = timezone.now().date()
    _open(env, year=today.year, month=today.month,
          due=today + timedelta(days=2), billed=Decimal('75000'))

    from workflow.models import Notification
    Notification.objects.all().delete()

    r1 = mark_overdue_credit_card_statements(days_ahead=5, notify=True)
    r2 = mark_overdue_credit_card_statements(days_ahead=5, notify=True)
    assert r1['upcoming_notified'] == 1
    assert r2['upcoming_notified'] == 0
    assert Notification.objects.filter(
        user=env['user'],
        notification_type='CARD_STATEMENT_UPCOMING',
    ).count() == 1


@pytest.mark.django_db
def test_mark_overdue_does_not_touch_paid_or_canceled(env):
    today = timezone.now().date()
    paid = _open(env, year=today.year, month=today.month,
                 due=today - timedelta(days=10), billed=Decimal('100000'))
    paid.status = CreditCardStatement.Status.PAID
    paid.save()

    ny, nm = _next_month(today)
    canceled = _open(env, year=ny, month=nm,
                     due=today - timedelta(days=20), billed=Decimal('100000'))
    canceled.status = CreditCardStatement.Status.CANCELED
    canceled.save()

    result = mark_overdue_credit_card_statements(days_ahead=5, notify=False)
    assert result['overdue_marked'] == 0
    paid.refresh_from_db()
    canceled.refresh_from_db()
    assert paid.status == CreditCardStatement.Status.PAID
    assert canceled.status == CreditCardStatement.Status.CANCELED
