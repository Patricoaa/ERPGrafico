"""Aritmética de IVA centralizada (ADR-0151).

El precio bruto es la autoridad única del precio de venta; el neto se deriva
con ``net_from_gross``. Redondeo ROUND_HALF_UP al peso entero. La paridad con
el frontend se verifica con ``shared/vat-rounding-cases.json``.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal


def _dec(value) -> Decimal:
    """Convierte int/str/Decimal (y float vía str, sin arrastrar ruido binario)."""
    return value if isinstance(value, Decimal) else Decimal(str(value))


def _multiplier(rate_multiplier: Decimal | None) -> Decimal:
    if rate_multiplier is not None:
        return rate_multiplier
    from accounting.utils import get_vat_multiplier

    return get_vat_multiplier()


def _peso(value: Decimal) -> Decimal:
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def gross_from_net(net, multiplier: Decimal | None = None) -> Decimal:
    return _peso(_dec(net) * _multiplier(multiplier))


def net_from_gross(gross, multiplier: Decimal | None = None) -> Decimal:
    return _peso(_dec(gross) / _multiplier(multiplier))


@dataclass(frozen=True)
class SalePrice:
    net: Decimal
    gross: Decimal


def sale_price_from_gross(gross, multiplier: Decimal | None = None) -> SalePrice:
    g = _peso(_dec(gross))
    return SalePrice(net=net_from_gross(g, multiplier), gross=g)


def sale_price_from_input(
    *, gross=None, net=None, multiplier: Decimal | None = None
) -> SalePrice | None:
    """Regla de escritura de ADR-0151: el bruto manda; el neto solo se usa si falta el bruto."""
    if gross is not None:
        return sale_price_from_gross(gross, multiplier)
    if net is not None:
        return sale_price_from_gross(gross_from_net(net, multiplier), multiplier)
    return None
