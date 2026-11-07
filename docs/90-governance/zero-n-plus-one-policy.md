---
layer: 90-governance
doc: zero-n-plus-one-policy
status: active
owner: backend-team
created: 2026-06-25
last_review: 2026-11-06
stability: contract-changes-require-ADR
---

# Zero N+1 Policy (Backend)

Las consultas N+1 son la causa más común de degradación de rendimiento en APIs Django/DRF. Esta política define las reglas que previenen su aparición y los mecanismos de enforcement.

---

## Por qué N+1 es catastrófico

Cuando un endpoint de lista devuelve **P** objetos y el serializador ejecuta **Q** queries por objeto, el total de queries es `1 + (P × Q)`. Con paginación de 50 objetos y 3 relaciones consultadas en el serializador, son **151 queries por request**. Si el número de páginas activas en simultáneo es 10, son **1.510 queries/segundo** para una sola pantalla. Eso colapsa PostgreSQL antes de que el negocio escale.

---

## Regla 1 — Los Serializadores son "Tontos" (MUST)

> **El número de queries de un listado no crece con sus filas, sea cual sea el camino que las genere** (ADR-0118). Un `Serializer` o `SerializerMethodField` tampoco ejecuta queries ORM.

Cumplir la lista de abajo no basta: también cuentan las propiedades del modelo que consultan (`product.qty_available`) y las cadenas sobre managers que descartan la precarga (`user.groups.select_related("profile").all()`). Una propiedad que consulta debe leer primero su valor precalculado (`annotated_*`).

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

Toda relación que el serializador necesite para construir la respuesta **MUST** precargarse en un selector usado por `get_queryset()`.

**Precargar solo lo que se lee (MUST).** `select_related` cubre únicamente las relaciones de las que la respuesta lee algo más que el id; un campo que solo expone el id no necesita join. Cada join de más cuesta tiempo de planificación: el listado de productos con 8 relaciones tardaba ~300 ms en planificarse y ~5 ms en ejecutarse. Sobre 5 joins, revisar también `Planning Time` con `EXPLAIN (ANALYZE)`.

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

Todo endpoint de lista que se cree o modifique **MUST** tener un test con la marca `ci_gate` que compare el conteo con 1 fila y con N filas, con **cada relación que el serializador lee poblada**.

```python
pytestmark = pytest.mark.ci_gate

def test_list_query_count_does_not_grow_with_rows(client):
    make_invoice_with_lines_and_payments()  # relaciones pobladas, no filas vacías
    with CaptureQueriesContext(connection) as one_row:
        client.get("/api/billing/invoices/")

    for _ in range(5):
        make_invoice_with_lines_and_payments()
    with CaptureQueriesContext(connection) as many_rows:
        client.get("/api/billing/invoices/")

    assert len(many_rows) <= len(one_row)
```

Se usa `<=` porque la primera petición de un proceso puede hacer alguna query de caché; con `==` el test depende del orden y del motor de base de datos.

> **Un máximo absoluto sobre filas vacías no prueba nada:** `sales/tests/test_performance.py` listaba órdenes sin líneas con un máximo de 15 queries y pasaba mientras los datos reales hacían 199.

---

## Regla 6 — Lectura y Escritura No Comparten una Foto (MUST)

Un queryset con valores calculados (`annotated_*`) o `Prefetch` filtrados se usa solo en respuestas (`list`, `retrieve`). Las acciones de escritura usan el queryset base: si validaran stock contra un valor precalculado al inicio de la petición, podrían aprobar con datos desactualizados.

```python
def get_queryset(self):
    if self.action in {"list", "retrieve"}:
        return SaleOrderSelector.get_read_queryset()
    return SaleOrderSelector.get_base_queryset()
```

---

## Regla 7 — Un Serializer Anidado por Respuesta (MUST)

DRF reconstruye los campos de un `ModelSerializer` en cada instancia. Dentro de un `SerializerMethodField`, instanciar uno por fila cuesta más que serializar los datos (`lines`: ~189 ms, sus campos: ~12 ms). Se instancia una vez y se reutiliza:

```python
@cached_property
def _line_serializer(self):
    return SaleLineSerializer()

def get_lines(self, obj):
    return [self._line_serializer.to_representation(line) for line in obj.lines.all()]
```

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
| Tests con marca `ci_gate` (`pytest -m ci_gate`) | ⚠️ Listos; sin efecto mientras `CI Pipeline` siga deshabilitado (ver [ci-cd.md](../40-quality/ci-cd.md)) | Bloqueante una vez activo |
| Review manual (checklist del PR) | ✅ Activo desde 2026-06-25 | Bloqueante para merge |

---

## Review checklist

- [ ] El número de queries no crece con las filas, tampoco por propiedades del modelo ni cadenas sobre managers.
- [ ] No hay llamadas ORM de consulta o escritura dentro de ningún `serializers.py`.
- [ ] `select_related` cubre solo las relaciones de las que se lee algo más que el id; sobre 5 joins se revisó `Planning Time`.
- [ ] Los valores calculados y `Prefetch` filtrados se usan solo en `list` y `retrieve`.
- [ ] Ningún serializer anidado se instancia por fila.
- [ ] Toda creación de grafo de objetos está en `services.py` con `@transaction.atomic`.
- [ ] El test compara 1 fila contra N, con relaciones pobladas y marca `ci_gate`.

---

## Referencias

- Contrato global de performance: [docs/40-quality/performance.md](../40-quality/performance.md)
- Contrato de API (regla inline): [docs/20-contracts/api-contracts.md §Serializer Integrity](../20-contracts/api-contracts.md#serializer-integrity--performance-zero-n1)
- Decisión: [ADR-0118](../10-architecture/adr/0118-zero-n-plus-one-by-behavior-and-ci-gate.md)
- Playbook de selectores: [docs/30-playbooks/add-selector.md](../30-playbooks/add-selector.md)
- Auditoría de deuda técnica: `docs/50-audit/n-plus-one-backlog.md` _(a crear)_
