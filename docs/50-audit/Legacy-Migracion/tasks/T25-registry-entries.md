# T25 — Registry entry for `LegacyImport`

> **Phase**: 6
> **Tiempo estimado**: 10 min
> **Complejidad**: baja

## Precondiciones

- [ ] Phase 5 cerrada.

## Archivos a tocar/crear

- `backend/core/registry.py` (modificar).
- `backend/legacy/admin.py` (registrar solo `LegacyImport`).

## Implementación

```python
# backend/core/registry.py
REGISTRY = {
    # ... entries existentes ...
    'legacy.legacyimport': {
        'app': 'legacy',
        'model': 'LegacyImport',
        'admin_path': '/admin/legacy/legacyimport/',
        'verbose_name': 'Importaciones legacy',
    },
    # NOTA: 'legacy.legacysalenote' y 'legacy.contactorigin' NO se registran
    # (no son entry points del usuario final).
}
```

```python
# backend/legacy/admin.py
from django.contrib import admin
from legacy.models import LegacyImport


@admin.register(LegacyImport)
class LegacyImportAdmin(admin.ModelAdmin):
    list_display = ('id', 'stage', 'status', 'started_at', 'finished_at', 'rows_created', 'rows_failed')
    list_filter = ('status', 'stage')
    readonly_fields = ('started_at', 'finished_at', 'error_log', 'legacy_dsn', 'idempotency_key')
```

## Tests

```python
def test_registry_has_legacy_import():
    from core.registry import REGISTRY
    assert 'legacy.legacyimport' in REGISTRY

def test_registry_no_legacy_sale_note():
    from core.registry import REGISTRY
    assert 'legacy.legacysalenote' not in REGISTRY
    assert 'legacy.contactorigin' not in REGISTRY
```

## DoD

- [ ] `REGISTRY['legacy.legacyimport']` existe.
- [ ] `LegacyImport` registrado en admin.
- [ ] 2+ tests pasan.

## Comandos de verificación

```bash
pytest backend/legacy/tests/test_registry.py -v
python manage.py check
```

## Riesgos

- **Naming**: verificar el patrón del registry existente para mantener consistencia.
