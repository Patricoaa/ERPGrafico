# Generated manually — remove deprecated default_inventory_account field

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("accounting", "0025_standardize_is_active_archive_flag"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="accountingsettings",
            name="default_inventory_account",
        ),
    ]
