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


## Procedencia del precio en líneas de venta

`SaleLine` registra de dónde salió su precio (base de la analítica de reglas de precio por producto):

- `pricing_rule` (FK a `PricingRule`, `SET_NULL`): regla aplicada, nula si no hubo ninguna.
- `list_unit_price_gross`: precio bruto antes de las reglas.
- `price_source`: `LIST` · `UOM_PRICE` · `RULE` · `MANUAL`.

Los sella `SalesService.create_sale_order` (camino único de pedidos y POS, vía `SalesService._price_provenance`) al crear la línea. El backend vuelve a resolver el precio con `PricingService.resolve_product_price` y lo compara con el `unit_price_gross` enviado (o con el neto, con tolerancia de 1 peso): si coincide registra la regla y el origen; si no, `MANUAL` sin regla. `MANUAL` significa «distinto de lo que el backend resuelve al crear», no necesariamente «editado por el usuario» (p. ej. un precio de lista enviado cuando correspondía una regla, porque falló la consulta de precio del cliente, también queda `MANUAL`). Un fallo al resolver la procedencia se registra en el log y deja los campos nulos: nunca bloquea la venta. Los descuentos (`discount_percentage`, `discount_amount`) no intervienen en la comparación.

Los campos no son editables por el cliente. Quedan nulos en líneas anteriores a su existencia (sin backfill), en líneas de notas de débito y en despachos suplementarios. `PricingService.get_product_price` delega en `resolve_product_price` y no cambia su resultado.

Cómo se derivan neto y bruto del precio de venta (el bruto es la autoridad, el neto se deriva con `accounting/vat.py`) está en [ADR-0151](adr/0151-bruto-autoridad-unica-del-precio-de-venta.md).

### Ingreso neto de descuentos (ADR-0145)

El ingreso por línea de despacho confirmada es `quantity × unit_price × (1 − ratio)`, con `ratio = clamp(sale_line.discount_amount / (sale_line.quantity × sale_line.unit_price_gross), 0, 1)`, o 0 si la línea no tiene precio bruto (igual que `SaleLine.calculate_subtotal`); el descuento se prorratea por unidad despachada. El margen resta el `unit_cost` congelado en el despacho. `insights` y `GET /inventory/products/{id}/sales-impact/` comparten la expresión (`net_revenue_expression`), por lo que las cifras coinciden.

### Costo real de fabricación (ADR-0146)

El costo real de una OT terminada es Σ `ProductionConsumption.quantity × stock_move.unit_cost` (sin movimiento: costo actual del insumo, marcado «estimado»). El planificado es Σ `WorkOrderMaterial.quantity_planned × unit_cost_snapshot` en unidad base del componente. La desviación es real − planificado y el costo real por unidad se compara con `Product.get_bom_cost()`. Expuesto en `GET /inventory/products/{id}/production-performance/`.

### Fabricar vs comprar y sensibilidad de insumos (ADR-0147)

El ahorro por unidad es `costo de compra promedio − costo real fabricado` (ambos por unidad base, misma ventana); es `null` si falta un lado. Para un insumo, el aumento de costo de cada producto padre con subida `p %` es `costo del insumo en la BOM × p / 100`, con el margen recalculado sobre el precio neto del padre. Expuesto en `GET /inventory/products/{id}/sourcing/`.

### Rotación, cobertura y suscripciones (ADR-0148)

La rotación es `salidas de la ventana / stock promedio ponderado por días` y la cobertura `stock actual / consumo diario de los últimos 90 días`; ambas son `null` sin datos. El costo anualizado de una suscripción es `monto × períodos por año`. Expuesto en `GET /inventory/products/{id}/operations/`.
