# Generated manually — removed default_tax_rate (field was a duplicate
# of default_vat_rate, same purpose and default). All consumers migrated
# to read default_vat_rate instead.

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("accounting", "0030_remove_obsolete_settings_fields"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="accountingsettings",
            name="default_tax_rate",
        ),
    ]
