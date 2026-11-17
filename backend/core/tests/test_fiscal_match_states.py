import pytest

from core.fiscal_match import FiscalMatchStatus, PartState, derive_group_status


@pytest.mark.parametrize(
    "erp,tuu,rcv,has_invoice,excluded,expected",
    [
        ("MATCHED", "MATCHED", "MATCHED", True, False, "MATCHED"),
        ("MATCHED", "NOT_APPLICABLE", "SUMMARY_ONLY", True, False, "MATCHED"),
        ("MATCHED", "AMBIGUOUS", "DIFF", True, False, "AMBIGUOUS"),
        ("MATCHED", "DIFF", "PENDING", True, False, "DIFF"),
        ("MISSING", "MATCHED", "MATCHED", False, False, "MISSING_ERP"),
        ("MATCHED", "MISSING", "PENDING", True, False, "MISSING_EXTERNAL"),
        ("PENDING", "MATCHED", "PENDING", True, False, "PENDING"),
        ("MATCHED", "DIFF", "MATCHED", True, True, "EXCLUDED"),
    ],
)
def test_derive_group_status(erp, tuu, rcv, has_invoice, excluded, expected):
    assert derive_group_status(erp, tuu, rcv, has_invoice=has_invoice, excluded=excluded) == expected


def test_labels():
    assert PartState.NOT_APPLICABLE.label == "No aplica"
    assert PartState.SUMMARY_ONLY.label == "Solo resumen"
    assert FiscalMatchStatus.MISSING_EXTERNAL.label == "Falta en SII/TUU"
    assert FiscalMatchStatus.MISSING_ERP.label == "Falta en el ERP"
