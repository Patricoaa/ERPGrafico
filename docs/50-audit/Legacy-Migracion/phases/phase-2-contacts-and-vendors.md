# Phase 2 — Contacts & Vendors

> Importación de las 2.843 clientes y 137 vendedores legacy. Detección y resolución de duplicados. RUT normalizado con flag de excepción.

## Precondiciones

- [ ] Phase 1 cerrada (los 6 modelos existen y `Contact` ya soporta `legacy_origin`).
- [ ] `LEGACY_DSN` configurada en el entorno (o `--dsn` disponible).
- [ ] BD legacy `ordenes_dump` accesible (verificación previa con `psql` o `pg_isready`).
- [ ] Fixture de prueba: `backend/legacy/tests/fixtures/legacy_subset.sql` con ~100 clientes y 5 vendedores.

## Tasks

| Task | Título | Salida |
|---|---|---|
| [T05](../tasks/T05-contact-importer.md) | Importer de contactos | `backend/legacy/importers/contacts.py` |
| [T06](../tasks/T06-vendor-importer.md) | Importer de vendedores | `backend/legacy/importers/vendors.py` |
| [T07](../tasks/T07-contact-resolution.md) | Resolución de duplicados | Lógica de normalización + log de warnings |

## Entregables

- `backend/legacy/importers/__init__.py` con `import_contacts` y `import_vendors`.
- `backend/legacy/importers/base.py` con `legacy_cursor`, `batched`, `normalize_rut`.
- `backend/legacy/lib/legacy_rut.py` con `normalize_rut` + `compute_dv`.
- Management command `backend/legacy/management/commands/import_legacy_dump.py` (parcial: solo stages `contacts` y `vendors`).
- `backend/legacy/tests/test_contact_importer.py` con 5+ tests.
- `backend/legacy/tests/test_rut_normalizer.py` con 8+ tests (válidos, inválidos, vacíos, con/sin puntos, con/sin guión).

## DoD de la fase

- [ ] `python manage.py import_legacy_dump --stage=contacts --dry-run` lista 2.843 clientes sin error.
- [ ] `python manage.py import_legacy_dump --stage=contacts` importa; `Contact.objects.count()` ≥ 2.843 (puede haber más si había contactos vivos previos).
- [ ] `ContactLegacyOrigin.objects.count() == 2843`.
- [ ] 1 cliente tiene `tax_id_exception=True` y `raw_tax_id` igual al RUT inválido.
- [ ] `python manage.py import_legacy_dump --stage=vendors` importa; `LegacyVendor.objects.count() == 137`.
- [ ] Re-ejecutar ambos comandos es **idempotente** (counts no cambian).
- [ ] `pytest backend/legacy/tests/test_contact_importer.py backend/legacy/tests/test_rut_normalizer.py -v` pasa.

## Decisiones tomadas en esta fase

1. **RUT normalizado** se guarda en `Contact.tax_id` SIN puntos, con guión (`12345678-9`).
2. **RUT raw** se preserva en `ContactLegacyOrigin.raw_tax_id` (auditoría).
3. **Duplicados** (mismo RUT normalizado) → se loguean como WARNING, se conserva el primero, el segundo queda con `tax_id=''` y `raw_tax_id` en `ContactLegacyOrigin`.
4. **Vendedores** no se mapean a `Contact` (semánticamente son proveedores externos).
5. **Dirección, teléfono, email** se copian tal cual del legacy (sin normalización).
6. **`Contact.name`** se trimea y se usa como fallback si está vacío (`'SIN NOMBRE'`).
7. **El importer es fila-por-fila** dentro de `transaction.atomic()` (NO batch transaccional).

## Mapeo legacy → ERPGrafico

| Legacy `clientes` | ERPGrafico `Contact` | `ContactLegacyOrigin` |
|---|---|---|
| `id` | — | `legacy_external_id` |
| `rut` (raw) | `tax_id` (normalizado) | `raw_tax_id` + `tax_id_exception` |
| `nombre` | `name` | — |
| `direccion` | `address` | — |
| `telefono` | `phone` | — |
| `email` | `email` | — |
| `created_at` | — (se pierde; se usa `auto_now_add`) | — |

| Legacy `vendedores` | ERPGrafico `LegacyVendor` |
|---|---|
| `id` | `legacy_external_id` |
| `nombre` | `name` |
| `category` | `category` |

## Tests de muestra

```python
# test_contact_importer.py
def test_imports_all_clients():
    with patch('legacy.importers.contacts.legacy_cursor') as mock:
        mock.return_value.__enter__.return_value.execute.return_value.fetchall.return_value = [
            {'id': 1, 'rut': '12345678-9', 'nombre': 'Test', 'direccion': '', 'telefono': '', 'email': '', 'created_at': None},
            # ...
        ]
        import_contacts('postgresql://fake', 500, False, import_run)
    assert Contact.objects.count() == 1
    assert ContactLegacyOrigin.objects.count() == 1


def test_rut_invalido_preserva_raw():
    contact, origin = import_one({'id': 99, 'rut': 'INVALIDO', ...})
    assert origin.tax_id_exception is True
    assert origin.raw_tax_id == 'INVALIDO'
    assert contact.tax_id == ''


def test_idempotente():
    import_contacts(dsn, 500, False, run)
    count_after_first = ContactLegacyOrigin.objects.count()
    import_contacts(dsn, 500, False, run)
    assert ContactLegacyOrigin.objects.count() == count_after_first
```

```python
# test_rut_normalizer.py
def test_normalize_with_dots_and_dash():
    assert normalize_rut('12.345.678-9') == ('12345678-9', False)

def test_normalize_without_format():
    assert normalize_rut('12345678K') == ('12345678-K', False)

def test_invalid_dv():
    norm, exc = normalize_rut('12345678-0')
    assert exc is True
    assert norm == '12345678-0'  # preserva raw

def test_empty():
    assert normalize_rut('') == ('', True)

def test_calculates_dv():
    # 12345678-5 es válido
    assert normalize_rut('12345678-5')[1] is False
```

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| BD legacy no accesible | Command falla con `CommandError` claro; el import no se ejecuta |
| RUT con caracteres no esperados | `normalize_rut` los limpia; si no se puede, marca `tax_id_exception=True` |
| Cliente con `nombre` vacío | Se usa `'SIN NOMBRE'` como fallback |
| FK circular (no aplica) | No hay relación cliente↔vendedor en el import |
| Email duplicado | **Se permite** (no se deduplica por email, solo por RUT normalizado) |

## Comandos de verificación rápida

```bash
# 1. Dry-run
python manage.py import_legacy_dump --stage=contacts --dry-run --dsn="$LEGACY_DSN"

# 2. Import real
python manage.py import_legacy_dump --stage=contacts --dsn="$LEGACY_DSN"

# 3. Verificar
python manage.py shell <<'PY'
from contacts.models import Contact
from legacy.models import ContactLegacyOrigin, LegacyVendor
print('Contact:', Contact.objects.count())
print('ContactLegacyOrigin:', ContactLegacyOrigin.objects.count())
print('Con excepción RUT:', ContactLegacyOrigin.objects.filter(tax_id_exception=True).count())
print('LegacyVendor:', LegacyVendor.objects.count())
PY

# 4. Idempotencia
python manage.py import_legacy_dump --stage=contacts --dsn="$LEGACY_DSN"
python manage.py shell -c "from legacy.models import ContactLegacyOrigin; print(ContactLegacyOrigin.objects.count())"
# Debe ser 2843 otra vez

# 5. Tests
pytest backend/legacy/tests/test_contact_importer.py backend/legacy/tests/test_rut_normalizer.py -v
```

## Salida para la Phase 3

Al cerrar Phase 2, ya se puede:
- Importar NVs legacy (Phase 3 T08) — necesita `customer` y `vendor` resolubles.
- Mapear vendor interno/externo (Phase 3 T10) — ya existe `LegacyVendor.category`.

**No** se puede aún:
- Mostrar NVs legacy en la UI (faltan serializers y el frontend).
- Registrar pagos nuevos (falta la NV).
