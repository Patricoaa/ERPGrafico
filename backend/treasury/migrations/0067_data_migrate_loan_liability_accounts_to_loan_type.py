"""
Migración 0067 — Data migration: cuentas-pasivo de préstamos CREDIT_CARD → LOAN.

Aplica el ADR-0041 (tipo de tesorería dedicado para préstamos). Antes, la
`liability_account` de un `BankLoan` se forzaba al tipo `CREDIT_CARD` —el
único con `AccountType=LIABILITY` en la taxonomía vigente (ADR-0033)—, lo que
hacía que la deuda de un préstamo se contara y mostrara como una tarjeta de
crédito en el Centro de Bancos.

Esta migración reclasifica al tipo `LOAN` toda `TreasuryAccount` que esté
siendo usada como `liability_account` de algún `BankLoan` (reverse FK
`loans_as_liability`). La identificación es inequívoca: solo cuentas de
préstamos cambian; las tarjetas de crédito reales se quedan en `CREDIT_CARD`.

Idempotente: re-corrida no hace nada (filtra por el tipo de origen).
Reverso: vuelve a `CREDIT_CARD` (mismo criterio inverso).
"""
from django.db import migrations


def credit_card_to_loan(apps, schema_editor):
    TreasuryAccount = apps.get_model('treasury', 'TreasuryAccount')
    BankLoan = apps.get_model('treasury', 'BankLoan')

    liability_ids = (
        BankLoan.objects.values_list('liability_account_id', flat=True).distinct()
    )
    TreasuryAccount.objects.filter(
        id__in=list(liability_ids),
        account_type='CREDIT_CARD',
    ).update(account_type='LOAN')


def loan_to_credit_card(apps, schema_editor):
    TreasuryAccount = apps.get_model('treasury', 'TreasuryAccount')
    BankLoan = apps.get_model('treasury', 'BankLoan')

    liability_ids = (
        BankLoan.objects.values_list('liability_account_id', flat=True).distinct()
    )
    TreasuryAccount.objects.filter(
        id__in=list(liability_ids),
        account_type='LOAN',
    ).update(account_type='CREDIT_CARD')


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0066_loan_treasury_account_type'),
    ]

    operations = [
        migrations.RunPython(credit_card_to_loan, loan_to_credit_card),
    ]
