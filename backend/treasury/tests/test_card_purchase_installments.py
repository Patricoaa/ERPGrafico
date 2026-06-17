"""
Tests de `TreasuryService.create_card_purchase` bajo el modelo ADR-0046:

  - El **uso** de la TC es 1 `OUTBOUND` por el total + 1 asiento
    (`D=proveedor / H=pasivo tarjeta`), `is_billed=True`.
  - Las **cuotas** son filas de cronograma (`CardPurchaseInstallment`),
    sin contabilidad, con vencimiento por mes calendario.
  - La **facturación** mensual (`bill_unbilled_charges`) toma las cuotas
    que vencen hasta el cierre y NO re-postea el pasivo (sin doble
    conteo).
  - Las cuotas con interés (`monthly_rate > 0`) están diferidas →
    `ValidationError`.
  - Normalización de `date` (string ISO / datetime).
  - Idempotencia por `client_reference`.
"""
import pytest
from datetime import date, datetime
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountType
from treasury.models import (
    Bank, CardPurchaseGroup, CardPurchaseInstallment,
    CreditCardStatement, TreasuryAccount, TreasuryMovement,
)
from treasury.card_service import CardService
from treasury.services import TreasuryService


User = get_user_model()


def _make_env():
    """Banco, tarjeta (LIABILITY), proveedor y cuentas."""
    user = User.objects.create_user(username='cp_user', password='x')
    bank = Bank.objects.create(name='Banco Cuotas')
    bank_ta = TreasuryAccount.objects.create(
        bank=bank, name='Cta Cte', account_type=TreasuryAccount.Type.CHECKING,
        account_number='0001',
    )
    card_acc = Account.objects.create(
        code='2.1.09.50', name='Visa Pasivo',
        account_type=AccountType.LIABILITY,
    )
    card_ta = TreasuryAccount.objects.create(
        bank=bank, name='Visa', account=card_acc,
        account_type=TreasuryAccount.Type.CREDIT_CARD,
    )
    from contacts.models import Contact
    payable_acc = Account.objects.create(
        code='2.1.01.020', name='Proveedor Cuotas',
        account_type=AccountType.LIABILITY,
    )
    supplier = Contact.objects.create(
        name='Proveedor Cuotas', tax_id='76.123.456-7',
    )
    return {
        'user': user, 'bank': bank, 'bank_ta': bank_ta,
        'card_ta': card_ta, 'card_acc': card_acc,
        'supplier': supplier, 'payable_acc': payable_acc,
    }


@pytest.fixture
def env(db):
    return _make_env()


@pytest.mark.django_db
def test_card_purchase_single_installment(env):
    """1 cuota: 1 OUTBOUND por el total + 1 fila de cronograma."""
    group = TreasuryService.create_card_purchase(
        amount=Decimal('50000'),
        card_account=env['card_ta'],
        installments=1,
        date=date(2026, 6, 15),
        partner=env['supplier'],
        client_reference='CP-SINGLE-001',
        created_by=env['user'],
    )

    movements = list(group.movements.all())
    assert len(movements) == 1
    mv = movements[0]
    assert mv.movement_type == TreasuryMovement.Type.OUTBOUND
    assert mv.amount == Decimal('50000')
    assert mv.from_account == env['card_ta']
    assert mv.is_billed is True            # el uso, no un cargo pendiente
    assert mv.installment_number is None   # ya no es "una cuota"
    assert mv.card_purchase_group_id == group.id

    schedule = list(group.schedule.order_by('number'))
    assert len(schedule) == 1
    assert schedule[0].principal_amount == Decimal('50000')
    assert schedule[0].due_date == date(2026, 6, 15)
    assert schedule[0].is_billed is False


@pytest.mark.django_db
def test_card_purchase_three_installments_schedule(env):
    """3 cuotas: 1 OUTBOUND por el total + 3 filas (residuo en la última)."""
    group = TreasuryService.create_card_purchase(
        amount=Decimal('100000'),
        card_account=env['card_ta'],
        installments=3,
        date=date(2026, 6, 15),
        partner=env['supplier'],
        client_reference='CP-3-001',
        created_by=env['user'],
    )

    # Un solo movimiento de tesorería por el total.
    movements = list(group.movements.all())
    assert len(movements) == 1
    assert movements[0].amount == Decimal('100000')

    # Cronograma: 3 cuotas que suman el total, vencimiento mensual.
    schedule = list(group.schedule.order_by('number'))
    assert [s.principal_amount for s in schedule] == [
        Decimal('33333.33'), Decimal('33333.33'), Decimal('33333.34'),
    ]
    assert sum(s.principal_amount for s in schedule) == Decimal('100000')
    assert [s.due_date for s in schedule] == [
        date(2026, 6, 15), date(2026, 7, 15), date(2026, 8, 15),
    ]


@pytest.mark.django_db
def test_card_purchase_use_posts_one_journal_entry(env):
    """El uso genera 1 asiento estándar D=proveedor / H=pasivo tarjeta."""
    from accounting.models import JournalEntry
    group = TreasuryService.create_card_purchase(
        amount=Decimal('20000'),
        card_account=env['card_ta'],
        installments=3,
        partner=env['supplier'],
        date=date(2026, 6, 15),
        client_reference='CP-JE-001',
        created_by=env['user'],
    )
    mv = group.movements.get()
    assert mv.journal_entry is not None
    assert mv.journal_entry.status == JournalEntry.Status.POSTED
    items = list(mv.journal_entry.items.all())
    debits = [it for it in items if it.debit > 0]
    credits = [it for it in items if it.credit > 0]
    assert len(debits) == 1 and len(credits) == 1
    assert credits[0].account == env['card_acc']      # H pasivo tarjeta
    assert credits[0].credit == Decimal('20000')
    assert debits[0].account == env['payable_acc']     # D proveedor
    assert debits[0].debit == Decimal('20000')


@pytest.mark.django_db
def test_card_purchase_liability_rises_once_after_billing(env):
    """Regresión del doble conteo (ADR-0046 D-3): el pasivo sube `amount`
    UNA sola vez. Facturar las cuotas NO vuelve a acreditar el pasivo."""
    initial = env['card_acc'].balance

    group = TreasuryService.create_card_purchase(
        amount=Decimal('30000'),
        card_account=env['card_ta'],
        installments=3,
        partner=env['supplier'],
        date=date(2026, 6, 15),
        client_reference='CP-DBL-001',
        created_by=env['user'],
    )
    env['card_acc'].refresh_from_db()
    after_use = env['card_acc'].balance
    assert after_use == initial + Decimal('30000')

    # Facturar las 3 cuotas (cierre que cubre las tres).
    stmt = CardService.bill_unbilled_charges(
        card_account=env['card_ta'],
        period_year=2026, period_month=8,
        cut_off_date=date(2026, 8, 31),
        due_date=date(2026, 9, 20),
        created_by=env['user'],
    )
    assert stmt.billed_amount == Decimal('30000')

    # El pasivo NO se duplica: sigue en +30000 (no +60000).
    env['card_acc'].refresh_from_db()
    assert env['card_acc'].balance == initial + Decimal('30000')
    # Y solo hay un movimiento de tesorería (el uso).
    assert group.movements.count() == 1


@pytest.mark.django_db
def test_card_purchase_monthly_statement_spread(env):
    """Cada statement mensual factura solo la cuota que vence en su
    período (cronograma, ADR-0046)."""
    TreasuryService.create_card_purchase(
        amount=Decimal('30000'),
        card_account=env['card_ta'],
        installments=3,
        date=date(2026, 6, 15),
        partner=env['supplier'],
        client_reference='CP-SPREAD-001',
        created_by=env['user'],
    )

    s1 = CardService.bill_unbilled_charges(
        card_account=env['card_ta'], period_year=2026, period_month=6,
        cut_off_date=date(2026, 6, 30), due_date=date(2026, 7, 20),
        created_by=env['user'],
    )
    assert s1.billed_amount == Decimal('10000')   # cuota 1

    s2 = CardService.bill_unbilled_charges(
        card_account=env['card_ta'], period_year=2026, period_month=7,
        cut_off_date=date(2026, 7, 31), due_date=date(2026, 8, 20),
        created_by=env['user'],
    )
    assert s2.billed_amount == Decimal('10000')   # cuota 2

    s3 = CardService.bill_unbilled_charges(
        card_account=env['card_ta'], period_year=2026, period_month=8,
        cut_off_date=date(2026, 8, 31), due_date=date(2026, 9, 20),
        created_by=env['user'],
    )
    assert s3.billed_amount == Decimal('10000')   # cuota 3

    # Todas las cuotas quedaron facturadas exactamente una vez.
    assert CardPurchaseInstallment.objects.filter(is_billed=False).count() == 0


@pytest.mark.django_db
def test_card_purchase_rejects_interest(env):
    """`monthly_rate > 0` está diferido → ValidationError."""
    with pytest.raises(ValidationError, match='soportad'):
        TreasuryService.create_card_purchase(
            amount=Decimal('60000'),
            card_account=env['card_ta'],
            installments=6,
            monthly_rate=Decimal('0.015'),
            date=date(2026, 6, 15),
            created_by=env['user'],
        )


@pytest.mark.django_db
def test_card_purchase_accepts_string_date(env):
    """Regresión: el checkout pasa `date` como string ISO
    (`request.data.get('document_date')`). Debe normalizarse a un `date`
    real y distribuir el cronograma por mes calendario."""
    group = TreasuryService.create_card_purchase(
        amount=Decimal('30000'),
        card_account=env['card_ta'],
        installments=3,
        date='2026-06-15',  # ← string, como llega del request
        partner=env['supplier'],
        client_reference='CP-STR-DATE-001',
        created_by=env['user'],
    )
    assert group.first_installment_date == date(2026, 6, 15)
    schedule = list(group.schedule.order_by('number'))
    assert [s.due_date for s in schedule] == [
        date(2026, 6, 15), date(2026, 7, 15), date(2026, 8, 15),
    ]


@pytest.mark.django_db
def test_card_purchase_accepts_datetime_date(env):
    """Si llega un `datetime`, se normaliza a su componente fecha."""
    group = TreasuryService.create_card_purchase(
        amount=Decimal('20000'),
        card_account=env['card_ta'],
        installments=2,
        date=datetime(2026, 6, 15, 14, 30, 0),  # ← datetime con hora
        partner=env['supplier'],
        client_reference='CP-DT-DATE-001',
        created_by=env['user'],
    )
    assert group.first_installment_date == date(2026, 6, 15)
    schedule = list(group.schedule.order_by('number'))
    assert [s.due_date for s in schedule] == [date(2026, 6, 15), date(2026, 7, 15)]


@pytest.mark.django_db
def test_card_purchase_idempotent_by_client_reference(env):
    """Dos llamadas con la misma `client_reference` no duplican."""
    g1 = TreasuryService.create_card_purchase(
        amount=Decimal('30000'), card_account=env['card_ta'], installments=3,
        partner=env['supplier'],
        client_reference='CP-IDEM-001', date=date(2026, 6, 15),
        created_by=env['user'],
    )
    g2 = TreasuryService.create_card_purchase(
        amount=Decimal('30000'), card_account=env['card_ta'], installments=3,
        partner=env['supplier'],
        client_reference='CP-IDEM-001', date=date(2026, 6, 15),
        created_by=env['user'],
    )
    assert g1.id == g2.id
    assert g1.movements.count() == 1            # un solo uso
    assert g1.schedule.count() == 3             # cronograma no duplicado


@pytest.mark.django_db
def test_card_purchase_validates_card_account_type(env):
    """Rechaza cuenta no-CREDIT_CARD."""
    with pytest.raises(ValidationError, match='CREDIT_CARD'):
        TreasuryService.create_card_purchase(
            amount=Decimal('10000'), card_account=env['bank_ta'], installments=1,
        )


@pytest.mark.django_db
def test_card_purchase_validates_installments_range(env):
    """installments fuera de [1, 36] → ValidationError."""
    with pytest.raises(ValidationError, match='cuotas'):
        TreasuryService.create_card_purchase(
            amount=Decimal('10000'), card_account=env['card_ta'], installments=0,
        )
    with pytest.raises(ValidationError, match='cuotas'):
        TreasuryService.create_card_purchase(
            amount=Decimal('10000'), card_account=env['card_ta'], installments=37,
        )


@pytest.mark.django_db
def test_card_purchase_validates_amount_positive(env):
    """amount <= 0 → ValidationError."""
    with pytest.raises(ValidationError, match='monto'):
        TreasuryService.create_card_purchase(
            amount=Decimal('0'), card_account=env['card_ta'], installments=1,
        )


@pytest.mark.django_db
def test_card_purchase_use_falls_back_to_default_payable(env):
    """E1: si el proveedor no tiene cuenta por pagar propia pero hay
    `default_payable_account` configurada, el asiento del uso se postea
    contra el default (antes el fallback era inalcanzable y el asiento se
    descartaba en silencio, dejando el pasivo TC sin registrar)."""
    from accounting.models import AccountingSettings, JournalEntry
    from contacts.models import Contact

    default_payable = Account.objects.create(
        code='2.1.01.999', name='Proveedores Varios',
        account_type=AccountType.LIABILITY,
    )
    settings = AccountingSettings.get_solo()
    settings.default_payable_account = default_payable
    settings.save(update_fields=['default_payable_account'])

    supplier_no_acc = Contact.objects.create(
        name='Prov Sin Cuenta', tax_id='77.777.777-7',
    )
    group = TreasuryService.create_card_purchase(
        amount=Decimal('40000'), card_account=env['card_ta'], installments=2,
        partner=supplier_no_acc, date=date(2026, 6, 15),
        client_reference='CP-E1-DEFAULT', created_by=env['user'],
    )
    mv = group.movements.get()
    assert mv.journal_entry is not None
    assert mv.journal_entry.status == JournalEntry.Status.POSTED
    debits = [it for it in mv.journal_entry.items.all() if it.debit > 0]
    credits = [it for it in mv.journal_entry.items.all() if it.credit > 0]
    assert debits[0].account == default_payable      # D contra el default
    assert credits[0].account == env['card_acc']      # H pasivo tarjeta


@pytest.mark.django_db
def test_card_purchase_aborts_when_use_unbookable(env):
    """E4: si el uso no se puede contabilizar (proveedor sin cuenta por
    pagar y sin `default_payable_account`), create_card_purchase aborta con
    ValidationError y, por ser atómico, no persiste grupo/movimiento/cuotas
    (no quedan pasivos fantasma ni cuotas facturando deuda no registrada)."""
    from contacts.models import Contact

    supplier_no_acc = Contact.objects.create(
        name='Prov Sin Cuenta', tax_id='78.888.888-8',
    )
    with pytest.raises(ValidationError, match='contabilizar el uso'):
        TreasuryService.create_card_purchase(
            amount=Decimal('40000'), card_account=env['card_ta'], installments=2,
            partner=supplier_no_acc, date=date(2026, 6, 15),
            client_reference='CP-E4-ABORT', created_by=env['user'],
        )

    assert not CardPurchaseGroup.objects.filter(
        client_reference='CP-E4-ABORT'
    ).exists()
    assert CardPurchaseInstallment.objects.count() == 0
    assert not TreasuryMovement.objects.filter(reference__startswith='CP-').exists()
