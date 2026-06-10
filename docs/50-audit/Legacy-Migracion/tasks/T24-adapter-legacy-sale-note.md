# T24 — Adapter `LegacySaleNoteAsSaleOrderShape`

> **Phase**: 6
> **Tiempo estimado**: 15 min
> **Complejidad**: baja

## Precondiciones

- [ ] T02 cerrada (LegacySaleNote existe).

## Archivos a tocar/crear

- `backend/legacy/adapters.py`.

## Implementación

Ver `05-backend-api.md` §2 para el código completo. Resumen:

```python
# backend/legacy/adapters.py
class LegacySaleNoteAsSaleOrderShape:
    """Adapta LegacySaleNote para que sea indistinguible de SaleOrder
    en el serializer. Duck-typing puro."""

    def __init__(self, note):
        self._n = note

    @property
    def id(self): return self._n.id
    @property
    def number(self): return self._n.legacy_number
    @property
    def issue_date(self): return self._n.issue_date
    @property
    def customer(self): return self._n.customer
    @property
    def related_contact(self): return self._n.related_contact
    @property
    def vendor(self): return self._n.vendor
    @property
    def status(self): return self._n.status
    @property
    def net_price(self): return self._n.net_price
    @property
    def tax_amount(self): return self._n.tax_amount
    @property
    def total_price(self): return self._n.total_price
    @property
    def description(self): return self._n.description
    @property
    def is_legacy(self): return True
    @property
    def legacy_external_id(self): return self._n.legacy_external_id
    @property
    def work_order(self): return self._n.work_order
    @property
    def created_at(self): return self._n.created_at
    @property
    def updated_at(self): return self._n.updated_at
```

## Tests

```python
# test_adapters.py
def test_adapter_expone_todos_los_atributos_esperados():
    note = LegacySaleNoteFactory()
    adapter = LegacySaleNoteAsSaleOrderShape(note)
    for attr in ('id', 'number', 'issue_date', 'customer', 'related_contact',
                 'vendor', 'status', 'net_price', 'tax_amount', 'total_price',
                 'description', 'is_legacy', 'legacy_external_id',
                 'work_order', 'created_at', 'updated_at'):
        assert hasattr(adapter, attr), f"Atributo {attr} falta"

def test_is_legacy_siempre_true():
    note = LegacySaleNoteFactory()
    adapter = LegacySaleNoteAsSaleOrderShape(note)
    assert adapter.is_legacy is True

def test_legacy_external_id_es_int():
    note = LegacySaleNoteFactory(legacy_external_id=12345)
    adapter = LegacySaleNoteAsSaleOrderShape(note)
    assert adapter.legacy_external_id == 12345
```

## DoD

- [ ] Adapter expone los 17 atributos.
- [ ] `is_legacy` siempre `True`.
- [ ] 3+ tests pasan.

## Comandos de verificación

```bash
pytest backend/legacy/tests/test_adapters.py -v
```

## Riesgos

- **Si se agrega un campo a `SaleOrder`**, hay que recordar agregarlo al adapter. Documentar en el contrato de adapter.
