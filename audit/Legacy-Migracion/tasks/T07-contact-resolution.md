# T07 — Contact resolution (duplicates + RUT)

> **Phase**: 2
> **Tiempo estimado**: 45 min
> **Complejidad**: media

## Precondiciones

- [ ] T05, T06 cerradas.

## Archivos a tocar/crear

- `backend/legacy/lib/legacy_rut.py` (ya creado en T05; se amplía con tests).
- `backend/legacy/tests/test_rut_normalizer.py`.

## Implementación

El importer de contactos (T05) ya detecta duplicados por RUT normalizado:

```python
# En import_contacts:
try:
    with transaction.atomic():
        contact, c_created = Contact.objects.get_or_create(
            tax_id=rut_norm or None,
            name=name,
            defaults={...},
        )
        if not c_created and contact.tax_id != rut_norm:
            # RUT colisiona con un Contact existente con distinto RUT
            logger.warning('cliente legacy id=%s colisiona con Contact id=%s (tax_id=%s)', row['id'], contact.id, contact.tax_id)
            # Decisión: usar el contact existente pero guardar raw_tax_id en ContactLegacyOrigin
        ...
except Exception as e:
    import_run.rows_failed += 1
    logger.exception(...)
```

### Política de resolución

1. **Si `Contact` con mismo `tax_id` ya existe**: se reutiliza; se crea `ContactLegacyOrigin` apuntando a él. **No** se duplica el `Contact`.
2. **Si hay colisión de RUT** (mismo RUT pero nombre distinto): se loguea WARNING con ambos `legacy_external_id`s. El `Contact` se mantiene con el primer `name`; el segundo `ContactLegacyOrigin` se crea apuntando al mismo `Contact` (con `raw_tax_id` distinto).
3. **Si RUT inválido** (`tax_id_exception=True`): `Contact.tax_id=''` (vacío), se permite crear duplicados (no hay forma única de identificarlos).

## Tests

```python
# test_rut_normalizer.py
import pytest
from legacy.lib.legacy_rut import normalize_rut


@pytest.mark.parametrize('raw,expected_norm,expected_exc', [
    ('12345678-5', '12345678-5', False),
    ('12.345.678-5', '12345678-5', False),
    ('123456785', '', True),  # sin DV
    ('12345678-0', '12345678-0', True),  # DV incorrecto
    ('', '', True),
    (None, '', True),
    ('12345678K', '12345678-K', False),  # K como DV
    ('12345678-k', '12345678-K', False),  # minúscula
    ('12.345.678-K', '12345678-K', False),
])
def test_normalize_rut(raw, expected_norm, expected_exc):
    norm, exc = normalize_rut(raw)
    assert norm == expected_norm
    assert exc == expected_exc
```

## DoD

- [ ] 8+ tests parametrizados pasan.
- [ ] RUT `12345678-5` (válido) → `(12345678-5, False)`.
- [ ] RUT `12345678-0` (DV incorrecto) → `(12345678-0, True)`.
- [ ] RUT vacío → `('', True)`.
- [ ] Importer detecta colisiones y loguea WARNING.

## Comandos de verificación

```bash
pytest backend/legacy/tests/test_rut_normalizer.py -v
pytest backend/legacy/tests/test_contact_importer.py -v
```

## Riesgos

- **Colisiones silenciosas**: si un `Contact` ya existía con `tax_id` distinto, el import "lo secuestra". Documentar en el log del import.
- **Falsos positivos de DV**: el algoritmo módulo 11 puede fallar para RUTs con formatos regionales antiguos. Se documenta como riesgo aceptado.
