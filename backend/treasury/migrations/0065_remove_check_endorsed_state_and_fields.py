"""
Migración 0065 — Schema: remoción del estado ENDORSED y los campos
endorsed_to / endorsement_movement del modelo Check (y de la tabla
histórica HistoricalCheck).

Aplica el ADR-0039. La data migration previa (0064) ya movió cualquier
cheque ENDORSED a IN_PORTFOLIO; aquí se elimina la columna y se ajusta
el choices del campo status.

Sobre HistoricalCheck: los registros con status='ENDORSSED' en la tabla
histórica se preservan (django-simple-history es append-only). El campo
status sigue aceptando cualquier string en lecturas, solo cambia la
validación a nivel de modelo para el modelo principal Check.
"""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("treasury", "0064_data_migrate_endorsed_checks_to_portfolio"),
    ]

    operations = [
        # 1. Quitar el estado ENDORSED de las choices del modelo principal
        #    y de la tabla histórica (la fila de 'ENDORSSED' con typo se va
        #    también, ya nunca fue correcta).
        migrations.AlterField(
            model_name="check",
            name="status",
            field=models.CharField(
                choices=[
                    ("IN_PORTFOLIO", "En Cartera"),
                    ("DEPOSITED", "Depositado (En Tránsito)"),
                    ("CLEARED", "Cobrado / Liquidado"),
                    ("BOUNCED", "Protestado / Rechazado"),
                    ("VOIDED", "Anulado"),
                    ("ISSUED", "Girado (Pendiente de Cobro)"),
                ],
                default="IN_PORTFOLIO",
                max_length=15,
                verbose_name="Estado",
            ),
        ),
        migrations.AlterField(
            model_name="historicalcheck",
            name="status",
            field=models.CharField(
                choices=[
                    ("IN_PORTFOLIO", "En Cartera"),
                    ("DEPOSITED", "Depositado (En Tránsito)"),
                    ("CLEARED", "Cobrado / Liquidado"),
                    ("BOUNCED", "Protestado / Rechazado"),
                    ("VOIDED", "Anulado"),
                    ("ISSUED", "Girado (Pendiente de Cobro)"),
                ],
                default="IN_PORTFOLIO",
                max_length=15,
                verbose_name="Estado",
            ),
        ),
        # 2. Quitar las FK/OneToOne del endoso del modelo principal y de
        #    la tabla histórica. Los campos restantes del modelo
        #    (checkbook, payment_account, issued_check_account) se conservan
        #    porque pertenecen al flujo de cheques propios (ADR-0035
        #    sección "Cheques propios girados", no afectada por ADR-0039).
        migrations.RemoveField(
            model_name="check",
            name="endorsed_to",
        ),
        migrations.RemoveField(
            model_name="check",
            name="endorsement_movement",
        ),
        migrations.RemoveField(
            model_name="historicalcheck",
            name="endorsed_to",
        ),
        migrations.RemoveField(
            model_name="historicalcheck",
            name="endorsement_movement",
        ),
    ]
