from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Adds ``bank_provisioned`` flag to TreasuryAccount and PaymentMethod.

    Set to True by the bank creation wizard to mark records it auto-provisioned
    so the UI can block manual edit/delete of those records.
    """

    dependencies = [
        ("treasury", "0055_treasury_account_account_nullable"),
    ]

    operations = [
        migrations.AddField(
            model_name="treasuryaccount",
            name="bank_provisioned",
            field=models.BooleanField(default=False, verbose_name="Provisionada por banco"),
        ),
        migrations.AddField(
            model_name="historicaltreasuryaccount",
            name="bank_provisioned",
            field=models.BooleanField(default=False, verbose_name="Provisionada por banco"),
        ),
        migrations.AddField(
            model_name="paymentmethod",
            name="bank_provisioned",
            field=models.BooleanField(default=False, verbose_name="Provisionado por banco"),
        ),
        migrations.AddField(
            model_name="historicalpaymentmethod",
            name="bank_provisioned",
            field=models.BooleanField(default=False, verbose_name="Provisionado por banco"),
        ),
    ]
