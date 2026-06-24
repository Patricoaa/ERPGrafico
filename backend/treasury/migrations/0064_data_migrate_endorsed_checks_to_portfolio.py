"""
Migración 0064 — Data migration: cheques en estado ENDORSED vuelven a IN_PORTFOLIO.

Aplica el ADR-0039 (remoción del endoso). Cualquier Check con status en
{'ENDORSSED', 'ENDORSED'} (la primera con typo en el TextChoices original;
la segunda por si alguna inserción manual usó el valor correcto) vuelve
a IN_PORTFOLIO, dejando el cheque disponible para depósito/anulación
normales. No se tocan los campos endorsed_to / endorsement_movement — la
siguiente migración (0065) los elimina del schema.

Idempotente: re-corrida no hace nada si no quedan ENDORSED.
"""

from django.db import migrations


def migrate_endorsed_to_portfolio(apps, schema_editor):
    Check = apps.get_model("treasury", "Check")
    Check.objects.filter(
        status__in=["ENDORSSED", "ENDORSED"],
    ).update(status="IN_PORTFOLIO")


class Migration(migrations.Migration):
    dependencies = [
        ("treasury", "0063_remove_posterminal_allows_check"),
    ]

    operations = [
        migrations.RunPython(migrate_endorsed_to_portfolio, migrations.RunPython.noop),
    ]
