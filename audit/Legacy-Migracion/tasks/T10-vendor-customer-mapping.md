# T10 — Vendor/customer mapping

> **Phase**: 3
> **Tiempo estimado**: 30 min
> **Complejidad**: media

## Precondiciones

- [ ] T06 cerrada.
- [ ] T08 cerrada.

## Archivos a tocar/crear

- `backend/legacy/importers/orders.py` (extender con `map_vendor_customer`).
- `backend/legacy/tests/test_vendor_mapping.py`.

## Implementación

```python
# backend/legacy/importers/orders.py
def map_vendor_customer(customer_id, vendor: LegacyVendor):
    """vendor.category='interno' → customer=cliente, related_contact=None, vendor=asociado.
       vendor.category='externo' → customer=vendor (como Contact sombra), related_contact=cliente original."""
    if vendor.category == LegacyVendor.INTERNAL:
        return customer_id, None, vendor
    else:  # EXTERNAL
        vendor_contact = _get_or_create_vendor_contact(vendor)
        return vendor_contact.id, customer_id, vendor


def _get_or_create_vendor_contact(vendor: LegacyVendor) -> 'Contact':
    """Crea (o recupera) un Contact 'sombra' para el vendor externo.
       Marcado con ContactLegacyOrigin(source_table='vendedores')."""
    origin = ContactLegacyOrigin.objects.filter(
        source_table='vendedores',
        legacy_external_id=vendor.legacy_external_id,
    ).select_related('contact').first()

    if origin:
        return origin.contact

    contact = Contact.objects.create(
        name=vendor.name,
        tax_id='',
        email='',
        phone='',
        address='',
    )
    ContactLegacyOrigin.objects.create(
        contact=contact,
        source_table='vendedores',
        legacy_external_id=vendor.legacy_external_id,
        raw_tax_id='',
        tax_id_exception=True,  # siempre, porque no tienen RUT
    )
    return contact
```

## Mapeo por caso

### Caso A: vendor `interno` (futuro)

| Campo | Valor |
|---|---|
| `LegacySaleNote.customer` | `cliente_id` (FK al Contact del cliente original) |
| `LegacySaleNote.related_contact` | `None` |
| `LegacySaleNote.vendor` | `vendor` (LegacyVendor) |

### Caso B: vendor `externo` (100% del dataset actual)

| Campo | Valor |
|---|---|
| `LegacySaleNote.customer` | `vendor_as_contact.id` (Contact sombra del vendor) |
| `LegacySaleNote.related_contact` | `cliente_id` (FK al Contact del cliente original) |
| `LegacySaleNote.vendor` | `vendor` (LegacyVendor) |

## Tests

```python
# test_vendor_mapping.py
def test_vendor_externo_makes_related_contact():
    vendor = LegacyVendorFactory(category='externo', legacy_external_id=10, name='Vendor X')
    customer_id = 100
    cust_id, rel_id, v = map_vendor_customer(customer_id, vendor)
    assert cust_id != customer_id  # es el Contact sombra
    assert rel_id == customer_id  # el cliente original queda como related
    assert v == vendor

def test_vendor_interno_keeps_related_none():
    vendor = LegacyVendorFactory(category='interno')
    cust_id, rel_id, v = map_vendor_customer(100, vendor)
    assert cust_id == 100
    assert rel_id is None

def test_vendor_sombra_se_crea_una_sola_vez():
    vendor = LegacyVendorFactory(category='externo', legacy_external_id=20)
    c1 = _get_or_create_vendor_contact(vendor)
    c2 = _get_or_create_vendor_contact(vendor)
    assert c1.id == c2.id
```

## DoD

- [ ] `map_vendor_customer` funciona para ambos `category`.
- [ ] `_get_or_create_vendor_contact` es idempotente.
- [ ] 4+ tests pasan.

## Comandos de verificación

```bash
pytest backend/legacy/tests/test_vendor_mapping.py -v
```

## Riesgos

- **Confusión semántica**: el frontend debe mostrar claramente que el "cliente" de una NV legacy con vendor externo es el vendor, no el cliente original. Esto se resuelve con el `SaleOrderReadOnlyView` (T30) que muestra ambos.
- **Vendor sombra sin RUT**: `tax_id=''` y `tax_id_exception=True` lo marca como "no identificable". Aceptable.
