"""Ayudas de prueba para sesiones POS con modo de caja por dispositivo."""

import itertools

from treasury.models import POSSession


def make_pos_session(user, mode: str = "SINGLE", **extra) -> POSSession:
    """Sesión abierta por ``user`` que la opera en el modo de caja indicado."""
    session = POSSession.objects.create(user=user, **extra)
    session.set_device_mode(user, mode)
    return session


_provider_seq = itertools.count(1)


def make_terminal_provider(name: str | None = None, provider_type: str = "TUU"):
    """Proveedor de terminal con contacto y cuentas únicos (sin colisiones por nombre)."""
    from accounting.models import Account, AccountType
    from contacts.models import Contact
    from treasury.models import PaymentTerminalProvider

    n = next(_provider_seq)
    name = name or f"TUU {n}"
    supplier = Contact.objects.create(name=f"Proveedor {name}", tax_id=f"77.{n:03d}.000-0")

    def acct(code, kind):
        return Account.objects.create(name=f"{name} {code}", code=code, account_type=kind)

    return PaymentTerminalProvider.objects.create(
        name=name,
        provider_type=provider_type,
        supplier=supplier,
        receivable_account=acct(f"1.1.8{n:03d}.01", AccountType.ASSET),
        commission_expense_account=acct(f"5.1.8{n:03d}.01", AccountType.EXPENSE),
        commission_iva_account=acct(f"1.1.8{n:03d}.02", AccountType.ASSET),
    )
