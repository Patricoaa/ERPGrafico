# T21 — `SaleOrderViewSet.list` extension

> **Phase**: 6
> **Tiempo estimado**: 45 min
> **Complejidad**: media

## Precondiciones

- [ ] T19, T20 cerradas.

## Archivos a tocar/crear

- `backend/sales/views.py::SaleOrderViewSet`.

## Implementación

> Cada tipo se serializa con **su propio** serializer (`SaleOrderSerializer` para vivos, `LegacySaleNoteSerializer` para legacy), que emiten el mismo shape JSON. No se usa adapter. Código autoritativo: `05` §1.3.

```python
# backend/sales/views.py
from legacy.models import LegacySaleNote
from legacy.serializers import LegacySaleNoteSerializer

class SaleOrderViewSet(...):
    def list(self, request, *args, **kwargs):
        include = _get_include(request)
        live_qs = self.filter_queryset(self.get_queryset())

        if not ('legacy' in include and request.user.has_perm('legacy.view_legacy')):
            return super().list(request, *args, **kwargs)

        legacy_qs = self._filter_legacy(
            LegacySaleNote.objects.select_related('customer', 'vendor', 'work_order'),
            request,
        )
        merged = self._sort_merged(
            [('live', o) for o in live_qs] + [('legacy', n) for n in legacy_qs],
            request,
        )
        page = self.paginate_queryset(merged)
        ctx = self.get_serializer_context()
        data = [
            (SaleOrderSerializer if kind == 'live' else LegacySaleNoteSerializer)(o, context=ctx).data
            for kind, o in page
        ]
        return self.get_paginated_response(data)

    def _sort_merged(self, items, request):
        """Ordena por la key común `date` DESC (SaleOrder.date / LegacySaleNote.issue_date)."""
        def key(pair):
            _, o = pair
            return getattr(o, 'date', None) or getattr(o, 'issue_date', None)
        return sorted(items, key=key, reverse=True)

    def _filter_legacy(self, qs, request):
        """Traduce los filtros/búsqueda de DRF al queryset de LegacySaleNote.
        Sin esto, los items legacy ignorarían `?customer=`, `?search=`, rango de fecha, etc."""
        customer_id = request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        # ... traducir search / status / rango de fecha según los filtros del viewset vivo ...
        return qs
```

## Filtrado legacy

A diferencia del plan previo, los filtros **sí** deben aplicarse al queryset legacy en `_filter_legacy` (si no, `?customer=X` mostraría todas las NVs legacy). Como `customer` es siempre el cliente real (sin swap de vendor), basta `customer_id=` — ya no hay `related_contact` que considerar.

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
- [ ] Orden: por `date`/`issue_date` DESC para ambos tipos.
- [ ] `?customer=X` filtra también las NVs legacy (vía `_filter_legacy`).
- [ ] 3+ tests pasan.

## Comandos de verificación

```bash
pytest backend/sales/tests/test_api_legacy.py -v
```

## Riesgos

- **Performance**: con `include=legacy` se materializan las NVs legacy que pasen el filtro (~7.980 si no hay filtro) en memoria. Medir (`08` §6); evaluar `UNION` SQL si degrada.
- **Filtros**: `_filter_legacy` debe replicar los filtros/search/orden del viewset vivo, o los items legacy los ignoran.
