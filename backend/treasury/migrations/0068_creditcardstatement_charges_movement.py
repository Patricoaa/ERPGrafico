# Gap 1.4 (ADR-0037): FK `charges_movement` en CreditCardStatement.
#
# Antes la idempotencia de `apply_charges` se basaba en buscar
# ADJUSTMENTs con `reference=EST-<id>`. Eso era frágil ante cambios
# de `display_id` o reasignaciones. Este FK almacena el vínculo directo
# entre el statement y su movimiento de cargos, simétrico al
# `payment_movement` ya existente.
#
# La data migration backfillea el campo para statements existentes
# buscando el ADJUSTMENT con `reference=display_id` (criterio histórico).
import django.db.models.deletion
from django.db import migrations, models


def backfill_charges_movement(apps, schema_editor):
    CreditCardStatement = apps.get_model('treasury', 'CreditCardStatement')
    TreasuryMovement = apps.get_model('treasury', 'TreasuryMovement')

    for stmt in CreditCardStatement.objects.filter(charges_movement__isnull=True):
        display_id = f"EST-{stmt.id}"
        mv = TreasuryMovement.objects.filter(
            movement_type='ADJUSTMENT',
            reference=display_id,
            from_account=stmt.card_account_id,
        ).first()
        if mv is not None:
            stmt.charges_movement_id = mv.id
            stmt.save(update_fields=['charges_movement'])


def reverse_backfill(apps, schema_editor):
    # No-op: el campo FK se borra con la migración; el ADJUSTMENT no se toca.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0067_data_migrate_loan_liability_accounts_to_loan_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='creditcardstatement',
            name='charges_movement',
            field=models.OneToOneField(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='card_statement_charges',
                to='treasury.treasurymovement',
                verbose_name='Movimiento de Cargos',
                help_text=(
                    "ADJUSTMENT que imputa interest_charged + fees_charged "
                    "como gasto financiero y sube la deuda. Simétrico a "
                    "payment_movement."
                ),
            ),
        ),
        migrations.AddField(
            model_name='historicalcreditcardstatement',
            name='charges_movement',
            field=models.ForeignKey(
                blank=True, db_constraint=False, null=True,
                on_delete=django.db.models.deletion.DO_NOTHING,
                related_name='+',
                to='treasury.treasurymovement',
                verbose_name='Movimiento de Cargos',
                help_text=(
                    "ADJUSTMENT que imputa interest_charged + fees_charged "
                    "como gasto financiero y sube la deuda. Simétrico a "
                    "payment_movement."
                ),
            ),
        ),
        migrations.RunPython(backfill_charges_movement, reverse_backfill),
    ]
