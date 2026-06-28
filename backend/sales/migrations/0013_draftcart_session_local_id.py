from django.db import migrations, models


def backfill_session_local_id(apps, schema_editor):
    DraftCart = apps.get_model("sales", "DraftCart")

    session_ids = (
        DraftCart.objects.values_list("pos_session_id", flat=True)
        .distinct()
        .order_by()
    )

    for session_id in session_ids:
        drafts = list(
            DraftCart.objects.filter(pos_session_id=session_id).order_by("id")
        )
        for i, draft in enumerate(drafts, start=1):
            draft.session_local_id = i
        DraftCart.objects.bulk_update(drafts, ["session_local_id"])


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0012_historicalsaleorder_payment_method_add_check"),
    ]

    operations = [
        migrations.AddField(
            model_name="draftcart",
            name="session_local_id",
            field=models.IntegerField(
                null=True,
                verbose_name="N° Borrador",
                help_text="Número secuencial del borrador dentro de la sesión POS",
            ),
        ),
        migrations.RunPython(backfill_session_local_id, reverse_code=migrations.RunPython.noop),
        migrations.AlterField(
            model_name="draftcart",
            name="session_local_id",
            field=models.IntegerField(
                default=0,
                verbose_name="N° Borrador",
                help_text="Número secuencial del borrador dentro de la sesión POS",
            ),
        ),
        migrations.AddConstraint(
            model_name="draftcart",
            constraint=models.UniqueConstraint(
                fields=["pos_session", "session_local_id"],
                name="unique_draft_per_session",
            ),
        ),
    ]
