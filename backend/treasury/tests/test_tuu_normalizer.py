import json
from datetime import date
from decimal import Decimal
from pathlib import Path

from treasury.integrations.tuu_normalizer import build_sales

FIXTURES = Path(__file__).parent / "fixtures" / "tuu"


def _load(prefix, pages, path):
    rows = []
    for page in pages:
        body = json.loads((FIXTURES / f"{prefix}_p{page}.json").read_text())
        for part in path:
            body = body[part]
        rows += body
    return rows


def _fixture_sales():
    return build_sales(
        _load("branch_card", (1, 2), ("data", "transactions")),
        _load("branch_cash", (1, 2), ("data", "transactions")),
        _load("general", (1, 2, 3), ("content", "reports")),
    )


def _by_key(sales):
    return {s.natural_key: s for s in sales}


def _c(**over):
    row = {
        "saleId": "N/A",
        "sequenceNumber": "700000000001",
        "posSerialNumber": "",
        "status": "Completed",
        "amount": 3200.0,
        "currency": "CLP",
        "typeTransaction": "DEBIT",
        "paymentDataTime": "2026-10-26T18:22:10",
        "extraData": {"items": [], "amountCommission": 107.0, "amountWithoutCommission": 3093.0},
        "reconciliations": [
            {
                "paymentDate": "2026-10-27",
                "installmentNumber": 1,
                "amount": 3200,
                "reconciliationId": "19720426",
            }
        ],
    }
    row.update(over)
    return row


def _a(**over):
    row = {
        "locationId": "",
        "saleId": "1",
        "sequenceNumber": "700000000001",
        "serialNumber": "SER1",
        "status": "completed",
        "transactionDateTime": "2026-10-26T18:22:10",
        "transactionType": "DEBIT",
        "documentType": 39,
        "cardBrand": "VISA",
        "cardBin": "123456",
        "cardOrigin": "Nacional",
        "cardIssuer": "N/A",
        "currencyCode": "CLP",
        "saleAmount": 3200,
        "tipAmount": 0,
        "cashbackAmount": 0,
        "totalAmount": 3200,
        "installmentType": "N/A",
        "installmentCount": 0,
        "acquirerId": "N/A",
        "instance": 1,
        "items": [{"code": None, "name": "\u0002Nombre ítem 1", "quantity": 1, "price": 3200}],
    }
    row.update(over)
    return row


def test_build_sales_joins_all_three():
    sales = _fixture_sales()
    assert len(sales) == 47
    assert all(s.sources == ["BRANCH", "GENERAL"] for s in sales)


def test_card_sale_fields():
    sale = _by_key(_fixture_sales())["card:900084836119"]
    assert sale.payment_type == "PREPAID"
    assert sale.document_type == 33
    assert sale.card_issuer == "MERCADO_PAGO"
    assert sale.total_amount == Decimal("20000")
    assert sale.commission_amount is not None


def test_cash_sale_fields():
    sales = _fixture_sales()
    cash = next(s for s in sales if s.natural_key.startswith("cash:"))
    assert cash.payment_type == "CASH"
    assert cash.document_type == 39
    assert cash.sequence_number is None
    assert cash.settlement_id is None


def test_settlement_zero_is_null():
    rec = {
        "paymentDate": "2026-10-27",
        "installmentNumber": 1,
        "amount": 3200,
        "reconciliationId": "0",
    }
    (sale,) = build_sales([], [], [_c(reconciliations=[rec])])
    assert sale.settlement_id is None
    assert sale.settlement_date == date(2026, 10, 27)


def test_item_name_strips_control_chars():
    (sale,) = build_sales([_a()], [], [])
    assert sale.items[0]["name"] == "Nombre ítem 1"
    assert sale.items[0]["code"] is None


def test_status_and_type_case_normalized():
    (sale,) = build_sales([_a(transactionType="debit", status="Completed")], [], [])
    assert sale.payment_type == "DEBIT"
    assert sale.status == "COMPLETED"
    assert sale.raw_status == "Completed"
    (other,) = build_sales([_a(status="weird")], [], [])
    assert other.status == "OTHER"


def test_empty_transaction_type_falls_back_to_general():
    (sale,) = build_sales([_a(transactionType="")], [], [_c()])
    assert sale.natural_key == "card:700000000001"
    assert sale.payment_type == "DEBIT"


def test_build_sales_keeps_orphans_from_each_side():
    only_a = _a(sequenceNumber="111")
    only_c = _c(sequenceNumber="222")
    sales = _by_key(build_sales([only_a], [], [only_c]))
    assert sales["card:111"].sources == ["BRANCH"]
    assert sales["card:111"].commission_amount is None
    assert sales["card:222"].sources == ["GENERAL"]
    assert sales["card:222"].document_type is None


def test_transaction_at_is_santiago_aware():
    (sale,) = build_sales([_a()], [], [])
    assert sale.transaction_at.tzinfo is not None
    assert (
        sale.transaction_at.utcoffset().total_seconds() == -3 * 3600
    )  # octubre: horario de verano
    assert sale.transaction_at.hour == 18
