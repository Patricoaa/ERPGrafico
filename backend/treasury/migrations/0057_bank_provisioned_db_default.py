from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Adds a database-level default to ``bank_provisioned`` so INSERTs that
    omit the column (e.g. when the field is not present in models.py) succeed
    against the NOT NULL constraint.

    The Python ``default`` is preserved. When the model field is reintroduced
    without ``db_default``, a follow-up migration will drop the DB default.
    """

    dependencies = [
        ("treasury", "0056_treasuryaccount_paymentmethod_bank_provisioned"),
    ]

    operations = [
        migrations.AlterField(
            model_name="treasuryaccount",
            name="bank_provisioned",
            field=models.BooleanField(
                db_default=False, default=False, verbose_name="Provisionada por banco"
            ),
        ),
        migrations.AlterField(
            model_name="historicaltreasuryaccount",
            name="bank_provisioned",
            field=models.BooleanField(
                db_default=False, default=False, verbose_name="Provisionada por banco"
            ),
        ),
        migrations.AlterField(
            model_name="paymentmethod",
            name="bank_provisioned",
            field=models.BooleanField(
                db_default=False, default=False, verbose_name="Provisionado por banco"
            ),
        ),
        migrations.AlterField(
            model_name="historicalpaymentmethod",
            name="bank_provisioned",
            field=models.BooleanField(
                db_default=False, default=False, verbose_name="Provisionado por banco"
            ),
        ),
    ]
