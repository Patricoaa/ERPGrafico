"""
deletion_service.py — Política de eliminación (Archivo) para ``treasury.Bank``.

Siguiendo [deletion-policy.md](../../../docs/20-contracts/deletion-policy.md),
``Bank`` pertenece a la categoría 2 (dato maestro referenciado por entidades
históricas). El patrón autorizado es **Archivo** (``is_active = False``) con
pareja ``restore``.

Este servicio:

- ``get_dependencies(bank)``: cuenta las entidades vinculadas.
- ``can_archive(bank)``: reglas de negocio para archivar. Bloquea si hay
  préstamos activos o cheques pendientes. Las cuentas de tesorería y
  chequeras no bloquean el archivo.
- ``can_destroy(bank)``: chequea dependencias ``PROTECT`` para devolver un
  mensaje legible antes de intentar el hard delete (fallback administrativo).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover
    from .models import Bank


@dataclass(frozen=True)
class DependencyCounts:
    treasury_accounts: int
    checks: int
    loans: int
    checkbooks: int

    def total(self) -> int:
        return self.treasury_accounts + self.checks + self.loans + self.checkbooks


class BankDeletionService:
    """Reglas de archivo y borrado de bancos."""

    # Estados terminales o que no bloquean el archivo.
    _NON_BLOCKING_LOAN_STATUSES = ("PAID",)
    _NON_BLOCKING_CHECK_STATUSES = ("VOIDED",)

    # ── Public API ───────────────────────────────────────────────────────────

    @classmethod
    def get_dependencies(cls, bank: "Bank") -> DependencyCounts:
        """Cuenta las entidades vinculadas al banco."""
        return DependencyCounts(
            treasury_accounts=bank.treasury_accounts.count(),
            checks=bank.checks.count(),
            loans=bank.loans.count(),
            checkbooks=bank.checkbooks.count(),
        )

    @classmethod
    def can_archive(cls, bank: "Bank") -> tuple[bool, str | None]:
        """
        Reglas de negocio para archivar un banco.

        Bloquea el archivo si:
        - Hay préstamos con status distinto de ``PAID``.
        - Hay cheques con status distinto de ``VOIDED``.

        Las cuentas de tesorería y chequeras no bloquean: pueden sobrevivir
        con ``bank=NULL`` o archivadas independientemente.
        """
        blocking_loans = bank.loans.exclude(status__in=cls._NON_BLOCKING_LOAN_STATUSES).count()
        if blocking_loans:
            return (
                False,
                f"No se puede archivar: el banco tiene {blocking_loans} "
                f"préstamo(s) vigente(s). Cancele o reasigne los préstamos antes de archivar.",
            )

        blocking_checks = bank.checks.exclude(status__in=cls._NON_BLOCKING_CHECK_STATUSES).count()
        if blocking_checks:
            return (
                False,
                f"No se puede archivar: el banco tiene {blocking_checks} "
                f"cheque(s) pendiente(s). Anule o liquide los cheques antes de archivar.",
            )

        return True, None

    @classmethod
    def can_destroy(cls, bank: "Bank") -> tuple[bool, str | None]:
        """
        Chequea dependencias ``PROTECT`` antes de un hard delete.

        Útil como pre-chequeo en ``BankViewSet.destroy`` para devolver un
        mensaje legible en español con el conteo por tipo, en vez de un 500
        por ``ProtectedError``.
        """
        deps = cls.get_dependencies(bank)
        if deps.loans > 0:
            return False, f"Tiene {deps.loans} préstamo(s) asociado(s)."
        if deps.checks > 0:
            return False, f"Tiene {deps.checks} cheque(s) asociado(s)."
        if deps.checkbooks > 0:
            return False, f"Tiene {deps.checkbooks} chequera(s) asociada(s)."
        return True, None
