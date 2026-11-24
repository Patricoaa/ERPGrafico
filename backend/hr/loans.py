"""Matemática de préstamos a empleados (ADR-0156). Sin ORM: cuota fija, tasa efectiva y recálculo.

Montos en CLP enteros. La tasa `r` es una fracción mensual (`0.01` = 1 %).
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

MONTHLY = "MONTHLY"
ANNUAL = "ANNUAL"


@dataclass(frozen=True)
class InstallmentSpec:
    number: int
    year: int
    month: int
    principal: int
    interest: int
    amount: int


def _round(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def monthly_rate(rate: Decimal, period: str) -> Decimal:
    """Tasa mensual: la anual se convierte a su equivalente efectivo `(1+a)^(1/12) − 1`."""
    if period == MONTHLY:
        return Decimal(rate)
    if period == ANNUAL:
        return (Decimal(1) + Decimal(rate)) ** (Decimal(1) / Decimal(12)) - Decimal(1)
    raise ValueError(f"Periodicidad de tasa inválida: {period}")


def split_installment(balance: int, r: Decimal, amount: int) -> tuple[int, int]:
    """Reparte una cuota en `(capital, interés)` sobre el saldo; rechaza cuotas bajo el interés."""
    interest = _round(Decimal(balance) * r)
    if amount < interest:
        raise ValueError("La cuota no puede ser menor al interés del período.")
    return amount - interest, interest


def _next_period(year: int, month: int) -> tuple[int, int]:
    return (year + 1, 1) if month == 12 else (year, month + 1)


def _fixed_payment(balance: int, r: Decimal, n: int) -> int:
    if r == 0:
        return _round(Decimal(balance) / n)
    return _round(Decimal(balance) * r / (Decimal(1) - (Decimal(1) + r) ** -n))


def _amortize(balance: int, r: Decimal, n: int, first: tuple[int, int], start_number: int) -> list[InstallmentSpec]:
    if n < 1:
        raise ValueError("El préstamo requiere al menos una cuota.")
    n = min(n, balance)  # cada cuota amortiza al menos $1 de capital: no hay cuotas de monto 0
    payment = _fixed_payment(balance, r, n)
    year, month = first
    remaining = balance
    rows: list[InstallmentSpec] = []
    for i in range(n):
        interest = _round(Decimal(remaining) * r)
        # Deja al menos $1 de capital a cada cuota posterior; la última absorbe el redondeo.
        principal = remaining if i == n - 1 else min(max(payment - interest, 1), remaining - (n - 1 - i))
        rows.append(InstallmentSpec(start_number + i, year, month, principal, interest, principal + interest))
        remaining -= principal
        year, month = _next_period(year, month)
    return rows


def build_schedule(principal: int, r: Decimal, n: int, first: tuple[int, int]) -> list[InstallmentSpec]:
    return _amortize(principal, r, n, first, 1)


def reschedule(balance: int, r: Decimal, remaining: int, first: tuple[int, int], start_number: int) -> list[InstallmentSpec]:
    """Recalcula las cuotas restantes con el saldo actual, manteniendo el plazo restante."""
    return _amortize(balance, r, remaining, first, start_number)
