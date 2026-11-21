"""Re-deriva netos de precio de venta desde el bruto (ADR-0151).

Copia congelada y autocontenida de la lógica de ``accounting.vat`` e
``inventory.price_rederivation``: una migración no debe depender de código de la
app que pueda renombrarse o cambiar. ``test_rederive_sale_prices`` verifica la
paridad con el módulo de servicio.
"""

from decimal import ROUND_HALF_UP, Decimal

from django.db import migrations

BATCH_SIZE = 500

# (campo neto, campo bruto)
PRICE_PAIRS = {
    "Product": ("sale_price", "sale_price_gross"),
    "PricingRule": ("fixed_price", "fixed_price_gross"),
    "ProductUoMPrice": ("price_net", "price_gross"),
}
SURCHARGE_PAIR = ("price_surcharge", "price_surcharge_gross")


def _peso(value):
    return Decimal(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def _gross_from_net(net, multiplier):
    return _peso(Decimal(net) * multiplier)


def _net_from_gross(gross, multiplier):
    return _peso(Decimal(gross) / multiplier)


def _price_from_input(gross, net, multiplier):
    """El bruto manda; el neto solo se usa si falta el bruto. Devuelve (neto, bruto) o None."""
    if gross is None and net is None:
        return None
    g = _peso(gross) if gross is not None else _peso(_gross_from_net(net, multiplier))
    return _net_from_gross(g, multiplier), g


def _rederive_price(obj, net_f, gross_f, multiplier):
    price = _price_from_input(getattr(obj, gross_f) or None, getattr(obj, net_f) or None, multiplier)
    if price is not None:
        setattr(obj, net_f, price[0])
        setattr(obj, gross_f, price[1])


def _rederive_surcharge(obj, multiplier):
    net_f, gross_f = SURCHARGE_PAIR
    net, gross = getattr(obj, net_f), getattr(obj, gross_f)
    if gross is None and net is not None:
        gross = _gross_from_net(net, multiplier)
    if gross is not None:
        setattr(obj, gross_f, gross)
        setattr(obj, net_f, _net_from_gross(gross, multiplier))


def rederive_model(model, multiplier, apply=True):
    """Devuelve la cantidad de filas cambiadas."""
    is_product = model.__name__ == "Product"
    price_pair = PRICE_PAIRS[model.__name__]
    fields = list(price_pair) + (list(SURCHARGE_PAIR) if is_product else [])
    changed = 0
    pending = []
    for obj in model.objects.only("pk", *fields).iterator(chunk_size=BATCH_SIZE):
        before = tuple(getattr(obj, f) for f in fields)
        _rederive_price(obj, *price_pair, multiplier)
        if is_product:
            _rederive_surcharge(obj, multiplier)
        if before == tuple(getattr(obj, f) for f in fields):
            continue
        changed += 1
        pending.append(obj)
        if apply and len(pending) >= BATCH_SIZE:
            model.objects.bulk_update(pending, fields, batch_size=BATCH_SIZE)
            pending.clear()
    if apply and pending:
        model.objects.bulk_update(pending, fields, batch_size=BATCH_SIZE)
    return changed


def rederive(apps, schema_editor):
    AccountingSettings = apps.get_model("accounting", "AccountingSettings")
    row = AccountingSettings.objects.first()
    rate = row.default_vat_rate if row else Decimal("19.00")
    multiplier = Decimal("1") + rate / Decimal("100")
    for name in PRICE_PAIRS:
        rederive_model(apps.get_model("inventory", name), multiplier)


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0038_product_price_surcharge_gross"),
        ("accounting", "0052_rcvimport_contacts_created_count"),
    ]

    operations = [migrations.RunPython(rederive, migrations.RunPython.noop)]
