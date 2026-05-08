---
layer: 10-architecture
doc: data-flow
status: active
owner: core-team
last_review: 2026-04-23
---

# Data Flow

End-to-end lifecycle for read and write operations.

## Read flow

```
┌──────────────────┐
│ Component mounts │
└────────┬─────────┘
         │ calls
┌────────▼────────────────┐
│ feature hook            │ useSaleOrders()
│ - wraps useQuery        │
│ - queryKey: ['sales',…] │
└────────┬────────────────┘
         │ if cache miss
┌────────▼────────────┐
│ axios (lib/api.ts)  │ GET /api/sales/orders/
│ - JWT interceptor   │
│ - error interceptor │
└────────┬────────────┘
         │ HTTP
┌────────▼─────────┐
│ Django ViewSet   │ list()
└────────┬─────────┘
         │ calls
┌────────▼─────────┐
│ selector         │ sales.selectors.list_orders(filters)
│ - optimizes JOIN │
└────────┬─────────┘
         │ ORM
┌────────▼─────┐
│ PostgreSQL   │
└──────────────┘
```

## Write flow

```
User action (form submit)
   ↓
react-hook-form validates (Zod schema)
   ↓
feature mutation hook  (useCreateSaleOrder)
   ↓ useMutation
axios POST /api/sales/orders/
   ↓
DRF ViewSet.create
   ↓
Serializer.is_valid()   ← boundary validation
   ↓
Service.create(...)     ← business rules, atomic tx
   ↓ may
Celery enqueue          (async side effects: PDF, email)
   ↓
Response 201
   ↓
TanStack Query invalidates affected keys
   ↓
Dependent queries refetch in background
   ↓
UI updates
```

## Cache invalidation rules

| Mutation | Invalidate queryKeys |
|----------|---------------------|
| Create/update/delete `SaleOrder` | `['sales']`, `['orders-hub']`, `['stock']` if affects inventory |
| Create `Invoice` | `['billing']`, `['sales', saleOrderId]` |
| Transition workflow state | `[entity]`, `['workflow', entity, id]` |

Rule of thumb: invalidate parent list + parent detail + any aggregate view.

## Optimistic updates — when allowed

Allowed only for:
- Single-field toggles (archive, favorite).
- Comments / attachments append.

Forbidden for:
- Any mutation affecting folio, stock, or ledger — must wait for server confirmation.

## Error propagation

| Origin | Handled by |
|--------|-----------|
| Zod validation (form) | `react-hook-form` — inline field errors |
| DRF 400 validation | axios interceptor → `showApiError(toast)` + re-throw for hook |
| DRF 401 | axios interceptor → refresh token attempt → redirect login on failure |
| DRF 403 | toast "No permission" — no retry |
| DRF 5xx | toast + Sentry capture + TanStack retry (3x exponential) |

Hooks do NOT expose `error` (the Error object) — UI gets toast via `showApiError`. `isError: boolean` MAY appear in a hook's return shape when the component needs to branch on error state (e.g. render `EmptyState` instead of `Skeleton`); the raw error object is never exposed.

## Real-time (future)

Reserved: Django Channels + WebSocket for workflow transitions. Not yet implemented. Place ADR before adding.

---

## F5 — Modelo de datos post-refactor (actualizado 2026-05-08)

### Relaciones polimórficas via GenericForeignKey

Tres modelos ahora usan GFK para expresar relaciones polimórficas de origen:

```
JournalEntry
  └─ source_content_type → ContentType   (FK, indexed)
  └─ source_object_id    → int
  └─ source_document     → GFK           ← acceso read

TreasuryMovement
  └─ allocated_content_type → ContentType
  └─ allocated_object_id    → int
  └─ allocated_to            → GFK

Invoice
  └─ source_content_type → ContentType
  └─ source_object_id    → int
  └─ source_order         → GFK
```

**Queries eficientes con GFK:**
```python
# En lugar de N queries hasattr:
entries = JournalEntry.objects.select_related('source_content_type')[:100]
for e in entries:
    info = e.source_info  # 0 queries adicionales (ct ya cargado)

# Para listados masivos, agrupar por tipo:
from django.contrib.contenttypes.models import ContentType
invoice_ct = ContentType.objects.get_for_model(Invoice)
invoice_entries = entries.filter(source_content_type=invoice_ct)
invoices = Invoice.objects.in_bulk(invoice_entries.values_list('source_object_id', flat=True))
```

**Columnas legacy (ventana de deprecación):**

Las siguientes columnas siguen existiendo en DB pero no reciben datos nuevos:
- `accounting_journalentry.invoice_id`, `.payment_id`, `.sale_order_id`, `.purchase_order_id`
- `treasury_treasurymovement.invoice_id`, `.sale_order_id`, `.purchase_order_id`, `.payroll_id`
- `billing_invoice.sale_order_id`, `.purchase_order_id`

Se eliminarán en una migration separada (sprint +1) tras verificar con `grep` que ningún código las referencia directamente.

---

### ProductTypeStrategy — routing de lógica por tipo de producto

```python
# inventory/strategies/product_type.py
strategy = get_product_type_strategy(product.product_type)

# En vez de: if product.product_type == 'STORABLE': ...
account = strategy.get_asset_account(product)
strategy.validate(product)  # lanza ValidationError si inconsistente
```

| Tipo | tracks_inventory | can_have_bom | costing |
|------|-----------------|--------------|---------|
| CONSUMABLE | No | No | none |
| STORABLE | Sí | No | average |
| MANUFACTURABLE | Sí | Sí | average |
| SERVICE | No | No | none |
| SUBSCRIPTION | No | No | none |

---

### ProductManufacturingProfile — campos mfg_* extraídos

Para productos MANUFACTURABLE, los campos de configuración de fabricación viven en:
```python
product.manufacturing_profile.mfg_auto_finalize
product.manufacturing_profile.mfg_enable_prepress
# ... etc.
# Shortcut: product.mfg_profile (property, retorna None si no existe)
```

Los campos `Product.mfg_*` (legacy) permanecen en DB durante la ventana de deprecación.

