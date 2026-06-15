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

Ver `04-backend-import-pipeline.md` §4 (reescrito con columnas reales) para el código completo. Query con **columnas reales**:

```sql
SELECT o.id, o.folio, o.cliente_id, o.vendedor_id, o.categoria_id,
       o.descripcion, o.detalles, o.cantidad, o.precio_neto, o.iva,
       o.precio_total, o.estado_trabajo, o.estado_despachado, o.fecha_ingreso
FROM ordenes o
WHERE o.deleted_at IS NULL
ORDER BY o.id
```

> No existen `numero`/`descripcion_texto`/`despachado`/`pendiente`/`fecha`/`estado`, ni el estado `anulada`.

**Constantes**:

```python
CATEGORIES = {
    1: 'Impresion Digital',
    2: 'Impresion Offset',
    3: 'Calendarios',
    4: 'Timbres',
    5: 'Fotocopias y encuadernado',
}

# Por estado_trabajo (1:1 con estado_despachado). Solo 2 combos reales.
LEGACY_STATUS_MAP = {
    'terminado': ('DISPATCHED', False),
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
def test_creates_for_terminado(): ...        # estado_trabajo='terminado' → DISPATCHED
def test_creates_for_pendiente(): ...         # estado_trabajo='pendiente' → PENDING
def test_skips_deleted(): ...                 # deleted_at IS NOT NULL se omite
def test_unknown_category_fails_loudly(): ...
def test_idempotente(): ...
def test_vendor_resolution_works(): ...
def test_dispatched_at_set_correctly(): ...
```

## DoD

- [ ] `python manage.py import_legacy_dump --stage=orders --dsn=...` importa 7.980 NVs.
- [ ] No hay anuladas (estado inexistente); 0 filiales borradas a omitir hoy.
- [ ] 7.960 con `status='DISPATCHED'`, 20 con `PENDING`.
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
