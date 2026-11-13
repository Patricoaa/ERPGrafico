"""Normalizador de reportes TUU: une A (sucursal tarjeta), B (sucursal efectivo)
y C (general) en un registro por venta. Función pura, sin ORM."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

SANTIAGO = ZoneInfo("America/Santiago")
SOURCE_BRANCH = "BRANCH"
SOURCE_GENERAL = "GENERAL"

_CONTROL_CHARS = re.compile(r"[\x00-\x1f]")
_PAYMENT_TYPES = {"CASH", "DEBIT", "CREDIT", "PREPAID"}
_NO_SETTLEMENT = {"0", "No reconciliation"}


@dataclass
class NormalizedSale:
    natural_key: str
    serial_number: str
    sale_id: str
    sequence_number: str | None
    location_id: str
    transaction_at: datetime
    status: str
    raw_status: str
    payment_type: str
    document_type: int | None
    instance: int | None
    card_brand: str
    card_bin: str
    card_issuer: str
    card_origin: str
    installment_type: str | None
    installment_count: int | None
    acquirer_id: str | None
    currency: str
    sale_amount: Decimal
    tip_amount: Decimal
    cashback_amount: Decimal
    total_amount: Decimal
    commission_amount: Decimal | None
    net_amount: Decimal | None
    settlement_date: date | None
    settlement_id: str | None
    settlement_amount: Decimal | None
    reconciliations: list[dict] = field(default_factory=list)
    items: list[dict] = field(default_factory=list)
    raw: dict = field(default_factory=dict)
    sources: list[str] = field(default_factory=list)


def _clean(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str) and value.strip() in ("", "N/A"):
        return None
    return value


def _text(value: Any) -> str | None:
    value = _clean(value)
    return None if value is None else str(value)


def _dec(value: Any) -> Decimal | None:
    value = _clean(value)
    return None if value is None else Decimal(str(value))


def _int(value: Any) -> int | None:
    value = _clean(value)
    return None if value is None else int(value)


def _first(*values: Any) -> Any:
    for value in values:
        if value is not None:
            return value
    return None


def _status(raw: str | None) -> str:
    return {"completed": "COMPLETED", "reversed": "REVERSED"}.get((raw or "").lower(), "OTHER")


def _payment_type(branch: dict | None, general: dict | None) -> str:
    for row, key in ((branch, "transactionType"), (general, "typeTransaction")):
        value = (_text((row or {}).get(key)) or "").upper()
        if value in _PAYMENT_TYPES:
            return value
    return "UNKNOWN"


def _aware(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    return parsed.replace(tzinfo=SANTIAGO) if parsed.tzinfo is None else parsed


def _items(raw_items: list[dict] | None) -> list[dict]:
    result = []
    for item in raw_items or []:
        result.append(
            {
                **item,
                "name": _CONTROL_CHARS.sub("", str(item.get("name") or "")),
                "code": _text(item.get("code")),
            }
        )
    return result


def _is_cash_general(row: dict) -> bool:
    return str(row.get("typeTransaction") or "").upper() == "CASH"


def _index(rows: list[dict], key_fn) -> dict[str, dict]:
    return {key_fn(row): row for row in rows}  # última ocurrencia gana


def _build(key: str, branch: dict | None, general: dict | None) -> NormalizedSale:
    b, g = branch or {}, general or {}
    extra = g.get("extraData") or {}
    recs = g.get("reconciliations") or []
    first_rec = recs[0] if recs else {}
    settlement_id = _text(first_rec.get("reconciliationId"))
    if settlement_id in _NO_SETTLEMENT:
        settlement_id = None
    pay_date = _text(first_rec.get("paymentDate"))
    raw_status = _text(b.get("status")) or _text(g.get("status")) or ""
    total = _dec(b.get("totalAmount"))
    if total is None:
        total = _dec(g.get("amount")) or Decimal("0")
    zero = Decimal("0")
    return NormalizedSale(
        natural_key=key,
        serial_number=_text(b.get("serialNumber")) or _text(g.get("posSerialNumber")) or "",
        sale_id=_text(b.get("saleId")) or _text(g.get("saleId")) or "",
        sequence_number=_text(b.get("sequenceNumber")) or _text(g.get("sequenceNumber")),
        location_id=_text(b.get("locationId")) or "",
        transaction_at=_aware(b.get("transactionDateTime") or g.get("paymentDataTime")),
        status=_status(raw_status),
        raw_status=raw_status,
        payment_type=_payment_type(branch, general),
        document_type=_int(b.get("documentType")),
        instance=_int(b.get("instance")),
        card_brand=_text(b.get("cardBrand")) or "",
        card_bin=_text(b.get("cardBin")) or "",
        card_issuer=_text(b.get("cardIssuer")) or "",
        card_origin=_text(b.get("cardOrigin")) or "",
        installment_type=_text(b.get("installmentType")),
        installment_count=_int(b.get("installmentCount")),
        acquirer_id=_text(b.get("acquirerId")),
        currency=_text(b.get("currencyCode")) or _text(g.get("currency")) or "CLP",
        sale_amount=_first(_dec(b.get("saleAmount")), _dec(g.get("amount")), zero),
        tip_amount=_dec(b.get("tipAmount")) or zero,
        cashback_amount=_dec(b.get("cashbackAmount")) or zero,
        total_amount=total,
        commission_amount=_dec(extra.get("amountCommission")),
        net_amount=_dec(extra.get("amountWithoutCommission")),
        settlement_date=date.fromisoformat(pay_date[:10]) if pay_date else None,
        settlement_id=settlement_id,
        settlement_amount=_dec(first_rec.get("amount")),
        reconciliations=list(recs),
        items=_items(b.get("items") if branch else extra.get("items")),
        raw={"branch": branch, "general": general},
        sources=[s for s, row in ((SOURCE_BRANCH, branch), (SOURCE_GENERAL, general)) if row],
    )


def build_sales(
    branch_card: list[dict], branch_cash: list[dict], general: list[dict]
) -> list[NormalizedSale]:
    """Une los tres reportes por clave natural (`card:<sequence>` / `cash:<saleId>`)."""
    branch: dict[str, dict] = {}
    branch.update(_index(branch_card, lambda r: f"card:{r.get('sequenceNumber')}"))
    branch.update(_index(branch_cash, lambda r: f"cash:{r.get('saleId')}"))
    gen = _index(
        general,
        lambda r: (
            f"cash:{r.get('saleId')}" if _is_cash_general(r) else f"card:{r.get('sequenceNumber')}"
        ),
    )
    keys = list(branch) + [k for k in gen if k not in branch]
    return [_build(k, branch.get(k), gen.get(k)) for k in keys]
