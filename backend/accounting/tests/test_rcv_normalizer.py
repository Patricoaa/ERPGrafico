import json
from datetime import date
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from accounting.integrations.rcv_normalizer import (
    RCVFormatError,
    is_valid_rut,
    normalize_report,
    normalize_rut,
)

FIXTURES = Path(__file__).parent / "fixtures"
CL = ZoneInfo("America/Santiago")


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_normalize_rut():
    assert normalize_rut("8.973.356-1") == "8973356-1"
    assert normalize_rut("77448566-k") == "77448566-K"
    assert normalize_rut(None) == ""
    assert is_valid_rut("8973356-1")
    assert is_valid_rut("89733561-1")
    assert not is_valid_rut("8973356-2")


def test_sales_report():
    report = normalize_report("SALES", _load("rcv_ventas_202610.json"))
    assert report.period == "202610"
    assert report.company_rut == "11111111-1"
    assert len(report.summaries) == 3
    s48 = next(s for s in report.summaries if s.dte_type == 48)
    assert s48.document_count == 401
    assert len(report.documents) == 4

    by_folio = {d.folio: d for d in report.documents}
    inv = by_folio[6446]
    assert inv.counterparty_name == "CLIENTE UNO SPA"
    assert inv.counterparty_rut == "77195849-4"
    assert inv.issue_date == date(2026, 10, 1)
    assert inv.received_at is not None and inv.received_at.tzinfo is not None
    assert (inv.received_at.hour, inv.received_at.minute, inv.received_at.second) == (10, 20, 34)
    assert inv.received_at.utcoffset() == inv.received_at.astimezone(CL).utcoffset()
    assert inv.vat_amount == Decimal("7983")
    assert inv.operation_type == "Del Giro"
    assert inv.dte_type_label == "Factura Electrónica"

    boleta = by_folio[72012]
    assert boleta.counterparty_name == ""
    assert boleta.received_at is None
    assert boleta.service_indicator == 3
    assert boleta.reference_dte_type is None
    assert boleta.other_taxes_total == Decimal("0")


def test_purchases_report():
    report = normalize_report("PURCHASES", _load("rcv_compras_202610.json"))
    assert len(report.summaries) == 1
    assert report.summaries[0].status == "Confirmada"
    assert len(report.documents) == 2
    by_folio = {d.folio: d for d in report.documents}
    first, second = by_folio[1204055], by_folio[1205605]
    assert first.dte_type == 33
    assert first.acknowledgement == "No reclamado en plazo"
    assert first.acknowledged_at is None
    assert second.acknowledged_at is not None and second.acknowledged_at.tzinfo is not None
    assert first.vat_recoverable == Decimal("8178")
    assert first.counterparty_rut == "78950040-1"
    assert first.status == "Confirmada"


def test_dash_and_empty_become_blank():
    report = normalize_report("SALES", _load("rcv_ventas_202610.json"))
    inv = next(d for d in report.documents if d.folio == 6446)
    assert inv.raw["rutEmisorLiqFactura"] == "-"
    assert inv.reference_folio == ""


def test_missing_section_raises():
    body = _load("rcv_ventas_202610.json")
    with pytest.raises(RCVFormatError):
        normalize_report("SALES", {"caratula": body["caratula"]})
    with pytest.raises(RCVFormatError):
        normalize_report("SALES", {"ventas": body["ventas"]})


def test_purchases_summaries_with_multiple_statuses_are_consolidated():
    body = {
        "caratula": {
            "rutEmpresa": "8973356-1",
            "periodo": "202611",
        },
        "compras": {
            "resumenes": [
                {
                    "tipoDte": 33,
                    "tipoDteString": "FACTURA ELECTRÓNICA",
                    "totalDocumentos": 10,
                    "montoExento": 640,
                    "montoNeto": 1129900,
                    "ivaRecuperable": 214682,
                    "ivaUsoComun": 0,
                    "ivaNoRecuperable": 0,
                    "montoTotal": 1345222,
                    "estado": "Confirmada",
                },
                {
                    "tipoDte": 33,
                    "tipoDteString": "FACTURA ELECTRÓNICA",
                    "totalDocumentos": 1,
                    "montoExento": 0,
                    "montoNeto": 278141,
                    "ivaRecuperable": 52847,
                    "ivaUsoComun": 0,
                    "ivaNoRecuperable": 0,
                    "montoTotal": 330988,
                    "estado": "Pendiente",
                },
                {
                    "tipoDte": 61,
                    "tipoDteString": "NOTA DE CRÉDITO ELECTRÓNICA",
                    "totalDocumentos": 2,
                    "montoExento": 0,
                    "montoNeto": 15109,
                    "ivaRecuperable": 2871,
                    "ivaUsoComun": 0,
                    "ivaNoRecuperable": 0,
                    "montoTotal": 17980,
                    "estado": "Confirmada",
                },
            ],
            "detalleCompras": [],
        },
    }
    report = normalize_report("PURCHASES", body)
    assert len(report.summaries) == 2
    by_type = {s.dte_type: s for s in report.summaries}

    s33 = by_type[33]
    assert s33.document_count == 11
    assert s33.exempt_amount == Decimal("640")
    assert s33.net_amount == Decimal("1408041")
    assert s33.vat_recoverable == Decimal("267529")
    assert s33.total_amount == Decimal("1676210")
    # Al tener estados distintos ("Confirmada" y "Pendiente"), queda vacío
    assert s33.status == ""

    s61 = by_type[61]
    assert s61.document_count == 2
    assert s61.total_amount == Decimal("17980")
    assert s61.status == "Confirmada"

