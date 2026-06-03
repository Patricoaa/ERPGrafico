# T06 — Vendor importer

> **Phase**: 2
> **Tiempo estimado**: 30 min
> **Complejidad**: baja

## Precondiciones

- [ ] T05 cerrada.

## Archivos a tocar/crear

- `backend/legacy/importers/vendors.py`.
- `backend/legacy/management/commands/import_legacy_dump.py` (extender con `--stage=vendors`).
- `backend/legacy/tests/test_vendor_importer.py`.

## 1. `importers/vendors.py`

```python
# backend/legacy/importers/vendors.py
import logging
from django.db import transaction
from legacy.importers.base import legacy_cursor
from legacy.models import LegacyVendor, LegacyImport

logger = logging.getLogger('legacy.import')


def import_vendors(dsn, batch_size, dry_run, import_run: LegacyImport):
    with legacy_cursor(dsn) as cur:
        cur.execute('SELECT id, nombre, category FROM vendedores ORDER BY id')
        rows = cur.fetchall()
        for row in rows:
            import_run.rows_processed += 1
            try:
                if row['category'] not in ('interno', 'externo'):
                    import_run.rows_failed += 1
                    logger.error('vendedor id=%s categoría=%s inválida', row['id'], row['category'])
                    continue

                with transaction.atomic():
                    vendor, created = LegacyVendor.objects.get_or_create(
                        legacy_external_id=row['id'],
                        defaults={'name': row['nombre'].strip() or 'SIN NOMBRE',
                                  'category': row['category']},
                    )
                if created and not dry_run:
                    import_run.rows_created += 1
            except Exception as e:
                import_run.rows_failed += 1
                logger.exception('vendedor id=%s falló: %s', row['id'], e)
```

## 2. Extender management command

```python
parser.add_argument('--stage', choices=['contacts', 'vendors'], default='contacts')

# en handle():
if opts['stage'] == 'vendors':
    import_vendors(opts['dsn'], opts['batch_size'], opts['dry_run'], import_run)
```

## 3. Tests

```python
# test_vendor_importer.py
def test_imports_vendor():
    ...
def test_idempotente():
    ...
def test_categoria_invalida_se_cuenta_como_fallo():
    ...
```

## DoD

- [ ] `python manage.py import_legacy_dump --stage=vendors` importa 137 vendedores.
- [ ] Todos tienen `category='externo'`.
- [ ] Re-ejecución es idempotente.

## Comandos de verificación

```bash
python manage.py import_legacy_dump --stage=vendors --dsn="$LEGACY_DSN"
python manage.py shell -c "from legacy.models import LegacyVendor; print(LegacyVendor.objects.count())"
pytest backend/legacy/tests/test_vendor_importer.py -v
```

## Riesgos

- 137/137 son `externo`. Branch `interno` no se ejecuta en este dataset.
- `category` inválida → `rows_failed += 1`, no se crea el vendor.
