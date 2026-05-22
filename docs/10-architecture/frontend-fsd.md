---
layer: 10-architecture
doc: frontend-fsd
status: active
owner: frontend-team
last_review: 2026-04-23
---

# Frontend — Feature-Sliced Design

## Folder map

```
frontend/
├── app/                       # Next.js App Router — pages only
│   └── (dashboard)/
│       └── [module]/          # Route segment
│           ├── layout.tsx
│           └── page.tsx       # Imports from features/[module] barrel
├── features/                  # Business modules (bounded contexts)
│   └── [module]/
│       ├── components/        # UI components for the module
│       │   └── forms/
│       │       └── schema.ts  # Zod schema + derived TS type
│       ├── hooks/             # use[Entity][Action].ts — data fetching
│       ├── lib/               # Module-local helpers
│       ├── types/             # Module-local types (prefer Zod-derived)
│       └── index.ts           # PUBLIC API — only import target
├── components/
│   ├── ui/                    # Shadcn base — DO NOT MODIFY
│   ├── shared/                # Promoted components ≥3 feature consumers
│   └── selectors/             # Async entity-search comboboxes — see component-selectors.md
├── hooks/                     # Global hooks promoted from features
├── lib/
│   ├── api.ts                 # Axios instance — features/ and hooks/ only
│   ├── utils.ts               # Generic helpers (`cn`, formatters)
│   └── auth.ts                # JWT helpers
└── app/globals.css            # Tailwind 4 theme — single visual source
```

## Import rules (enforced by ESLint `boundaries` plugin)

| From → To | Allowed |
|-----------|---------|
| `app/*` → `features/*/index.ts` | ✅ |
| `app/*` → `features/*/components/*` | ❌ use barrel |
| `features/A` → `features/B/index.ts` | ✅ |
| `features/A` → `features/B/components/*` | ❌ use barrel |
| `features/*/api/*` → `lib/api` | ✅ |
| `features/*/hooks/*` → `lib/api` | ✅ |
| `features/*/components/*` → `lib/api` | ❌ wrap in hook |
| `components/*` → `lib/api` | ❌ wrap in hook |
| `hooks/*` (global) → `lib/api` | ✅ |
| `components/ui/*` → anything app-specific | ❌ stays generic |

## Promotion criteria — when to move code

| Scope | Location |
|-------|----------|
| Used in 1 feature | `features/[x]/` |
| Used in 2 unrelated features | stay, duplicate is fine |
| Used in 3+ features | promote to `/components/shared/` or `/hooks/` |
| Used in routing only | `/lib/` |

Promotion requires: (a) stable API signature, (b) tests, (c) entry in component-contracts or hook-contracts.

## Aggregator pattern (read-only feature without root barrel)

Una feature puede agregar otras features con propósito puramente visual. Es un patrón legítimo, no una excepción ilegal. Tiene reglas estrictas.

### Criterios — los 5 deben cumplirse para calificar como aggregator

1. **No tiene entidad backend propia.** No hay `/api/<aggregator>/` endpoint; no escribe a la DB; no posee state transitions.
2. **Consume ≥2 features fuente** como data sources (vía sus hooks/componentes barreled).
3. **No define estados canónicos.** Cualquier `status` que renderice es leído de la entidad fuente; nunca duplicado.
4. **No tiene root barrel `index.ts`.** Tener uno implicaría "esta feature posee algo", lo cual contradice el criterio 1. Los consumidores importan desde subfolders barreled (`components/`, `types/`, `hooks/`, `utils/`).
5. **Tests:** cubre solamente comportamiento visual + reaccionar a cambios de las fuentes. La lógica de negocio se testea en las features fuente.

### Cómo importar desde un aggregator

```ts
// Desde una page o desde otra feature:
import { OrderHubPanel, OrderCard } from '@/features/orders/components'
import { getHubStatuses } from '@/features/orders/utils/status'
import type { Order } from '@/features/orders/types'
```

**Esto NO viola** la regla "import desde barrel" — cada subfolder (`components/`, `types/`, `utils/`) tiene su propio `index.ts`. La regla se viola solo si importás un archivo concreto sin pasar por barrel (`from '@/features/orders/components/OrderCard'` ← prohibido).

### Caso canónico actual: `features/orders`

Hub de visualización para SaleOrder + PurchaseOrder + WorkOrder.

| Componente | Propósito |
|-----------|-----------|
| `OrderHubPanel` | Side-panel completo con tabs (usado por sales, purchasing) |
| `OrderHubIntegrated` | Hub interno con 5 fases (Origin → Production → Logistics → Billing → Treasury) |
| `OrderCard` | Card resumen para una orden |
| `OrderHeaderDashboard` | Header con status y totales |
| `GlobalHubPanel` | Singleton a nivel app (montado en root layout) |
| `OrderActionPanel` | Panel de acciones para una orden |
| `DocumentListModal` / `PaymentHistoryModal` | Modales relacionados |
| `phases/*` | `OriginPhase`, `ProductionPhase`, `LogisticsPhase`, `BillingPhase`, `TreasuryPhase` |

Hook local: `useSaleOrderSearch()` — devuelve `{ orders, singleOrder, loading, fetchOrders, fetchSingleOrder }`. No se promueve a `/hooks/` porque su utilidad es solo dentro del aggregator.

Features fuente consumidas:
- `features/sales` — SaleOrder data y acciones
- `features/purchasing` — PurchaseOrder data y acciones
- `features/production` — WorkOrder status

### Qué NO debe hacer un aggregator

- Definir su propia API o endpoint backend.
- Ejecutar mutations (cualquier write va a la feature fuente).
- Mantener estado de servidor (`useQuery`/`useMutation`) — eso lo hace la feature fuente.
- Tener root `index.ts` (señalizaría falsamente que "posee" algo).

### Cuándo NO usar el patrón aggregator (usar otra cosa)

| Caso | Solución correcta |
|------|-------------------|
| Necesito escribir a múltiples entities en una transacción cross-domain | Servicio backend en `workflow/services.py` + un endpoint propio; del lado frontend, una feature regular con barrel |
| Necesito un componente compartido entre 2 features | Promoción a `components/shared/` (regla habitual de promoción) |
| Necesito un dashboard con métricas computadas | Endpoint backend `/api/dashboard/` + feature regular `features/dashboard` con barrel completo |

## Data flow — mandatory pattern

```
lib/api.ts  (axios)
    ↓
features/[x]/api/[entity]Api.ts  (HTTP calls, thin wrapper)
    ↓
features/[x]/hooks/use[Entity]List.ts  (TanStack Query, cache management)
    ↓
features/[x]/components/EntityList.tsx  (UI)
    ↓
app/(dashboard)/[x]/page.tsx  (consumes barrel)
```

Violations (examples caught in review):

```ts
// ❌ component hits api directly
import { api } from '@/lib/api'
function MyComponent() { const res = api.get('/sales/') }

// ❌ component uses useQuery directly
function MyComponent() { useQuery({ queryKey: ['x'], ... }) }

// ❌ importing feature internals
import { foo } from '@/features/sales/components/SaleOrderCard'

// ✅ correct
import { SaleOrderCard } from '@/features/sales'
```

## Hook naming and return shape

- Name: `use[Entity][Action]` — `useSaleOrders`, `useCreateInvoice`.
- Return: domain-named properties, never generic.
- Errors: handled internally via `showApiError` toast. No `error` property exposed.

```ts
// ✅
const { orders, isLoading, isCreating, createOrder } = useSaleOrders()

// ❌
const { data, error, mutate } = useSaleOrders()
```

## Testing co-location

```
features/sales/
├── components/
│   ├── SaleOrderList.tsx
│   └── SaleOrderList.test.tsx
├── hooks/
│   ├── useSaleOrders.ts
│   └── useSaleOrders.test.ts
```
