from decimal import Decimal

from billing.line_split import LineAmount, LineShare, split_lines, split_proportional

D = Decimal


def _lines():
    return [
        LineAmount(1, D("3"), D("10000")),
        LineAmount(2, D("1"), D("3333")),
        LineAmount(3, D("2"), D("1")),
    ]


def test_single_amount_is_identity():
    lines = _lines()
    result = split_lines(lines, [D("13334")])
    assert result == [[LineShare(ln.key, ln.quantity, ln.subtotal) for ln in lines]]


def test_rows_and_columns_sum_exactly():
    lines = _lines()
    result = split_lines(lines, [D("6000"), D("7334")])
    assert len(result) == 2
    for idx, line in enumerate(lines):
        shares = [portion[idx] for portion in result]
        assert all(s.key == line.key for s in shares)
        assert sum(s.subtotal for s in shares) == line.subtotal
        assert sum(s.quantity for s in shares) == line.quantity
    assert [sum(s.subtotal for s in portion) for portion in result] == [D("6000"), D("7334")]


def test_zero_subtotal_line_goes_to_first():
    lines = [LineAmount(1, D("5"), D("0")), LineAmount(2, D("1"), D("1000"))]
    result = split_lines(lines, [D("400"), D("600")])
    assert result[0][0] == LineShare(1, D("5"), D("0"))
    assert result[1][0] == LineShare(1, D("0"), D("0"))
    assert [sum(s.subtotal for s in p) for p in result] == [D("400"), D("600")]


def test_quantities_have_two_decimals():
    result = split_lines(_lines(), [D("3333"), D("3333"), D("6668")])
    for portion in result:
        for share in portion:
            assert share.quantity == share.quantity.quantize(D("0.01"))


def test_split_proportional_last_absorbs():
    assert split_proportional(D(1597), [D(6000), D(4000)]) == [D(958), D(639)]


def test_split_proportional_zero_sum_goes_to_first():
    assert split_proportional(D(10), [D(0), D(0)]) == [D(10), D(0)]
