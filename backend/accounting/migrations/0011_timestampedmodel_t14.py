"""
T-14: Apply TimeStampedModel to accounting models without timestamps.

Modelos migrados:
  - Account:          AddField created_at + updated_at. Backfill: now().
  - JournalItem:      AddField created_at + updated_at. Backfill: entry.created_at (más correcto).
  - Budget:           AddField updated_at solo (created_at ya existía como auto_now_add).
                      La columna created_at sigue siendo la misma — solo cambia herencia.
  - BudgetItem:       AddField created_at + updated_at. Backfill: now().
  - AccountingSettings: AddField created_at + updated_at. Backfill: now().

Notas:
  - Usar `default=now` en AddField para que Django no rompa en bases existentes.
  - El backfill de JournalItem usa RunPython para copiar entry.created_at.
  - Las columnas de HistoricalRecords NO se tocan — simple_history las gestiona.
"""
from django.db import migrations, models
from django.utils import timezone


def backfill_journal_item_timestamps(apps, schema_editor):
    """
    Para JournalItem: usa entry.created_at como valor de backfill.
    Es más preciso que now() porque refleja cuándo se registró el asiento.
    """
    JournalItem = apps.get_model('accounting', 'JournalItem')
    db = schema_editor.connection.alias
    items_to_update = []
    for item in JournalItem.objects.using(db).select_related('entry').iterator(chunk_size=500):
        entry_created = getattr(item.entry, 'created_at', None)
        if entry_created:
            item.created_at = entry_created
            item.updated_at = entry_created
        else:
            now = timezone.now()
            item.created_at = now
            item.updated_at = now
        items_to_update.append(item)

    JournalItem.objects.using(db).bulk_update(
        items_to_update, ['created_at', 'updated_at'], batch_size=500
    )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0010_journalentry_audited_model'),
    ]

    operations = [
        # --- Account ---
        migrations.AddField(
            model_name='account',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                verbose_name='Creado el',
                default=timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='account',
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                verbose_name='Actualizado el',
            ),
        ),

        # --- JournalItem ---
        migrations.AddField(
            model_name='journalitem',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                verbose_name='Creado el',
                default=timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='journalitem',
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                verbose_name='Actualizado el',
            ),
        ),
        # Backfill JournalItem con entry.created_at
        migrations.RunPython(
            backfill_journal_item_timestamps,
            reverse_code=noop_reverse,
        ),

        # --- Budget: ya tenía created_at (auto_now_add), solo añadir updated_at ---
        # NOTA: La columna created_at existente se preserva tal cual.
        # AlterField para añadir verbose_name desde TimeStampedModel.
        migrations.AlterField(
            model_name='budget',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                verbose_name='Creado el',
            ),
        ),
        migrations.AddField(
            model_name='budget',
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                verbose_name='Actualizado el',
            ),
        ),

        # --- BudgetItem ---
        migrations.AddField(
            model_name='budgetitem',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                verbose_name='Creado el',
                default=timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='budgetitem',
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                verbose_name='Actualizado el',
            ),
        ),

        # --- AccountingSettings ---
        migrations.AddField(
            model_name='accountingsettings',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                verbose_name='Creado el',
                default=timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='accountingsettings',
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                verbose_name='Actualizado el',
            ),
        ),
    ]
