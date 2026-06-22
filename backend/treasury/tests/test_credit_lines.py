"""
Tests del modelo CreditLine: creación, propiedades usado/disponible,
validaciones, y auto-creación via data migration.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountType
from treasury.models import Bank, CreditLine, TreasuryAccount


@pytest.fixture
def base(db):
    bank = Bank.objects.create(name='Banco Líneas', code='BLN')

    Account.objects.create(
        name='Efectivo y Equivalentes', code='1.1.01',
        account_type=AccountType.ASSET,
    )
    bank_acc = Account.objects.create(
        name='Cta Líneas', code='1.1.01.090',
        account_type=AccountType.ASSET,
    )
    bank_ta = TreasuryAccount.objects.create(
        name='Cta Líneas', account=bank_acc,
        account_type=TreasuryAccount.Type.CHECKING,
        bank=bank, account_number='901',
    )

    return {'bank': bank, 'bank_ta': bank_ta}


def _make_credit_line(**overrides):
    defaults = {
        'treasury_account_id': 1,
        'code': 'LINEA-001',
        'currency': 'CLP',
        'credit_limit': Decimal('100000000'),
        'interest_rate': Decimal('0.80'),
        'rate_basis': 'MONTHLY',
        'spread': Decimal('0'),
        'valid_from': date(2026, 1, 1),
        'valid_until': date(2028, 1, 1),
        'status': 'ACTIVE',
    }
    defaults.update(overrides)
    return CreditLine.objects.create(**defaults)


class TestCreditLineModel:

    def test_create_credit_line(self, base):
        cl = _make_credit_line(treasury_account=base['bank_ta'])
        assert cl.display_id == 'CL-LINEA-001'
        assert cl.status == 'ACTIVE'
        assert cl.credit_limit == Decimal('100000000')
        assert cl.used_amount == Decimal('0')
        assert cl.available_amount == Decimal('100000000')
        assert cl.utilization_rate == Decimal('0')

    def test_validation_valid_until_before_valid_from(self, base):
        cl = CreditLine(
            treasury_account=base['bank_ta'], code='ERR-LINEA',
            credit_limit=Decimal('10000000'),
            valid_from=date(2026, 6, 1),
            valid_until=date(2026, 1, 1),
        )
        with pytest.raises(ValidationError):
            cl.full_clean()

    def test_validation_auto_renewal_without_term(self, base):
        cl = CreditLine(
            treasury_account=base['bank_ta'], code='ERR-LINEA',
            credit_limit=Decimal('10000000'),
            valid_from=date(2026, 1, 1),
            valid_until=date(2028, 1, 1),
            auto_renewal=True,
            renewal_term_months=None,
        )
        with pytest.raises(ValidationError):
            cl.full_clean()

    def test_auto_renewal_with_term_valid(self, base):
        cl = _make_credit_line(treasury_account=base['bank_ta'],
                               auto_renewal=True, renewal_term_months=12)
        cl.full_clean()
        assert cl.renewal_term_months == 12

    def test_display_id_without_code(self, base):
        cl = _make_credit_line(treasury_account=base['bank_ta'], code='')
        assert cl.display_id.startswith('CL-')

    def test_utilization_rate_none_when_no_credit_limit(self, base):
        cl = _make_credit_line(treasury_account=base['bank_ta'],
                               credit_limit=Decimal('0'))
        assert cl.utilization_rate is None

    def test_validation_negative_credit_limit(self, base):
        cl = CreditLine(
            treasury_account=base['bank_ta'], code='ERR-NEG',
            credit_limit=Decimal('-10000'),
            valid_from=date(2026, 1, 1),
        )
        with pytest.raises(ValidationError):
            cl.full_clean()
