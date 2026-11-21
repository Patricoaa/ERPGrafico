import json
from decimal import Decimal
from pathlib import Path

import pytest

from accounting.vat import (
    SalePrice,
    gross_from_net,
    net_from_gross,
    sale_price_from_gross,
    sale_price_from_input,
)

M = Decimal("1.19")
FIXTURE = Path(__file__).resolve().parents[3] / "shared" / "vat-rounding-cases.json"
CASES = json.loads(FIXTURE.read_text())


def test_fixture_declares_multiplier():
    assert Decimal(CASES["multiplier"]) == M


@pytest.mark.parametrize("case", CASES["gross_to_net"], ids=lambda c: str(c["gross"]))
def test_net_from_gross_matches_fixture(case):
    assert net_from_gross(case["gross"], M) == Decimal(case["net"])


@pytest.mark.parametrize("case", CASES["net_to_gross"], ids=lambda c: str(c["net"]))
def test_gross_from_net_matches_fixture(case):
    assert gross_from_net(case["net"], M) == Decimal(case["gross"])


def test_round_trip_property():
    for n in range(0, 200_000, 7):
        assert net_from_gross(gross_from_net(n, M), M) == n


def test_half_up_boundary():
    assert gross_from_net(50, M) == Decimal("60")  # 59.5 -> 60


def test_accepts_int_str_decimal():
    assert net_from_gross(1190, M) == net_from_gross("1190", M) == net_from_gross(Decimal("1190"), M)


def test_sale_price_from_gross_rounds_gross():
    assert sale_price_from_gross(Decimal("1190.4"), M) == SalePrice(net=Decimal("1000"), gross=Decimal("1190"))


def test_input_gross_wins_over_inconsistent_net():
    assert sale_price_from_input(gross=1450, net=5, multiplier=M) == SalePrice(Decimal("1218"), Decimal("1450"))


def test_input_net_only_round_trips():
    assert sale_price_from_input(net=1000, multiplier=M) == SalePrice(Decimal("1000"), Decimal("1190"))


def test_input_none():
    assert sale_price_from_input(multiplier=M) is None


@pytest.mark.django_db
def test_default_multiplier_reads_settings():
    from accounting.utils import get_vat_multiplier

    assert net_from_gross(1190) == net_from_gross(1190, get_vat_multiplier())
