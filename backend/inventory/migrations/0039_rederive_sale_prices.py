from decimal import Decimal

from django.db import migrations

from inventory.price_rederivation import rederive_sale_prices


def rederive(apps, schema_editor):
    AccountingSettings = apps.get_model("accounting", "AccountingSettings")
    row = AccountingSettings.objects.first()
    rate = row.default_vat_rate if row else Decimal("19.00")
    rederive_sale_prices(
        product=apps.get_model("inventory", "Product"),
        pricing_rule=apps.get_model("inventory", "PricingRule"),
        uom_price=apps.get_model("inventory", "ProductUoMPrice"),
        multiplier=Decimal("1") + rate / Decimal("100"),
        apply=True,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0038_product_price_surcharge_gross"),
        ("accounting", "0052_rcvimport_contacts_created_count"),
    ]

    operations = [migrations.RunPython(rederive, migrations.RunPython.noop)]
