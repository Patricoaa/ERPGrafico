# T01 — Create legacy app

> **Phase**: 1
> **Tiempo estimado**: 15 min
> **Complejidad**: baja

## Precondiciones

- [ ] Repo limpio, sin PRs abiertos tocando `backend/`.

## Archivos a crear

```
backend/legacy/__init__.py                  (vacío)
backend/legacy/apps.py
backend/legacy/permissions.py               (se completa en T04; placeholder en T01)
backend/legacy/exceptions.py
backend/legacy/serializers.py              (LegacySaleNoteSerializer; vacío por ahora)
backend/legacy/views.py                     (vacío por ahora)
backend/legacy/urls.py                      (vacío por ahora)
backend/legacy/admin.py                     (placeholder)
backend/legacy/migrations/__init__.py      (vacío)
backend/legacy/management/__init__.py      (vacío)
backend/legacy/management/commands/__init__.py  (vacío)
backend/legacy/importers/__init__.py        (vacío)
backend/legacy/services/__init__.py         (vacío)
backend/legacy/lib/__init__.py              (vacío)
backend/legacy/tests/__init__.py            (vacío)
```

## Implementación

### `apps.py`

```python
from django.apps import AppConfig

class LegacyConfig(AppConfig):
    name = 'legacy'
    default_auto_field = 'django.db.models.BigAutoField'
    verbose_name = 'Datos legacy (migración)'

    def ready(self):
        from . import permissions  # noqa: F401
```

### `permissions.py` (placeholder; completo en T04)

```python
"""Permisos custom de la app legacy.
   El detalle completo se implementa en T04.
"""
LEGACY_PERMISSIONS_CODENAMES = ('view_legacy', 'pay_pending_legacy', 'import_legacy')
```

### `exceptions.py`

```python
class LegacyError(Exception):
    """Base para errores de la app legacy."""


class LegacyPaymentError(LegacyError):
    """Error al registrar un pago nuevo sobre NV legacy."""


class LegacyImportError(LegacyError):
    """Error durante el import legacy."""
```

### `admin.py` (placeholder; completo en T25)

```python
from django.contrib import admin

# Por ahora vacío. T25 registra solo LegacyImport.
```

## Registro en `INSTALLED_APPS`

Editar `backend/config/settings.py` (o `base.py` según la estructura):

```python
INSTALLED_APPS = [
    # ... apps existentes ...
    'legacy',
]
```

## DoD

- [ ] `python manage.py check` no reporta errores.
- [ ] `python manage.py showmigrations legacy` lista (no migrations) para `legacy`.
- [ ] `from legacy.apps import LegacyConfig` no falla.
- [ ] `from legacy.exceptions import LegacyError` no falla.

## Comandos de verificación

```bash
python manage.py check
python manage.py showmigrations legacy
```

## Riesgos

- App name colisiona con un import de stdlib `legacy` (no debería). Verificar con `python -c "import legacy"`.
