# T20 — `SaleOrderSerializer` extension

> **Phase**: 6
> **Tiempo estimado**: 15 min
> **Complejidad**: baja

## Precondiciones

- [ ] T19 cerrada.

## Archivos a tocar/crear

- `backend/sales/serializers.py::SaleOrderSerializer`.

## Implementación

> Los `SaleOrder` vivos **nunca** son legacy. Las NVs legacy se serializan con `LegacySaleNoteSerializer` (T24), no pasan por este serializer. Por eso `is_legacy`/`legacy_external_id` son constantes aquí — existen solo para mantener el mismo shape JSON en la lista unificada.

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
        return False

    def get_legacy_external_id(self, obj):
        return None
```

## Tests

```python
def test_serializer_is_legacy_false_for_normal(api_client):
    order = SaleOrderFactory()
    s = SaleOrderSerializer(order)
    assert s.data['is_legacy'] is False
    assert s.data['legacy_external_id'] is None
```

> El caso `is_legacy=True` se prueba en T24 (`LegacySaleNoteSerializer`), no aquí.

## DoD

- [ ] SaleOrder vivo: `is_legacy=False`, `legacy_external_id=None`.
- [ ] El shape incluye ambos campos (consumido por el frontend igual que en NVs legacy).
- [ ] Test pasa.

## Comandos de verificación

```bash
pytest backend/sales/tests/test_api_legacy.py -v
```

## Riesgos

- **`fields = [...]` debe preservar el orden**: los nuevos campos van al final para no romper consumidores.
