"""Condiciones de fórmulas de nómina: evaluador seguro, sin eval (Bandit B307)."""
from decimal import Decimal

import pytest

from hr.services import PayrollService

SEGURO_CESANTIA = (
    "IMPONIBLE * 0.008 if (CONTRATO_INDEFINIDO and CONTRACT_YEARS > 11) "
    "else (IMPONIBLE * 0.024 if CONTRATO_INDEFINIDO else IMPONIBLE * 0.03)"
)


@pytest.mark.parametrize(
    ("ctx", "expected"),
    [
        ({"IMPONIBLE": 1_000_000, "CONTRATO_INDEFINIDO": 1, "CONTRACT_YEARS": 12}, Decimal("8000")),
        ({"IMPONIBLE": 1_000_000, "CONTRATO_INDEFINIDO": 1, "CONTRACT_YEARS": 3}, Decimal("24000")),
        ({"IMPONIBLE": 1_000_000, "CONTRATO_INDEFINIDO": 0, "CONTRACT_YEARS": 3}, Decimal("30000")),
    ],
)
def test_seeded_conditional_formula(ctx, expected):
    assert PayrollService.evaluate_formula(SEGURO_CESANTIA, ctx) == expected


@pytest.mark.parametrize(
    ("cond", "expected"),
    [("1.0 and 5.0 <= 11", True), ("0.0", False), ("not 0", True), ("2 * 3 > 5 or 0", True), ("1 < 2 < 3", True), ("1 < 3 < 2", False)],
)
def test_condition_grammar(cond, expected):
    assert PayrollService._eval_condition(cond) is expected


@pytest.mark.parametrize(
    "payload",
    ["().__class__.__bases__[0].__subclasses__()", "__import__('os').system('id')", "open('/etc/passwd')", "[1][0]", "'a' == 'a'"],
)
def test_condition_rejects_code(payload):
    with pytest.raises(ValueError):
        PayrollService._eval_condition(payload)
