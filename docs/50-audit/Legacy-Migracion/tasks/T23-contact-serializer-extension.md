# T23 — `ContactSerializer` extension

> **Phase**: 6
> **Tiempo estimado**: 10 min
> **Complejidad**: baja

## Precondiciones

- [ ] T19 cerrada.

## Archivos a tocar/crear

- `backend/contacts/serializers.py::ContactSerializer`.
- `backend/contacts/views.py` (agregar `select_related('legacy_origin')`).

## Implementación

```python
# backend/contacts/serializers.py
class ContactSerializer(serializers.ModelSerializer):
    is_legacy = serializers.SerializerMethodField()

    class Meta:
        model = Contact
        fields = [..., 'is_legacy']

    def get_is_legacy(self, obj):
        return hasattr(obj, 'legacy_origin')
```

```python
# backend/contacts/views.py
class ContactViewSet(...):
    def get_queryset(self):
        return super().get_queryset().select_related('legacy_origin')
```

## Tests

```python
def test_serializer_is_legacy_false_for_normal(api_client):
    contact = ContactFactory()
    s = ContactSerializer(contact)
    assert s.data['is_legacy'] is False

def test_serializer_is_legacy_true_for_legacy(api_client):
    contact = ContactFactory()
    ContactLegacyOriginFactory(contact=contact)
    s = ContactSerializer(contact)
    assert s.data['is_legacy'] is True

def test_list_contact_includes_is_legacy(api_client, admin_user):
    contact = ContactFactory()
    ContactLegacyOriginFactory(contact=contact)
    api_client.force_authenticate(admin_user)
    r = api_client.get('/api/contacts/contacts/?page=1')
    assert any(c['is_legacy'] for c in r.data if isinstance(c, dict))
```

## DoD

- [ ] Contact vivo: `is_legacy=False`.
- [ ] Contact con `ContactLegacyOrigin`: `is_legacy=True`.
- [ ] 3+ tests pasan.

## Comandos de verificación

```bash
pytest backend/contacts/tests/test_api_legacy.py -v
```

## Riesgos

- **`select_related('legacy_origin')` siempre se ejecuta**: 1 query JOIN adicional. Aceptable.
