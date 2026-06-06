"""
loan_provisioning.py — Auto-provisión de TreasuryAccount tipo LOAN
para BankLoan, ligada a una cuenta contable de pasivo (LIABILITY).

Patrón: dado un (bank, accounting_account LIABILITY), busca o crea la
TreasuryAccount wrapper de tipo LOAN que materializa la deuda para esa
combinación. Es idempotente: si ya existe, la retorna sin tocarla.

Decisión: NO se usa `TreasuryProvisioningService.provision` (que sólo cubre
CASH/CHECKING/CREDIT_CARD y exige tenders). La cuenta de pasivo no necesita
tenders (la deuda no se "paga con ella", se amortiza desde una cuenta
corriente). ADR-0041.
"""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.translation import gettext_lazy as _t

from .models import TreasuryAccount

if TYPE_CHECKING:  # pragma: no cover
    from accounting.models import Account
    from .models import Bank


logger = logging.getLogger(__name__)


@transaction.atomic
def get_or_create_loan_treasury_account(
    *,
    bank: "Bank",
    accounting_account: "Account",
    currency: str = "CLP",
    name: str | None = None,
) -> TreasuryAccount:
    """
    Retorna (o crea) la TreasuryAccount tipo LOAN que materializa la deuda
    de un crédito, para el par (banco, cuenta contable LIABILIDAD).

    - Busca por `(bank, account, account_type=LOAN)`. Si existe, la retorna
      tal cual (no actualiza el nombre: respeta ediciones manuales).
    - Si no existe, la crea con nombre autoderivado y la retorna.

    Raises:
        ValidationError: si `accounting_account.account_type != LIABILITY`,
        si no es hoja (`is_selectable=False`), o si ya está vinculada a
        otra TreasuryAccount de tipo distinto a LOAN (la regla de
        unicidad del modelo se valida aquí antes de la inserción).
    """
    if accounting_account.account_type != "LIABILITY":
        raise ValidationError(
            _t("La cuenta contable del pasivo debe ser de tipo LIABILITY (cuentas por pagar).")
        )
    if not getattr(accounting_account, "is_selectable", True):
        raise ValidationError(
            _t("La cuenta contable del pasivo debe ser una cuenta auxiliar (hoja).")
        )

    existing = (
        TreasuryAccount.objects
        .select_for_update()
        .filter(
            bank=bank,
            account=accounting_account,
            account_type=TreasuryAccount.Type.LOAN,
        )
        .first()
    )
    if existing:
        return existing

    # Defensa adicional: si la cuenta ya está usada por OTRA treasury account
    # de tipo distinto (p. ej. CREDIT_CARD), el clean() del modelo la rechaza.
    # Lo chequeamos acá para devolver un error legible, en vez de un 500.
    cross_use = (
        TreasuryAccount.objects
        .filter(account=accounting_account)
        .exclude(account_type=TreasuryAccount.Type.LOAN)
        .exists()
    )
    if cross_use:
        raise ValidationError(
            _t(
                "La cuenta contable %(code)s ya está vinculada a otra cuenta de "
                "tesorería (no LOAN). Use una cuenta contable distinta para el "
                "pasivo del préstamo."
            )
            % {"code": accounting_account.code}
        )

    derived_name = name or f"{bank.name} — Préstamo Bancario ({currency})"
    ta = TreasuryAccount.objects.create(
        name=derived_name,
        account=accounting_account,
        account_type=TreasuryAccount.Type.LOAN,
        bank=bank,
        currency=currency,
    )
    logger.info(
        "Auto-creada TreasuryAccount LOAN: %s (bank=%s, account=%s)",
        ta.name, bank.id, accounting_account.code,
    )
    return ta
