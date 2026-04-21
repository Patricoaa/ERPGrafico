---
layer: 10-architecture
doc: data-flow
status: active
owner: core-team
last_review: 2026-04-21
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

Hooks do NOT expose `error` — UI gets toast; component branches on `isLoading` / `isError` via TanStack if needed for skeleton fallback.

## Real-time (future)

Reserved: Django Channels + WebSocket for workflow transitions. Not yet implemented. Place ADR before adding.
