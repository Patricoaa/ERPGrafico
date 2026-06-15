# T15 — Payment importer

> **Phase**: 5
> **Tiempo estimado**: 30 min
> **Complejidad**: baja

## Precondiciones

- [ ] Phase 3 cerrada (`LegacySaleNote` poblada).

## Archivos a tocar/crear

- `backend/legacy/importers/payments.py`.
- `backend/legacy/management/commands/import_legacy_dump.py` (extender con `--stage=payments`).
- `backend/legacy/tests/test_payment_importer.py`.

## Implementación

Ver `04-backend-import-pipeline.md` §5. Resumen:

```python
# backend/legacy/importers/payments.py
import logging
from django.db import transaction
from legacy.importers.base import legacy_cursor
from legacy.models import LegacyPayment, LegacyImport

logger = logging.getLogger('legacy.import')


VALID_METHODS = ('efectivo', 'transferencia', 'tarjeta')  # NO existe 'cheque'

def import_payments(dsn, batch_size, dry_run, import_run: LegacyImport):
    # El filtro por NVs importadas se hace en Python (no en SQL contra la BD origen).
    note_map = {n.legacy_external_id: n.id for n in LegacySaleNote.objects.all()}

    with legacy_cursor(dsn) as cur:
        cur.execute("""
            SELECT p.id, p.orden_id, p.fecha, p.monto, p.metodo
            FROM pagos p
            WHERE p.deleted_at IS NULL
            ORDER BY p.id
        """)
        rows = cur.fetchall()

        for row in rows:
            import_run.rows_processed += 1
            try:
                note_id = note_map.get(row['orden_id'])
                if not note_id:
                    import_run.rows_skipped += 1
                    continue

                if row['metodo'] not in VALID_METHODS:
                    import_run.rows_failed += 1
                    logger.error('pago id=%s metodo=%s inválido', row['id'], row['metodo'])
                    continue

                with transaction.atomic():
                    payment, created = LegacyPayment.objects.get_or_create(
                        legacy_external_id=row['id'],
                        defaults={
                            'sale_note_id': note_id,
                            'paid_at': row['fecha'].date(),  # timestamp → date
                            'amount': row['monto'],
                            'method': row['metodo'],
                        },
                    )
                if created and not dry_run:
                    import_run.rows_created += 1
            except Exception as e:
                import_run.rows_failed += 1
                logger.exception('pago id=%s falló: %s', row['id'], e)
```

> ⚠️ **Bug del plan previo corregido**: el `WHERE orden_id IN (SELECT legacy_external_id FROM legacy_lazysalenote)` consultaba una tabla **destino** (además mal escrita) sobre el **cursor de la BD origen** `ordenes_dump`, que no la tiene → siempre fallaba. El filtrado correcto es **en Python** contra `note_map`. Columnas reales: `monto` (no `abono`), `metodo` (no `forma_pago`).

## Tests

```python
def test_imports_payment(): ...
def test_idempotente(): ...
def test_pago_sin_nv_se_cuenta_como_skipped(): ...
def test_metodo_invalido_falla(): ...
```

## DoD

- [ ] `python manage.py import_legacy_dump --stage=payments` importa 8.556 pagos.
- [ ] Distribución: efectivo 8.494, transferencia 53, **tarjeta 9** (no existe `cheque`).
- [ ] Re-ejecución es idempotente.

## Comandos de verificación

```bash
python manage.py import_legacy_dump --stage=payments --dsn="$LEGACY_DSN"
python manage.py shell -c "from legacy.models import LegacyPayment; print(LegacyPayment.objects.count())"
pytest backend/legacy/tests/test_payment_importer.py -v
```

## Riesgos

- **Filtrado en Python** contra `note_map` (no SQL contra la BD origen). 0 pagos huérfanos verificados.
- **7 NVs sobrepagadas**: el saldo pendiente en UI se clampa a 0 (ver `05` `LegacySaleNoteSerializer.get_pending_amount`).
- **8.556 inserts**: ~30s en bulk. Aceptable.
