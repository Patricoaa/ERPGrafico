---
layer: 90-governance
doc: zero-n-plus-one-policy
status: active
owner: backend-team
created: 2026-06-25
last_review: 2026-06-25
stability: contract-changes-require-ADR
---

# Zero N+1 Policy (Backend)

Las consultas N+1 son la causa más común de degradación de rendimiento en APIs Django/DRF. Esta política define las reglas que previenen su aparición y los mecanismos de enforcement.

---

## Por qué N+1 es catastrófico

Cuando un endpoint de lista devuelve **P** objetos y el serializador ejecuta **Q** queries por objeto, el total de queries es `1 + (P × Q)`. Con paginación de 50 objetos y 3 relaciones consultadas en el serializador, son **151 queries por request**. Si el número de páginas activas en simultáneo es 10, son **1.510 queries/segundo** para una sola pantalla. Eso colapsa PostgreSQL antes de que el negocio escale.

---

## Regla 1 — Los Serializadores son "Tontos" (MUST)

> **Un `Serializer` o `SerializerMethodField` NUNCA ejecuta queries ORM.**

Queda **prohibido** usar cualquiera de los siguientes patrones dentro de `serializers.py`:

```python
# ❌ PROHIBIDO — Query dentro de SerializerMethodField
def get_pending_amount(self, obj):
    total = PaymentAllocation.objects.filter(invoice=obj).aggregate(...)
    return obj.total - total

# ❌ PROHIBIDO — .get() dentro de serializer
def get_uom_name(self, obj):
    return UoM.objects.get(pk=obj.uom_id).name

# ❌ PROHIBIDO — Mutación dentro de serializer
def update(self, instance, validated_data):
    EmployeeConceptAmount.objects.update_or_create(employee=instance, ...)

# ❌ PROHIBIDO — Crear objetos relacionados dentro de serializer.create()
def create(self, validated_data):
    product = Product.objects.create(**validated_data)
    BillOfMaterials.objects.create(product=product, ...)   # ← fuera del serializer
```

---

## Regla 2 — El ViewSet es Responsable de Precargar (MUST)

Toda relación que el serializador necesite para construir la respuesta **MUST** precargarse en la propiedad `queryset` del ViewSet o en su método `get_queryset()`.

```python
# ✅ CORRECTO — ViewSet precarga todo lo necesario
class InvoiceViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return (
            Invoice.objects.all()
            .select_related('sale_order__customer', 'purchase_order__supplier', 'contact')
            .prefetch_related(
                'payments',
                Prefetch('paymentallocation_set', queryset=PaymentAllocation.objects.select_related('treasury_movement')),
                'note_sale_lines',
                'note_purchase_lines',
            )
            .order_by('-date', '-id')
        )
```

### Guía de elección: `select_related` vs `prefetch_related`

| Situación | Usar |
|-----------|------|
| FK directa o OneToOne (campo del modelo mismo) | `select_related('campo')` — hace JOIN en SQL |
| Relación inversa (`related_name`) o M2M | `prefetch_related('campo')` — hace query separada y cachea |
| FK inversa con filtro propio | `Prefetch('campo', queryset=MiModelo.objects.filter(...))` |

---

## Regla 3 — El Serializador Lee de la RAM (MUST)

Una vez que el ViewSet precargó la relación, el serializador accede con `.all()` sobre el manager relacionado. Si el prefetch está activo, `.all()` **no** emite query; lee del caché en memoria.

```python
# ✅ CORRECTO — Itera el prefetch en memoria, cero queries adicionales
def get_pending_amount(self, obj):
    total_paid = sum(p.amount for p in obj.payments.all())           # RAM
    total_alloc = sum(a.amount for a in obj.paymentallocation_set.all())  # RAM
    return obj.total - (total_paid + total_alloc)

# ✅ CORRECTO — FK simple ya resuelta por select_related
def get_customer_name(self, obj):
    return obj.sale_order.customer.name   # sin query — JOIN ya en SQL
```

---

## Regla 4 — La Creación/Mutación de Objetos Relacionados va en `services.py` (MUST)

Los métodos `.create()` y `.update()` de los serializadores **solo** deben instanciar el modelo raíz. Toda creación de grafos de objetos debe delegarse a un método de `services.py` decorado con `@transaction.atomic`.

```python
# ❌ PROHIBIDO — crear N objetos dentro del serializer
class ProductSerializer(ModelSerializer):
    def create(self, validated_data):
        boms = validated_data.pop('boms', [])
        product = Product.objects.create(**validated_data)
        for bom_data in boms:
            BillOfMaterials.objects.create(product=product, **bom_data)  # ← no aquí
        return product

# ✅ CORRECTO — delegar al service
class ProductSerializer(ModelSerializer):
    def create(self, validated_data):
        return InventoryService.create_product_with_bom(validated_data)
```

```python
# services.py
class InventoryService:
    @transaction.atomic
    def create_product_with_bom(cls, data: dict) -> Product:
        boms = data.pop('boms', [])
        product = Product.objects.create(**data)
        for bom_data in boms:
            bom = BillOfMaterials.objects.create(product=product, **bom_data)
            for line in bom_data.pop('lines', []):
                BillOfMaterialsLine.objects.create(bom=bom, **line)
        return product
```

---

## Regla 5 — Test Obligatorio de Conteo de Queries (MUST para listas)

Todo endpoint de lista expuesto en un nuevo ViewSet **MUST** incluir un test con `assertNumQueries` que verifique que la cantidad de queries **no crece con el número de registros** (O(1) con respecto a N).

```python
# backend/<app>/tests/test_views.py
class InvoiceQueryCountTest(TestCase):
    def test_list_invoice_query_count_is_constant(self):
        """Verifica O(1): serializar 1 o 20 facturas usa el mismo N de queries."""
        InvoiceFactory.create_batch(20)

        with self.assertNumQueries(4):   # ajustar al número real tras fijar prefetches
            response = self.client.get('/api/billing/invoices/')
        self.assertEqual(response.status_code, 200)
```

> **Nota:** El número exacto de queries (ej. `4`) depende del viewset. Lo importante es que ese número sea **fijo e independiente del tamaño del batch**. Si agregas 100 registros más y el test falla, hay un N+1.

---

## Antipatrones conocidos y su corrección

| Antipatrón | Dónde aparece hoy | Corrección |
|---|---|---|
| `PaymentAllocation.objects.filter(invoice=obj)` en serializer | `billing/serializers.py` | Prefetch `paymentallocation_set` en `InvoiceViewSet` |
| `SaleReturnLine.objects.filter(...)` en serializer | `billing/serializers.py` | Prefetch `note_sale_lines` con `select_related('product')` |
| `PurchaseLine.objects.filter(product=obj)` en serializer | `inventory/serializers.py` | Prefetch `purchaseline_set` en `ProductViewSet` |
| `Attachment.objects.filter(content_type=..., object_id=...)` en serializer | `production/serializers.py` | `GenericRelatedObjectManager` via `prefetch_related` con `GenericRelatedField` |
| `EmployeeConceptAmount.objects.update_or_create(...)` en serializer | `hr/serializers.py` | Mover lógica a `HRService.update_employee_concepts()` |
| `BillOfMaterials.objects.create(...)` en serializer | `inventory/serializers.py`, `production/serializers.py` | Delegar a `InventoryService.create_product_with_bom()` |

---

## Enforcement mecánico

| Mecanismo | Estado | Severidad |
|-----------|--------|-----------|
| `assertNumQueries` en tests de lista | 🔴 Pendiente (deuda técnica) | `error` — test falla en CI |
| Grep en CI: `objects\.(filter\|get\|create)` dentro de `serializers.py` | 🔴 Pendiente | `warning` (propuesto) |
| Review manual (checklist del PR) | ✅ Activo desde 2026-06-25 | Bloqueante para merge |

---

## Review checklist

- [ ] No hay llamadas `.objects.filter()` / `.get()` / `.create()` dentro de ningún `serializers.py`.
- [ ] El ViewSet que sirve el endpoint tiene `select_related` y `prefetch_related` declarados.
- [ ] Las relaciones iteradas en el serializador están en la lista de prefetches.
- [ ] Toda creación de grafo de objetos está en `services.py` con `@transaction.atomic`.
- [ ] El test de conteo de queries existe y pasa (`assertNumQueries`).

---

## Referencias

- Contrato global de performance: [docs/40-quality/performance.md](../40-quality/performance.md)
- Contrato de API (regla inline): [docs/20-contracts/api-contracts.md §Serializer Integrity](../20-contracts/api-contracts.md#serializer-integrity--performance-zero-n1)
- Playbook de selectores: [docs/30-playbooks/add-selector.md](../30-playbooks/add-selector.md)
- Auditoría de deuda técnica: [docs/50-audit/n-plus-one-backlog.md](../50-audit/n-plus-one-backlog.md) _(a crear)_
