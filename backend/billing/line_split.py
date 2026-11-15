"""Reparto proporcional de líneas y totales (ADR-0138).

Módulo puro, sin acceso a base de datos. Los montos son enteros CLP en
``Decimal``; las cantidades se cuantizan a 0.01.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

_QTY_STEP = Decimal("0.01")
_ZERO = Decimal(0)


@dataclass(frozen=True)
class LineAmount:
    key: int
    quantity: Decimal
    subtotal: Decimal


@dataclass(frozen=True)
class LineShare:
    key: int
    quantity: Decimal
    subtotal: Decimal


def split_proportional(value: Decimal, amounts: list[Decimal]) -> list[Decimal]:
    """Reparte ``value`` en proporción a ``amounts``; la última parte absorbe el resto."""
    total = sum(amounts, _ZERO)
    if total == 0:
        return [value] + [_ZERO] * (len(amounts) - 1)
    parts: list[Decimal] = []
    remaining = value
    for amount in amounts[:-1]:
        part = (value * amount) // total
        parts.append(part)
        remaining -= part
    parts.append(remaining)
    return parts


def _qty(value: Decimal) -> Decimal:
    return value.quantize(_QTY_STEP, rounding=ROUND_HALF_UP)


def _portion_subtotals(rem_sub: list[Decimal], amount: Decimal) -> list[Decimal]:
    """Subtotales por línea para una porción: base floor + residuo por mayor fracción."""
    total = sum(rem_sub, _ZERO)
    if total == 0:
        return [_ZERO] * len(rem_sub)
    bases: list[Decimal] = []
    fracs: list[Decimal] = []
    for sub in rem_sub:
        num = sub * amount
        bases.append(num // total)
        fracs.append(num % total)
    residue = int(amount - sum(bases, _ZERO))
    order = sorted(range(len(rem_sub)), key=lambda i: (-fracs[i], i))
    while residue > 0:
        progressed = False
        for i in order:
            if residue == 0:
                break
            if bases[i] < rem_sub[i]:
                bases[i] += 1
                residue -= 1
                progressed = True
        if not progressed:
            break
    return bases


def split_lines(lines: list[LineAmount], amounts: list[Decimal]) -> list[list[LineShare]]:
    """Reparte las líneas en una porción por monto, en el mismo orden de ``amounts``."""
    rem_sub = [line.subtotal for line in lines]
    rem_qty = [line.quantity for line in lines]
    portions: list[list[LineShare]] = []
    last = len(amounts) - 1
    for p, amount in enumerate(amounts):
        if p == last:
            portions.append(
                [LineShare(ln.key, rem_qty[i], rem_sub[i]) for i, ln in enumerate(lines)]
            )
            break
        shares = _portion_subtotals(rem_sub, amount)
        portion: list[LineShare] = []
        for i, line in enumerate(lines):
            if rem_sub[i] == 0:
                qty = rem_qty[i]  # línea sin subtotal: toda su cantidad en la primera porción
            elif shares[i] == rem_sub[i]:
                qty = rem_qty[i]
            else:
                qty = min(_qty(rem_qty[i] * shares[i] / rem_sub[i]), rem_qty[i])
            portion.append(LineShare(line.key, qty, shares[i]))
            rem_qty[i] -= qty
            rem_sub[i] -= shares[i]
        portions.append(portion)
    return portions
