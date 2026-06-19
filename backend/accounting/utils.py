from decimal import Decimal
from .models import AccountingSettings


def get_default_vat_rate() -> Decimal:
    settings = AccountingSettings.get_solo()
    return settings.default_vat_rate if settings else Decimal('19.00')


def get_vat_multiplier() -> Decimal:
    return Decimal('1') + (get_default_vat_rate() / Decimal('100'))
