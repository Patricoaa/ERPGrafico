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


def import_payments(dsn, batch_size, dry_run, import_run: LegacyImport):
    with legacy_cursor(dsn) as cur:
        cur.execute("""
            SELECT p.id, p.orden_id, p.fecha, p.abono, p.forma_pago
            FROM pagos p
            WHERE p.orden_id IN (SELECT legacy_external_id FROM legacy_lazysalenote)
            ORDER BY p.id
        """)
        rows = cur.fetchall()
        note_map = {n.legacy_external_id: n.id for n in LegacySaleNote.objects.all()}

        for row in rows:
            import_run.rows_processed += 1
            try:
                note_id = note_map.get(row['orden_id'])
                if not note_id:
                    import_run.rows_failed += 1
                    continue

                if row['forma_pago'] not in ('efectivo', 'transferencia', 'cheque'):
                    import_run.rows_failed += 1
                    logger.error('pago id=%s forma_pago=%s inválida', row['id'], row['forma_pago'])
                    continue

                with transaction.atomic():
                    payment, created = LegacyPayment.objects.get_or_create(
                        legacy_external_id=row['id'],
                        defaults={
                            'sale_note_id': note_id,
                            'paid_at': row['fecha'],
                            'amount': row['abono'],
                            'method': row['forma_pago'],
                        },
                    )
                if created and not dry_run:
                    import_run.rows_created += 1
            except Exception as e:
                import_run.rows_failed += 1
                logger.exception('pago id=%s falló: %s', row['id'], e)
```

**Nota**: la tabla `legacy_lazysalenote` es la `LegacySaleNote`; el nombre depende de cómo Django genere el table name (por default es `<app>_<modelname>` = `legacy_legacysalenote`). Verificar con `python manage.py dbshell -c "\d legacy_legacysalenote"`.

## Tests

```python
def test_imports_payment(): ...
def test_idempotente(): ...
def test_pago_sin_nv_se_cuenta_como_fallo(): ...
def test_forma_pago_invalida_falla(): ...
```

## DoD

- [ ] `python manage.py import_legacy_dump --stage=payments` importa 8.556 pagos.
- [ ] 99.4% con `method='efectivo'`, resto `transferencia`/`cheque`.
- [ ] Re-ejecución es idempotente.

## Comandos de verificación

```bash
python manage.py import_legacy_dump --stage=payments --dsn="$LEGACY_DSN"
python manage.py shell -c "from legacy.models import LegacyPayment; print(LegacyPayment.objects.count())"
pytest backend/legacy/tests/test_payment_importer.py -v
```

## Riesgos

- **`legacy_lazysalenote` no existe como tabla**: verificar nombre real con `\d` en `dbshell`.
- **Pagos de NVs anuladas** se omiten por el `WHERE orden_id IN (...)`.
- **8.556 inserts**: ~30s en bulk. Aceptable.
