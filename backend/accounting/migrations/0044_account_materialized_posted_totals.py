from decimal import Decimal

from django.db import migrations, models
from django.db.models import Count, Sum

BALANCE_STATUSES = ["POSTED", "CLOSED", "REVERSAL"]


def backfill(apps, schema_editor):
    Account = apps.get_model("accounting", "Account")
    JournalItem = apps.get_model("accounting", "JournalItem")
    rows = (
        JournalItem.objects.filter(entry__status__in=BALANCE_STATUSES)
        .order_by()
        .values("account_id")
        .annotate(debit=Sum("debit"), credit=Sum("credit"), items=Count("id"))
    )
    for row in rows:
        Account.objects.filter(pk=row["account_id"]).update(
            posted_debit_total=row["debit"] or 0,
            posted_credit_total=row["credit"] or 0,
            posted_items_count=row["items"],
        )


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0043_terminal_cobro_labels"),
    ]

    operations = [
        migrations.AddField(
            model_name="account",
            name="posted_debit_total",
            field=models.DecimalField(
                decimal_places=0, default=Decimal("0"), editable=False, max_digits=20,
                verbose_name="Debe contabilizado",
            ),
        ),
        migrations.AddField(
            model_name="account",
            name="posted_credit_total",
            field=models.DecimalField(
                decimal_places=0, default=Decimal("0"), editable=False, max_digits=20,
                verbose_name="Haber contabilizado",
            ),
        ),
        migrations.AddField(
            model_name="account",
            name="posted_items_count",
            field=models.PositiveIntegerField(
                default=0, editable=False, verbose_name="Movimientos contabilizados"
            ),
        ),
        migrations.AddField(
            model_name="historicalaccount",
            name="posted_debit_total",
            field=models.DecimalField(
                decimal_places=0, default=Decimal("0"), editable=False, max_digits=20,
                verbose_name="Debe contabilizado",
            ),
        ),
        migrations.AddField(
            model_name="historicalaccount",
            name="posted_credit_total",
            field=models.DecimalField(
                decimal_places=0, default=Decimal("0"), editable=False, max_digits=20,
                verbose_name="Haber contabilizado",
            ),
        ),
        migrations.AddField(
            model_name="historicalaccount",
            name="posted_items_count",
            field=models.PositiveIntegerField(
                default=0, editable=False, verbose_name="Movimientos contabilizados"
            ),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
