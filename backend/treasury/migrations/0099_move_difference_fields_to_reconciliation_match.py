from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    # DDL + data in same migration; must be non-atomic so each operation
    # commits before the next FK index is created.
    atomic = False

    dependencies = [
        ("treasury", "0098_terminal_cobro_labels"),
        ("accounting", "0001_initial"),
    ]

    operations = [
        # 1. Add fields to ReconciliationMatch
        migrations.AddField(
            model_name="reconciliationmatch",
            name="difference_amount",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                max_digits=20,
                verbose_name="Diferencia",
            ),
        ),
        migrations.AddField(
            model_name="reconciliationmatch",
            name="difference_reason",
            field=models.CharField(
                blank=True,
                help_text="COMMISSION, INTEREST, ERROR, etc.",
                max_length=50,
                verbose_name="Razón de Diferencia",
            ),
        ),
        migrations.AddField(
            model_name="reconciliationmatch",
            name="difference_journal_entry",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="reconciliation_match_adjustments",
                to="accounting.journalentry",
                verbose_name="Asiento de Ajuste",
            ),
        ),
        # 2. Data migration: aggregate difference from lines to group
        migrations.RunSQL(
            sql="""
            UPDATE treasury_reconciliationmatch rm
            SET
                difference_amount = agg.total_diff,
                difference_reason  = agg.reason
            FROM (
                SELECT
                    reconciliation_match_id,
                    SUM(difference_amount) AS total_diff,
                    MAX(difference_reason)  AS reason
                FROM treasury_bankstatementline
                WHERE reconciliation_match_id IS NOT NULL
                  AND difference_amount <> 0
                GROUP BY reconciliation_match_id
            ) agg
            WHERE rm.id = agg.reconciliation_match_id;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql="""
            UPDATE treasury_reconciliationmatch rm
            SET difference_journal_entry_id = (
                SELECT ln.difference_journal_entry_id
                FROM treasury_bankstatementline ln
                WHERE ln.reconciliation_match_id = rm.id
                  AND ln.difference_journal_entry_id IS NOT NULL
                ORDER BY ln.id
                LIMIT 1
            )
            WHERE EXISTS (
                SELECT 1 FROM treasury_bankstatementline ln2
                WHERE ln2.reconciliation_match_id = rm.id
                  AND ln2.difference_journal_entry_id IS NOT NULL
            );
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
        # 3. Remove fields from BankStatementLine
        migrations.RemoveField(
            model_name="bankstatementline",
            name="difference_amount",
        ),
        migrations.RemoveField(
            model_name="bankstatementline",
            name="difference_reason",
        ),
        migrations.RemoveField(
            model_name="bankstatementline",
            name="difference_journal_entry",
        ),
    ]
