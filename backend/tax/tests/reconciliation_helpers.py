"""Fábricas compartidas por los tests de cuadre fiscal (ADR-0138).

Crean documentos POS ya emitidos y ventas TUU directo por ORM, sin pasar por
el checkout, para que cada test declare solo lo que compara.
"""

import itertools
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone

from accounting.models import Account, AccountType, RCVSettings
from billing.models import Invoice
from contacts.models import Contact
from sales.models import SaleOrder
from treasury.models import (
    PaymentMethod,
    PaymentTerminalDevice,
    POSSession,
    POSTerminal,
    TerminalSale,
    TreasuryAccount,
    TreasuryMovement,
)
from treasury.tests.helpers import make_terminal_provider

_seq = itertools.count(1)


@dataclass
class TerminalEnv:
    provider: object
    device: PaymentTerminalDevice
    terminal: POSTerminal
    session: POSSession
    card: PaymentMethod
    cash: PaymentMethod
    cash_account: TreasuryAccount
    customer: Contact
    user: object


def local_dt(y: int, m: int, d: int, hh: int = 12, mm: int = 0, ss: int = 0) -> datetime:
    """Datetime consciente en la zona horaria local del proyecto."""
    return timezone.make_aware(datetime(y, m, d, hh, mm, ss))


def set_match_settings(start: date | None, window: int = 15) -> RCVSettings:
    settings = RCVSettings.get_settings()
    settings.fiscal_match_start_date = start
    settings.terminal_match_window_minutes = window
    settings.save()
    return settings


def make_terminal_env(suffix: str = "") -> TerminalEnv:
    """Caja POS con un dispositivo TUU integrado y efectivo, y una sesión abierta."""
    n = next(_seq)
    Account.objects.get_or_create(
        code=Account.CASH_GROUP_CODE,
        defaults={"name": "Efectivo", "account_type": AccountType.ASSET},
    )
    acc = Account.objects.create(code=f"1.1.01.9{n:02d}", name=f"Caja {n}", account_type=AccountType.ASSET)
    ta = TreasuryAccount.objects.create(name=f"Caja Física {n}", account_type="CASH", account=acc)
    terminal = POSTerminal.objects.create(name=f"Caja {n}", code=f"CF-{n}{suffix}", default_treasury_account=ta)
    user = get_user_model().objects.create_user(username=f"cajero-cf-{n}", password="x")
    session = POSSession.objects.create(user=user, terminal=terminal)
    provider = make_terminal_provider()
    device = PaymentTerminalDevice.objects.create(name=f"D{n}", serial_number=f"SN-CF-{n}", provider=provider)
    card = PaymentMethod.objects.create(
        name=f"Tarjeta {n}", method_type=PaymentMethod.Type.CARD_TERMINAL,
        treasury_account=ta, linked_terminal_device=device,
    )
    cash = PaymentMethod.objects.create(name=f"Efectivo {n}", method_type="CASH", treasury_account=ta)
    terminal.allowed_payment_methods.add(card, cash)
    customer = Contact.objects.create(name=f"Cliente CF {n}", tax_id=f"11.{n:03d}.111-1")
    return TerminalEnv(provider, device, terminal, session, card, cash, ta, customer, user)


def make_pos_document(
    env: TerminalEnv,
    total: int | Decimal,
    at: datetime,
    *,
    dte_type: str = Invoice.DTEType.COMPROBANTE_PAGO,
    method: str = "CARD",
    status: str = Invoice.Status.POSTED,
) -> Invoice:
    """Documento de venta POS emitido con su cobro en la sesión de ``env``."""
    total = Decimal(total)
    order = SaleOrder.objects.create(customer=env.customer, date=at.date())
    invoice = Invoice.objects.create(
        dte_type=dte_type, status=status, contact=env.customer, sale_order=order,
        total=total, total_net=total, total_tax=Decimal("0"), date=at.date(),
    )
    movement = TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND,
        payment_method=method,
        payment_method_new=env.card if method == "CARD" else env.cash,
        amount=total, created_by=env.user, contact=env.customer,
        to_account=env.cash_account, invoice=invoice, sale_order=order,
        pos_session=env.session, date=at.date(),
    )
    TreasuryMovement.objects.filter(pk=movement.pk).update(created_at=at)
    return invoice


def make_terminal_sale(
    env: TerminalEnv,
    amount: int | Decimal,
    at: datetime,
    *,
    payment_type: str = TerminalSale.PaymentType.DEBIT,
    document_type: int | None = 48,
    status: str = TerminalSale.Status.COMPLETED,
    device: PaymentTerminalDevice | None | str = "env",
    **extra,
) -> TerminalSale:
    """Venta TUU sincronizada (sin folio) en el dispositivo de ``env``."""
    n = next(_seq)
    amount = Decimal(amount)
    return TerminalSale.objects.create(
        provider=env.provider,
        device=env.device if device == "env" else device,
        natural_key=f"cf-{n}",
        serial_number=env.device.serial_number,
        sale_id=f"CF{n}",
        sequence_number=str(n),
        transaction_at=at,
        status=status,
        payment_type=payment_type,
        document_type=document_type,
        sale_amount=amount,
        total_amount=amount,
        **extra,
    )
