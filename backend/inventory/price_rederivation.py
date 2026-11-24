"""Re-derivación masiva de netos de precio de venta desde el bruto (ADR-0151).

Módulo independiente para que lo compartan la migración de datos (modelos
históricos) y el comando ``audit_sale_prices`` (modelos reales). No importa
modelos: recibe las clases. Usa ``bulk_update``, que omite ``save()`` y
django-simple-history (aceptable: es una corrección de datos derivados).
"""

from dataclasses import dataclass, field
from decimal import Decimal

from accounting.vat import gross_from_net, net_from_gross, sale_price_from_input

BATCH_SIZE = 500
SAMPLE_LIMIT = 20

# (campo neto, campo bruto)
PRICE_PAIRS = {
    "Product": ("sale_price", "sale_price_gross"),
    "PricingRule": ("fixed_price", "fixed_price_gross"),
    "ProductUoMPrice": ("price_net", "price_gross"),
}
SURCHARGE_PAIR = ("price_surcharge", "price_surcharge_gross")


@dataclass
class ModelSummary:
    scanned: int = 0
    changed: int = 0
    samples: list = field(default_factory=list)  # (id, antes, después)


def _rederive_price(obj, net_f: str, gross_f: str, multiplier: Decimal) -> None:
    price = sale_price_from_input(
        gross=getattr(obj, gross_f) or None,
        net=getattr(obj, net_f) or None,
        multiplier=multiplier,
    )
    if price is not None:
        setattr(obj, net_f, price.net)
        setattr(obj, gross_f, price.gross)


def _rederive_surcharge(obj, multiplier: Decimal) -> None:
    net_f, gross_f = SURCHARGE_PAIR
    net, gross = getattr(obj, net_f), getattr(obj, gross_f)
    if gross is None and net is not None:
        gross = gross_from_net(net, multiplier)
    if gross is not None:
        setattr(obj, gross_f, gross)
        setattr(obj, net_f, net_from_gross(gross, multiplier))


def _rederive_model(model, multiplier: Decimal, apply: bool) -> ModelSummary:
    is_product = model.__name__ == "Product"
    price_pair = PRICE_PAIRS[model.__name__]
    fields = list(price_pair) + (list(SURCHARGE_PAIR) if is_product else [])
    summary = ModelSummary()
    pending = []

    def flush():
        if apply and pending:
            model.objects.bulk_update(pending, fields, batch_size=BATCH_SIZE)
        pending.clear()

    for obj in model.objects.only("pk", *fields).iterator(chunk_size=BATCH_SIZE):
        summary.scanned += 1
        before = tuple(getattr(obj, f) for f in fields)
        _rederive_price(obj, *price_pair, multiplier)
        if is_product:
            _rederive_surcharge(obj, multiplier)
        after = tuple(getattr(obj, f) for f in fields)
        if before == after:
            continue
        summary.changed += 1
        if len(summary.samples) < SAMPLE_LIMIT:
            summary.samples.append((obj.pk, dict(zip(fields, before)), dict(zip(fields, after))))
        pending.append(obj)
        if len(pending) >= BATCH_SIZE:
            flush()
    flush()
    return summary


def rederive_sale_prices(*, product, pricing_rule, uom_price, multiplier: Decimal, apply: bool) -> dict:
    """Recalcula netos desde el bruto. Con ``apply=False`` no escribe nada."""
    return {
        model.__name__: _rederive_model(model, multiplier, apply)
        for model in (product, pricing_rule, uom_price)
    }
