from django.db import migrations

OLD, NEW = "hr.salary_advances", "hr.employee_movements"


def rename_bundle(apps, schema_editor):
    """Los roles guardan sus bundles en BD: el bundle de anticipos pasó a movimientos con el empleado (ADR-0156)."""
    GroupProfile = apps.get_model("core", "GroupProfile")
    for profile in GroupProfile.objects.all():
        if OLD not in profile.bundles:
            continue
        bundles = [NEW if key == OLD else key for key in profile.bundles]
        profile.bundles = list(dict.fromkeys(bundles))
        profile.save(update_fields=["bundles"])


class Migration(migrations.Migration):
    dependencies = [("core", "0018_remove_user_pos_pin")]

    operations = [migrations.RunPython(rename_bundle, migrations.RunPython.noop)]
