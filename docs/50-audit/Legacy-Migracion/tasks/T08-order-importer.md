# T08 — Order importer

> **Phase**: 3
> **Tiempo estimado**: 60 min
> **Complejidad**: media

## Precondiciones

- [ ] Phase 1, 2 cerradas.

## Archivos a tocar/crear

- `backend/legacy/importers/orders.py` (importer principal).
- `backend/legacy/management/commands/import_legacy_dump.py` (extender con `--stage=orders`).
- `backend/legacy/tests/test_order_importer.py`.

## 1. `importers/orders.py`

Ver `04-backend-import-pipeline.md` §4 para el código completo. Resumen de la query:

```sql
SELECT o.id, o.numero, o.cliente_id, o.vendedor_id, o.categoria_id,
       o.descripcion_texto, o.cantidad, o.precio_neto, o.iva,
       o.precio_total, o.despachado, o.pendiente, o.fecha, o.estado
FROM ordenes o
WHERE o.estado != 'anulada'
ORDER BY o.id
```

**Constantes**:

```python
CATEGORIES = {
    1: 'Impresion Digital',
    2: 'Impresion Offset',
    3: 'Calendarios',
    4: 'Timbres',
    5: 'Fotocopias y encuadernado',
}

LEGACY_STATUS_MAP = {
    'despachado': ('DISPATCHED', False),
    'no_despachado': ('IN_PRODUCTION', False),
    'pendiente': ('PENDING', True),
}
```

**Cache de lookups**:

```python
cliente_map = {c.legacy_external_id: c.contact_id for c in ContactLegacyOrigin.objects.filter(source_table='clientes').select_related('contact')}
vendor_map = {v.legacy_external_id: v for v in LegacyVendor.objects.all()}
```

**Loop principal** (ver §4 de `04-backend-import-pipeline.md`).

## 2. Extender management command

```python
parser.add_argument('--stage', choices=['contacts', 'vendors', 'orders', 'all'], default='all')

if opts['stage'] in ('orders', 'all'):
    import_orders(...)
```

## 3. Tests

Ver `phases/phase-3-sale-notes.md` §"Tests de muestra":

```python
def test_creates_for_despachado(): ...
def test_skips_anulada(): ...
def test_unknown_category_fails_loudly(): ...
def test_idempotente(): ...
def test_vendor_resolution_works(): ...
def test_dispatched_at_set_correctly(): ...
```

## DoD

- [ ] `python manage.py import_legacy_dump --stage=orders --dsn=...` importa 7.960 NVs.
- [ ] 20 anuladas omitidas.
- [ ] 7.740 con `status='DISPATCHED'`, 200 con `IN_PRODUCTION`, 20 con `PENDING`.
- [ ] Re-ejecución es idempotente.

## Comandos de verificación

```bash
python manage.py import_legacy_dump --stage=orders --dsn="$LEGACY_DSN"
python manage.py shell -c "from legacy.models import LegacySaleNote; print(LegacySaleNote.objects.count())"
pytest backend/legacy/tests/test_order_importer.py -v
```

## Riesgos

- Categoría 6+ no se importa (fila en `rows_failed`).
- Cliente o vendor no resuelto (huérfano) → fila en `rows_failed` con log.
- Memoria del cache: ~2 MB.
