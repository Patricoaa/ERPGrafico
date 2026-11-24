"""Matemática del préstamo: cuota fija, tasa efectiva y recálculo del resto (sin ORM)."""

from decimal import Decimal

import pytest

from hr.loans import build_schedule, monthly_rate, reschedule, split_installment


def test_monthly_rate_annual_is_effective():
    assert abs(monthly_rate(Decimal("0.12"), "ANNUAL") - Decimal("0.009489")) < Decimal("0.000001")
    assert monthly_rate(Decimal("0.01"), "MONTHLY") == Decimal("0.01")


def test_schedule_600000_one_percent_six_installments():
    rows = build_schedule(600000, Decimal("0.01"), 6, (2026, 12))
    assert len(rows) == 6
    assert (rows[0].amount, rows[0].interest, rows[0].principal) == (103529, 6000, 97529)
    assert [(r.year, r.month) for r in rows] == [(2026, 12), (2027, 1), (2027, 2), (2027, 3), (2027, 4), (2027, 5)]
    assert [r.number for r in rows] == [1, 2, 3, 4, 5, 6]
    assert sum(r.principal for r in rows) == 600000
    assert all(r.amount == r.principal + r.interest for r in rows)


def test_schedule_zero_rate():
    rows = build_schedule(600000, Decimal("0"), 6, (2026, 1))
    assert [r.amount for r in rows] == [100000] * 6
    assert all(r.interest == 0 for r in rows)


def test_last_installment_absorbs_rounding():
    for principal, rate, n in ((1_000_003, Decimal("0.0123"), 7), (1_000_003, Decimal("0"), 7)):
        rows = build_schedule(principal, rate, n, (2026, 1))
        assert sum(r.principal for r in rows) == principal


def test_split_rejects_installment_below_interest():
    with pytest.raises(ValueError):
        split_installment(600000, Decimal("0.01"), 5000)
    assert split_installment(600000, Decimal("0.01"), 103529) == (97529, 6000)


def test_reschedule_after_lower_installment_keeps_remaining_term():
    rows = reschedule(502471, Decimal("0.01"), 5, (2027, 1), 2)
    assert [r.number for r in rows] == [2, 3, 4, 5, 6]
    assert sum(r.principal for r in rows) == 502471
    assert (rows[0].year, rows[0].month) == (2027, 1)
