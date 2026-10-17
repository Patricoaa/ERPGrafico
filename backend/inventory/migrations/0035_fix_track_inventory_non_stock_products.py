from django.db import migrations


def fix_track_inventory(apps, schema_editor):
    """
    SERVICE, SUBSCRIPTION and CONSUMABLE products never track physical inventory
    (their strategy.allows_stock_moves is False). Correct stale track_inventory=True
    values so the field matches the strategy contract, and zero-out any Stock records
    that were incorrectly created for them.
    """
    Product = apps.get_model("inventory", "Product")
    Stock = apps.get_model("inventory", "Stock")
    non_stock_types = ("SERVICE", "SUBSCRIPTION", "CONSUMABLE")

    updated = Product.objects.filter(
        product_type__in=non_stock_types,
        track_inventory=True,
    ).update(track_inventory=False)
    if updated:
        print(f"\n  Fixed track_inventory on {updated} product(s) of type SERVICE/SUBSCRIPTION/CONSUMABLE.")

    # Zero-out Stock records for these products — they should never have stock.
    bad_stocks = Stock.objects.filter(
        product__product_type__in=non_stock_types,
    ).exclude(quantity=0, reserved_quantity=0)
    zeroed = bad_stocks.update(quantity=0, reserved_quantity=0)
    if zeroed:
        print(f"  Zeroed Stock on {zeroed} record(s) for non-trackable products.")


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0034_stockmove_source_document"),
    ]

    operations = [
        migrations.RunPython(fix_track_inventory, migrations.RunPython.noop),
    ]
