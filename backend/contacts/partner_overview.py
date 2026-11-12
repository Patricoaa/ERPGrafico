"""Resumen de la ficha de un socio: alertas, KPIs, datos y composición del patrimonio.

Solo lectura. Reutiliza `_partner_metrics_map` (una consulta agrupada), sin fórmulas nuevas.
"""

from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError

from .models import Contact
from .selectors import _partner_metrics_map

ZERO = Decimal("0")

# (código, métrica, pestaña destino, acción sugerida)
_ALERTS = (
    ("excess_capital", "partner_excess_capital", "capital", "subscription"),
    ("pending_capital", "partner_pending_capital", "capital", "contribution"),
    ("dividends_payable", "partner_dividends_payable_balance", "capital", "dividend"),
    ("retained_earnings", "partner_earnings_balance", "capital", "mobilize"),
)


def build_partner_overview(contact: Contact) -> dict:
    if not contact.is_partner:
        raise ValidationError("El contacto no es un socio.")
    m = _partner_metrics_map([contact.id]).get(contact.id, {})

    def amount(key: str) -> Decimal:
        return m.get(key, ZERO)

    alerts = [
        {
            "code": code,
            "severity": "warning" if code in ("pending_capital", "dividends_payable") else "info",
            "amount": str(amount(key)),
            "target_tab": tab,
            "action": action,
        }
        for code, key, tab, action in _ALERTS
        if amount(key) > 0
    ]
    percentage = contact.partner_equity_percentage
    return {
        "alerts": alerts,
        "kpis": {
            "equity_percentage": str(percentage if percentage is not None else ZERO),
            "total_contributions": str(amount("partner_total_contributions")),
            "total_paid_in": str(amount("partner_total_paid_in")),
            "pending_capital": str(amount("partner_pending_capital")),
            "excess_capital": str(amount("partner_excess_capital")),
            "net_equity": str(amount("partner_net_equity")),
        },
        "info": {
            "partner_since": contact.partner_since.isoformat() if contact.partner_since else None,
            "tax_id": contact.tax_id or "",
            "contact_id": contact.id,
        },
        "composition": {
            "capital": str(amount("partner_total_paid_in")),
            "earnings_balance": str(amount("partner_earnings_balance")),
            "dividends_payable": str(amount("partner_dividends_payable_balance")),
            "provisional_withdrawals": str(amount("partner_provisional_withdrawals_balance")),
        },
    }
