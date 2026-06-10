# T22 — `SaleOrderViewSet.retrieve` dual-PK

> **Phase**: 6
> **Tiempo estimado**: 20 min
> **Complejidad**: baja

## Precondiciones

- [ ] T19, T20 cerradas.

## Archivos a tocar/crear

- `backend/sales/views.py::SaleOrderViewSet`.

## Implementación

```python
# backend/sales/views.py
class SaleOrderViewSet(...):
    def retrieve(self, request, *args, **kwargs):
        try:
            return super().retrieve(request, *args, **kwargs)
        except Http404:
            if request.user.has_perm('legacy.view_legacy'):
                from legacy.models import LegacySaleNote
                from legacy.adapters import LegacySaleNoteAsSaleOrderShape
                try:
                    note = LegacySaleNote.objects.select_related(
                        'customer', 'related_contact', 'vendor', 'work_order'
                    ).get(pk=kwargs['pk'])
                except LegacySaleNote.DoesNotExist:
                    raise Http404
                adapter = LegacySaleNoteAsSaleOrderShape(note)
                return Response(self.get_serializer(adapter).data)
            raise Http404
```

**Por qué `super().retrieve` primero**: si la PK coincide con un `SaleOrder` vivo, gana ese. La probabilidad de colisión es ~0 (los PK son secuenciales, `SaleOrder` arranca en 1 y `LegacySaleNote` arranca en el siguiente disponible).

## Tests

```python
def test_retrieve_sale_order_normal(api_client, admin_user):
    order = SaleOrderFactory()
    api_client.force_authenticate(admin_user)
    r = api_client.get(f'/api/sales/orders/{order.id}/')
    assert r.data['is_legacy'] is False

def test_retrieve_legacy_sale_note_with_permission(api_client, admin_user):
    note = LegacySaleNoteFactory()
    api_client.force_authenticate(admin_user)
    r = api_client.get(f'/api/sales/orders/{note.id}/?include=legacy')
    assert r.data['is_legacy'] is True
    assert r.data['legacy_external_id'] == note.legacy_external_id

def test_retrieve_legacy_sale_note_no_permission_returns_404(api_client, regular_user):
    note = LegacySaleNoteFactory()
    api_client.force_authenticate(regular_user)
    r = api_client.get(f'/api/sales/orders/{note.id}/?include=legacy')
    assert r.status_code == 404

def test_retrieve_inexistente_devuelve_404(api_client, admin_user):
    api_client.force_authenticate(admin_user)
    r = api_client.get('/api/sales/orders/99999999/')
    assert r.status_code == 404
```

## DoD

- [ ] PK de `SaleOrder` → 200 con `is_legacy=False`.
- [ ] PK de `LegacySaleNote` con permiso → 200 con `is_legacy=True`.
- [ ] PK de `LegacySaleNote` sin permiso → 404.
- [ ] PK inexistente → 404.
- [ ] 4+ tests pasan.

## Comandos de verificación

```bash
pytest backend/sales/tests/test_api_legacy.py -v
```

## Riesgos

- **Fuga de existencia**: el 404 vs 403 puede filtrar "este PK existe pero no tiene permiso". Decisión explícita: usar 404 para no filtrar.
- **Performance**: el `super().retrieve` puede ejecutar queries; si falla, las queries se desperdician. Aceptable.
