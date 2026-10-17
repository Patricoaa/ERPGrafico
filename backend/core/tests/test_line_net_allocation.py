"""ADR-0083: neto por línea de documentos gross-first (ficha documental)."""

from decimal import Decimal
from types import SimpleNamespace

from core.strategies.totals import allocate_line_nets


def _doc(total_net):
    return SimpleNamespace(total_net=Decimal(total_net))


def _line(pk, subtotal):
    return SimpleNamespace(pk=pk, subtotal=Decimal(subtotal))


def test_nets_sum_exactly_to_document_net():
    lines = [_line(1, "75000"), _line(2, "10000"), _line(3, "333")]
    total_net = (Decimal("85333") / Decimal("1.19")).quantize(Decimal("1"))
    nets = allocate_line_nets(_doc(total_net), lines)
    assert sum(nets.values()) == total_net
    assert nets[1] == Decimal("63025") or abs(nets[1] - Decimal("63025")) <= 1


def test_single_line_takes_whole_net_including_global_discount():
    nets = allocate_line_nets(_doc("50000"), [_line(1, "75000")])
    assert nets == {1: Decimal("50000")}


def test_empty_or_zero_gross():
    assert allocate_line_nets(_doc("0"), []) == {}
    assert allocate_line_nets(_doc("0"), [_line(1, "0")]) == {1: Decimal("0")}
