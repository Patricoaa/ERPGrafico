# T24 — `LegacySaleNoteSerializer`

> **Phase**: 6
> **Tiempo estimado**: 20 min
> **Complejidad**: baja

Serializer dedicado que emite el **mismo shape JSON** que `SaleOrderSerializer` para una NV legacy (mismos nombres de campo). Reemplaza el adapter "duck-typed" del plan previo, que no encajaba con el `SaleOrderSerializer` real (ver `05-backend-api.md` §2).

## Precondiciones

- [ ] T02 cerrada (LegacySaleNote existe).
- [ ] Revisado `sales/serializers.py::SaleOrderSerializer` (campos y method-fields reales).

## Archivos a tocar/crear

- `backend/legacy/serializers.py`.

## Implementación

Ver `05-backend-api.md` §2 para el código completo. Resumen:

```python
# backend/legacy/serializers.py
from django.db.models import Sum
from rest_framework import serializers
from legacy.models import LegacySaleNote


class LegacySaleNoteSerializer(serializers.ModelSerializer):
    customer = serializers.PrimaryKeyRelatedField(read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    date = serializers.DateField(source='issue_date', read_only=True)
    total_net = serializers.IntegerField(source='net_price', read_only=True)
    total_tax = serializers.IntegerField(source='tax_amount', read_only=True)
    total = serializers.IntegerField(source='total_price', read_only=True)
    total_paid = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    is_legacy = serializers.SerializerMethodField()
    legacy_external_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = LegacySaleNote
        fields = [
            'id', 'number', 'display_id', 'customer', 'customer_name', 'date',
            'status', 'total_net', 'total_tax', 'total', 'total_paid',
            'pending_amount', 'is_legacy', 'legacy_external_id', 'description',
            'is_pending', 'category_snapshot',
        ]

    def get_total_paid(self, obj):
        return obj.legacy_payments.aggregate(s=Sum('amount'))['s'] or 0

    def get_pending_amount(self, obj):
        return max(0, obj.total_price - self.get_total_paid(obj))  # 7 NVs sobrepagadas → clamp a 0

    def get_is_legacy(self, obj):
        return True
```

> `number` y `display_id` son properties del modelo `LegacySaleNote` (`number = legacy_number`; `display_id = f"NV-{legacy_external_id}"`).

## Tests

```python
# test_serializers.py
def test_shape_compatible_con_saleorder():
    note = LegacySaleNoteFactory()
    data = LegacySaleNoteSerializer(note).data
    for field in ('id', 'number', 'customer', 'customer_name', 'date',
                  'status', 'total_net', 'total_tax', 'total', 'total_paid',
                  'pending_amount', 'is_legacy', 'legacy_external_id'):
        assert field in data

def test_is_legacy_siempre_true():
    assert LegacySaleNoteSerializer(LegacySaleNoteFactory()).data['is_legacy'] is True

def test_pending_amount_no_negativo():
    # NV sobrepagada → pending_amount = 0 (no negativo)
    ...
```

## DoD

- [ ] El serializer emite los mismos nombres de campo que `SaleOrderSerializer` (`date`, `total_net`, `total_tax`, `total`, `total_paid`, `pending_amount`, …).
- [ ] `is_legacy` siempre `True`; `pending_amount` nunca negativo.
- [ ] 3+ tests pasan.

## Comandos de verificación

```bash
pytest backend/legacy/tests/test_serializers.py -v
```

## Riesgos

- **Si se agrega un campo a `SaleOrderSerializer`** que el frontend espere también en NVs legacy, hay que reflejarlo aquí. Documentar en el contrato del serializer.
