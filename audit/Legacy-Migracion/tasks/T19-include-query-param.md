# T19 — `?include=` query param parser

> **Phase**: 6
> **Tiempo estimado**: 20 min
> **Complejidad**: baja

## Precondiciones

- [ ] Phase 5 cerrada.

## Archivos a tocar/crear

- `backend/sales/views.py` (agregar helper `_get_include`).
- `backend/contacts/views.py` (mismo helper, o import desde `sales`).

## Implementación

```python
# backend/sales/views.py
def _get_include(request):
    raw = request.query_params.get('include', 'legacy')
    if raw == 'none':
        return set()
    if raw in ('legacy', 'all'):
        return {'legacy'}
    raise ValidationError({'include': 'Valor inválido. Use none|legacy|all.'})
```

## Tests

```python
# En test_sale_order_api_legacy.py
def test_include_default_es_legacy(api_client, admin_user):
    api_client.force_authenticate(admin_user)
    r = api_client.get('/api/sales/orders/?page=1')
    assert r.status_code == 200  # default legacy

def test_include_none_excluye_legacy(api_client, admin_user):
    api_client.force_authenticate(admin_user)
    r = api_client.get('/api/sales/orders/?include=none&page=1')
    assert r.status_code == 200

def test_include_invalido_devuelve_400(api_client, admin_user):
    api_client.force_authenticate(admin_user)
    r = api_client.get('/api/sales/orders/?include=foo&page=1')
    assert r.status_code == 400
```

## DoD

- [ ] `_get_include` parsea correctamente.
- [ ] Default es `legacy`.
- [ ] `none` desactiva.
- [ ] Valor inválido → 400.

## Comandos de verificación

```bash
pytest backend/sales/tests/test_api_legacy.py -v
```

## Riesgos

- **Default-on puede romper código existente** que asuma que `?include` no se consulta. Documentar en release notes.
