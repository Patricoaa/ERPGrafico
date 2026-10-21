from django.db import migrations, models


def backfill_status(apps, schema_editor):
    SalaryAdvance = apps.get_model("hr", "SalaryAdvance")
    SalaryAdvance.objects.filter(is_discounted=True).update(status="DISCOUNTED")
    SalaryAdvance.objects.filter(is_discounted=False, journal_entry__isnull=False).update(
        status="PAID"
    )


def restore_is_discounted(apps, schema_editor):
    SalaryAdvance = apps.get_model("hr", "SalaryAdvance")
    SalaryAdvance.objects.filter(status="DISCOUNTED").update(is_discounted=True)


class Migration(migrations.Migration):
    dependencies = [
        ("hr", "0011_payrollconcept_is_active"),
    ]

    operations = [
        migrations.AddField(
            model_name="salaryadvance",
            name="status",
            field=models.CharField(
                choices=[
                    ("DRAFT", "Borrador"),
                    ("PAID", "Pagado"),
                    ("DISCOUNTED", "Descontado"),
                    ("CANCELLED", "Anulado"),
                ],
                default="DRAFT",
                max_length=20,
                verbose_name="Estado",
            ),
        ),
        migrations.RunPython(backfill_status, restore_is_discounted),
        migrations.RemoveField(model_name="salaryadvance", name="is_discounted"),
        migrations.AlterField(
            model_name="salaryadvance",
            name="payroll",
            field=models.ForeignKey(
                blank=True,
                help_text="Liquidación (en borrador o contabilizada) que descuenta el anticipo.",
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="advances",
                to="hr.payroll",
                verbose_name="Liquidación Asociada",
            ),
        ),
    ]
