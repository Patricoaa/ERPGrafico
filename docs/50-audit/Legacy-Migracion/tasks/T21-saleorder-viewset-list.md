# T21 — `SaleOrderViewSet.list` extension

> **Phase**: 6
> **Tiempo estimado**: 45 min
> **Complejidad**: media

## Precondiciones

- [ ] T19, T20 cerradas.

## Archivos a tocar/crear

- `backend/sales/views.py::SaleOrderViewSet`.

## Implementación

```python
# backend/sales/views.py
class SaleOrderViewSet(...):
    def list(self, request, *args, **kwargs):
        include = _get_include(request)
        qs = self.filter_queryset(self.get_queryset())
        items = list(qs)

        if 'legacy' in include and request.user.has_perm('legacy.view_legacy'):
            from legacy.models import LegacySaleNote
            from legacy.adapters import LegacySaleNoteAsSaleOrderShape
            legacy_qs = self.filter_legacy_queryset(LegacySaleNote.objects.all(), request)
            items += [LegacySaleNoteAsSaleOrderShape(n) for n in legacy_qs]

        items = self.sort_items(items, request)
        page = self.paginate_queryset(items)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    def filter_legacy_queryset(self, qs, request):
        """Hook para que el override del frontend pueda agregar filtros."""
        return qs  # default: sin filtros adicionales

    def sort_items(self, items, request):
        """Ordena por issue_date DESC."""
        return sorted(items, key=lambda x: getattr(x, 'issue_date', None) or x.created_at.date(), reverse=True)
```

## Filtrado legacy

Por ahora no se filtra legacy con `customer_id` (sería costoso). Se acepta que `?customer=X` filtra solo `SaleOrder` vivos.

Si en el futuro se quiere filtrar legacy también, se hace un override en `filter_legacy_queryset`:

```python
def filter_legacy_queryset(self, qs, request):
    customer_id = request.query_params.get('customer')
    if customer_id:
        from django.db.models import Q
        return qs.filter(Q(customer_id=customer_id) | Q(related_contact_id=customer_id))
    return qs
```

## Tests

```python
def test_list_includes_legacy_with_permission(api_client, admin_user):
    LegacySaleNoteFactory()
    api_client.force_authenticate(admin_user)
    r = api_client.get('/api/sales/orders/?include=legacy&page=1')
    assert r.status_code == 200
    assert any(item['is_legacy'] for item in r.data['results'])

def test_list_excludes_legacy_with_include_none(api_client, admin_user):
    LegacySaleNoteFactory()
    api_client.force_authenticate(admin_user)
    r = api_client.get('/api/sales/orders/?include=none&page=1')
    assert all(not item['is_legacy'] for item in r.data['results'])

def test_list_excludes_legacy_without_permission(api_client, regular_user):
    LegacySaleNoteFactory()
    api_client.force_authenticate(regular_user)
    r = api_client.get('/api/sales/orders/?include=legacy&page=1')
    assert all(not item['is_legacy'] for item in r.data['results'])
```

## DoD

- [ ] `?include=legacy` con permiso → unión SaleOrder + LegacySaleNote.
- [ ] `?include=none` → solo SaleOrder.
- [ ] `?include=legacy` sin permiso → solo SaleOrder (filtrado silencioso).
- [ ] Orden: `issue_date DESC` para ambos tipos.
- [ ] 3+ tests pasan.

## Comandos de verificación

```bash
pytest backend/sales/tests/test_api_legacy.py -v
```

## Riesgos

- **Performance**: 7.960 NVs adicionales en la lista → ~2 MB de memoria. Aceptable.
- **Sort**: si el adapter no tiene `issue_date`, fallback a `created_at.date()`. Ya cubierto.
