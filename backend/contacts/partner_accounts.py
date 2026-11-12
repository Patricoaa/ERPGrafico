"""Subcuentas contables por socio.

Las cuentas de socio de ``AccountingSettings`` (capital social, aportes, retiros, utilidades
retenidas, dividendos por pagar, aportes por cobrar) son cuentas padre: cada socio tiene su
propia subcuenta hoja debajo, creada la primera vez que se contabiliza algo para él.
"""

from accounting.models import Account


def _partner_suffix(partner) -> str:
    """Parte del nombre que identifica al socio en la subcuenta.

    El socio más antiguo con un nombre dado usa solo el nombre; los homónimos posteriores
    agregan su identificador (``SOC-12``) para que las subcuentas nunca tengan el mismo nombre.
    """
    from contacts.models import Contact

    has_older_namesake = (
        Contact.objects.filter(is_partner=True, name=partner.name, id__lt=partner.id).exists()
    )
    return f"{partner.name} ({partner.display_id})" if has_older_namesake else partner.name


def resolve_partner_account(partner, parent_account: Account) -> Account:
    """Subcuenta del socio bajo ``parent_account``; la crea si no existe.

    Convención de nombre: ``{padre.name} - {socio}``, con el identificador del socio entre
    paréntesis cuando otro socio más antiguo tiene el mismo nombre. La búsqueda ignora el
    nombre del padre (puede haberse renombrado) y compara el sufijo completo.
    """
    suffix = _partner_suffix(partner)
    existing = Account.objects.filter(parent=parent_account, name__endswith=f" - {suffix}").first()
    if existing:
        return existing
    account = Account(parent=parent_account, name=f"{parent_account.name} - {suffix}")
    account.save()
    return account
