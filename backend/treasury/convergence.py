"""
convergence.py — Convergencia de tipos de cuenta legacy a la nueva taxonomía.

``DEBIT_CARD`` y ``CHECKBOOK`` dejan de ser tipos de cuenta (Capa 1 — ubicación).
Pasan a ser formas de pago (``PaymentMethod``, Capa 2) sobre una cuenta corriente:

  - ``DEBIT_CARD`` (cuenta) → ``CHECKING`` + ``PaymentMethod(DEBIT_CARD)``
  - ``CHECKBOOK``  (cuenta) → ``CHECKING`` + ``PaymentMethod(CHECK)``

Características:
  - **Defensivo:** si la cuenta no puede re-tiparse a ``CHECKING`` (p. ej. falta
    banco o número), se omite y se reporta para resolución manual.
  - **Idempotente:** re-ejecutar no duplica métodos ni reconvierte cuentas.
  - **No mueve movimientos:** la cuenta conserva su cuenta contable y su saldo.

Mecanismo invocado por el command ``converge_treasury_accounts`` (dry-run por
defecto). La eliminación de los valores del enum es un paso posterior y separado.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from django.core.exceptions import ValidationError
from django.db import transaction

from .models import PaymentMethod, TreasuryAccount

_LEGACY_TO_TENDER = {
    TreasuryAccount.Type.DEBIT_CARD: PaymentMethod.Type.DEBIT_CARD,
    TreasuryAccount.Type.CHECKBOOK: PaymentMethod.Type.CHECK,
}

_TENDER_LABELS = {
    PaymentMethod.Type.DEBIT_CARD: "Tarjeta de Débito",
    PaymentMethod.Type.CHECK: "Cheque",
}


@dataclass
class ConvergenceReport:
    converted: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    methods_created: list[str] = field(default_factory=list)

    @property
    def remaining(self) -> int:
        """Cuentas legacy aún presentes (tras un --apply, son las omitidas)."""
        return TreasuryAccount.objects.filter(
            account_type__in=list(_LEGACY_TO_TENDER)
        ).count()


def converge_accounts(*, apply: bool = False) -> ConvergenceReport:
    """
    Converge cuentas DEBIT_CARD/CHECKBOOK a CHECKING + su forma de pago.

    Args:
        apply: si False (default) solo simula (dry-run, no persiste).

    Returns:
        ConvergenceReport con listas de convertidas / omitidas / métodos creados.
    """
    report = ConvergenceReport()
    legacy_qs = TreasuryAccount.objects.filter(account_type__in=list(_LEGACY_TO_TENDER))

    for account in legacy_qs:
        tender = _LEGACY_TO_TENDER[account.account_type]
        original_type = account.account_type

        # Validar el re-tipado a CHECKING sin persistir.
        account.account_type = TreasuryAccount.Type.CHECKING
        try:
            account.clean()
        except ValidationError as exc:
            account.account_type = original_type  # revertir en memoria
            report.skipped.append(
                f"{account.name} (#{account.id}) [{original_type}]: {'; '.join(exc.messages)}"
            )
            continue

        report.converted.append(f"{account.name} (#{account.id}) {original_type}→CHECKING")
        method_exists = account.payment_methods.filter(method_type=tender).exists()
        if not method_exists:
            report.methods_created.append(f"{_TENDER_LABELS[tender]} — {account.name}")

        if not apply:
            account.account_type = original_type  # revertir en memoria (dry-run)
            continue

        with transaction.atomic():
            account.save()
            if not method_exists:
                PaymentMethod(
                    name=f"{_TENDER_LABELS[tender]} — {account.name}",
                    method_type=tender,
                    treasury_account=account,
                    allow_for_purchases=True,
                    # Cheque sirve para cobrar y pagar; débito empresa solo compras
                    # (PaymentMethod.clean() lo fuerza de todos modos).
                    allow_for_sales=(tender == PaymentMethod.Type.CHECK),
                ).save()

    return report
