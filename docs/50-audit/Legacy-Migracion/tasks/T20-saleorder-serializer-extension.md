# T20 — `SaleOrderSerializer` extension

> **Phase**: 6
> **Tiempo estimado**: 15 min
> **Complejidad**: baja

## Precondiciones

- [ ] T19 cerrada.

## Archivos a tocar/crear

- `backend/sales/serializers.py::SaleOrderSerializer`.

## Implementación

```python
# backend/sales/serializers.py
class SaleOrderSerializer(serializers.ModelSerializer):
    is_legacy = serializers.SerializerMethodField()
    legacy_external_id = serializers.SerializerMethodField()

    class Meta:
        model = SaleOrder
        fields = [..., 'is_legacy', 'legacy_external_id']  # agregar al final
        # ... resto ...

    def get_is_legacy(self, obj):
        # El adapter ya tiene is_legacy; el modelo SaleOrder no.
        return getattr(obj, 'is_legacy', False)

    def get_legacy_external_id(self, obj):
        return getattr(obj, 'legacy_external_id', None)
```

**Por qué `getattr` y no `hasattr` directamente**: más conciso, no rompe si el atributo no existe.

## Tests

```python
def test_serializer_is_legacy_false_for_normal(api_client):
    order = SaleOrderFactory()
    s = SaleOrderSerializer(order)
    assert s.data['is_legacy'] is False
    assert s.data['legacy_external_id'] is None

def test_serializer_is_legacy_true_for_adapter():
    note = LegacySaleNoteFactory()
    adapter = LegacySaleNoteAsSaleOrderShape(note)
    s = SaleOrderSerializer(adapter)
    assert s.data['is_legacy'] is True
    assert s.data['legacy_external_id'] == note.legacy_external_id
```

## DoD

- [ ] SaleOrder vivo: `is_legacy=False`, `legacy_external_id=None`.
- [ ] Adapter LegacySaleNote: `is_legacy=True`, `legacy_external_id=<id>`.
- [ ] 2+ tests pasan.

## Comandos de verificación

```bash
pytest backend/sales/tests/test_api_legacy.py -v
```

## Riesgos

- **`fields = [...]` debe preservar el orden**: los nuevos campos van al final para no romper consumidores.
