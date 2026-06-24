from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("treasury", "0076_cardpendingcharge"),
    ]

    operations = [
        migrations.AddField(
            model_name="historicaltreasurymovement",
            name="status",
            field=models.CharField(
                choices=[
                    ("DRAFT", "Borrador"),
                    ("POSTED", "Contabilizado"),
                    ("CANCELLED", "Anulado"),
                ],
                default="DRAFT",
                max_length=20,
                verbose_name="Estado",
                help_text="Estado del movimiento: Borrador, Contabilizado o Anulado.",
            ),
        ),
        migrations.AddField(
            model_name="treasurymovement",
            name="status",
            field=models.CharField(
                choices=[
                    ("DRAFT", "Borrador"),
                    ("POSTED", "Contabilizado"),
                    ("CANCELLED", "Anulado"),
                ],
                default="DRAFT",
                max_length=20,
                verbose_name="Estado",
                help_text="Estado del movimiento: Borrador, Contabilizado o Anulado.",
            ),
        ),
    ]
