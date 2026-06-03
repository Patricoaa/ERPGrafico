# T05 — Contact importer

> **Phase**: 2
> **Tiempo estimado**: 45 min
> **Complejidad**: media

## Precondiciones

- [ ] Phase 1 cerrada.
- [ ] `LEGACY_DSN` configurada.
- [ ] `backend/legacy/importers/base.py` con `legacy_cursor` y `batched` (helper).

## Archivos a tocar/crear

- `backend/legacy/lib/legacy_rut.py` (helper RUT).
- `backend/legacy/importers/base.py` (helper conexión + batch).
- `backend/legacy/importers/contacts.py` (importer).
- `backend/legacy/management/commands/import_legacy_dump.py` (parcial, solo `--stage=contacts`).
- `backend/legacy/tests/test_contact_importer.py`.

## 1. `lib/legacy_rut.py`

Ver `04-backend-import-pipeline.md` §6 para el código completo.

## 2. `importers/base.py`

```python
# backend/legacy/importers/base.py
from contextlib import contextmanager
import psycopg2
import psycopg2.extras


@contextmanager
def legacy_cursor(dsn):
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur
    finally:
        conn.close()


def batched(cursor, size):
    """Generador que devuelve listas de hasta `size` filas."""
    batch = []
    for row in cursor.fetchall():
        batch.append(row)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch
```

## 3. `importers/contacts.py`

Ver `04-backend-import-pipeline.md` §2 para el código completo. Resumen:

- Query: `SELECT id, rut, nombre, direccion, telefono, email, created_at FROM clientes ORDER BY id`.
- Batch size 500.
- Por fila: `normalize_rut` → `get_or_create(Contact)` → `get_or_create(ContactLegacyOrigin)`.
- Idempotente por `(source_table='clientes', legacy_external_id)`.

## 4. Management command (parcial)

```python
# backend/legacy/management/commands/import_legacy_dump.py
from django.core.management.base import BaseCommand, CommandError
from legacy.models import LegacyImport
from legacy.importers.contacts import import_contacts


class Command(BaseCommand):
    help = 'Importa datos desde la BD legacy `ordenes_dump`.'

    def add_arguments(self, parser):
        parser.add_argument('--stage', choices=['contacts'], default='contacts')  # ampliado en fases siguientes
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--dsn', default=os.environ.get('LEGACY_DSN'))
        parser.add_argument('--batch-size', type=int, default=500)
        parser.add_argument('--started-by', default='system')

    def handle(self, *args, **opts):
        if not opts['dsn']:
            raise CommandError('DSN requerida (--dsn=... o $LEGACY_DSN)')

        import_run = LegacyImport.objects.create(
            stage=opts['stage'],
            status='RUNNING',
            started_by_id=int(opts['started_by']) if opts['started_by'].isdigit() else 1,
            dry_run=opts['dry_run'],
            legacy_dsn=opts['dsn'].split('@')[-1],
        )

        try:
            if opts['stage'] == 'contacts':
                import_contacts(opts['dsn'], opts['batch_size'], opts['dry_run'], import_run)
            import_run.status = 'COMPLETED'
        except Exception as e:
            import_run.status = 'FAILED'
            import_run.error_log = traceback.format_exc()
            raise
        finally:
            import_run.finished_at = timezone.now()
            import_run.save()
```

## 5. Tests

Ver `08-testing-and-validation.md` §2.1 y `phases/phase-2-contacts-and-vendors.md` §"Tests de muestra".

## DoD

- [ ] `python manage.py import_legacy_dump --stage=contacts --dsn="$LEGACY_DSN"` importa 2.843 clientes.
- [ ] 1 cliente tiene `tax_id_exception=True`.
- [ ] Re-ejecución es idempotente.
- [ ] `pytest backend/legacy/tests/test_contact_importer.py -v` pasa.

## Comandos de verificación

```bash
python manage.py import_legacy_dump --stage=contacts --dsn="$LEGACY_DSN"
python manage.py shell -c "from legacy.models import ContactLegacyOrigin; print(ContactLegacyOrigin.objects.count())"
pytest backend/legacy/tests/test_contact_importer.py -v
```

## Riesgos

- BD legacy no accesible → command falla con mensaje claro.
- RUT con caracteres inesperados → `normalize_rut` los limpia o marca excepción.
- `Contact` con `name` duplicado (mismo nombre, distinto RUT) → se permite (no es unique).
