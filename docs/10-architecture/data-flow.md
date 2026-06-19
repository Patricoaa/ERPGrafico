---
layer: 10-architecture
doc: data-flow
status: active
owner: core-team
last_review: 2026-05-21
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

## Real-time

Implemented via **Django Channels (bidirectional WebSocket)** and **SSE (unidirectional broadcast)**. See the canonical contract at [`../20-contracts/realtime-channels.md`](../20-contracts/realtime-channels.md) — what is in production today, WS vs SSE decision, auth, backend+frontend patterns.

---

## F5 — Modelo de datos post-refactor

> **Authoritative source:** [ADR-0016 — Post-Refactor F5 GenericForeignKey + ProductTypeStrategy](adr/0016-post-refactor-architecture-f5.md). Any evolution of the F5 model (polymorphic relations, product strategy, ProductManufacturingProfile) **is documented in that ADR**, not here. This summary is a quick reference; in case of divergence with the ADR, the ADR wins.

Resumen para orientación:

- **GenericForeignKey** en `JournalEntry`, `TreasuryMovement`, `Invoice` reemplaza FKs explícitas hacia documentos origen. Cargar siempre con `select_related('source_content_type')` para evitar N+1.
- **ProductTypeStrategy** (`inventory/strategies/product_type.py`) elimina los `if product.product_type == ...`: 5 tipos (CONSUMABLE, STORABLE, MANUFACTURABLE, SERVICE, SUBSCRIPTION) con tabla de capacidades en el ADR.
- **ProductManufacturingProfile** (1:1 con `Product`) extrae los campos `mfg_*` de productos MANUFACTURABLE. Shortcut `product.mfg_profile`.
- **Columnas legacy** (FKs directos en `JournalEntry`, `TreasuryMovement`, `Invoice`) siguen en DB pero ya no reciben writes. Migration de eliminación pendiente — ver ADR-0016 §"Deprecation window".

