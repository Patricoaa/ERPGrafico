import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from accounting.models import Account, AccountType
from contacts.models import Contact
from treasury.models import PaymentTerminalProvider, TerminalSale, TerminalSyncSettings

pytestmark = pytest.mark.django_db


def _provider(name="TUU"):
    n = sum(ord(c) for c in name) % 9 + 1
    supplier = Contact.objects.create(name=f"Proveedor {name}", tax_id=f"76.{n}00.000-0")

    def acct(code, kind):
        return Account.objects.create(name=f"{name} {code}", code=code, account_type=kind)

    return PaymentTerminalProvider.objects.create(
        name=name,
        supplier=supplier,
        receivable_account=acct(f"1.1.9{n}.01", AccountType.ASSET),
        commission_expense_account=acct(f"5.1.9{n}.01", AccountType.EXPENSE),
        commission_iva_account=acct(f"1.1.9{n}.02", AccountType.ASSET),
    )


def _sale(provider, key="k1"):
    return TerminalSale.objects.create(
        provider=provider,
        natural_key=key,
        serial_number="S1",
        sale_id="1",
        sequence_number="1",
        transaction_at=timezone.now(),
    )


def test_settings_singleton_defaults():
    a = TerminalSyncSettings.get_settings()
    b = TerminalSyncSettings.get_settings()
    assert a.pk == b.pk
    assert a.enabled is False
    assert a.run_hour == 3
    assert a.lookback_days == 7
    assert a.history_start_date is None
    assert a.max_retries == 3
    assert a.retry_delay_minutes == 10


def test_sale_unique_per_provider_and_key():
    p1, p2 = _provider("A"), _provider("B")
    _sale(p1)
    with pytest.raises(IntegrityError), transaction.atomic():
        _sale(p1)
    _sale(p2)


def test_document_type_label():
    p = _provider()
    s = _sale(p)
    for n, label in [
        (33, "Factura afecta"),
        (48, "Comprobante de pago"),
        (99, "DTE 99"),
        (None, ""),
    ]:
        s.document_type = n
        assert s.document_type_label == label
