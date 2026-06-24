from decimal import Decimal

from django.db import migrations, models


def auto_create_credit_lines(apps, schema_editor):
    Bank = apps.get_model("treasury", "Bank")
    BankLoan = apps.get_model("treasury", "BankLoan")
    CreditLine = apps.get_model("treasury", "CreditLine")
    db_alias = schema_editor.connection.alias

    for bank in Bank.objects.using(db_alias).all():
        active_loans = (
            BankLoan.objects.using(db_alias)
            .filter(
                lender=bank,
            )
            .exclude(
                status__in=["DRAFT", "PAID"],
            )
        )
        total = active_loans.aggregate(total=models.Sum("principal"))["total"]
        if not total or total <= 0:
            continue

        # Crear una línea con el 120% del total dispuesto como margen
        approved = (total * Decimal("1.2")).quantize(Decimal("0.01"))
        currency = active_loans.first().currency

        # Determinar fechas
        first_loan = active_loans.order_by("start_date").first()
        min_date = first_loan.start_date if first_loan else None
        from django.utils import timezone

        cl = CreditLine.objects.using(db_alias).create(
            bank=bank,
            code=f"Auto-{bank.id}",
            credit_line_type="REVOLVING",
            currency=currency,
            approved_amount=approved,
            valid_from=min_date or timezone.now().date(),
            status="ACTIVE",
        )
        # Asociar préstamos existentes a la línea
        active_loans.update(credit_line=cl)


class Migration(migrations.Migration):
    dependencies = [
        ("treasury", "0084_creditline_model"),
    ]

    operations = [
        migrations.RunPython(auto_create_credit_lines, reverse_code=migrations.RunPython.noop),
    ]
