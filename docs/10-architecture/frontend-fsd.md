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

## Sub-folder within a feature

A feature may grow a sub-folder when the sub-domain has enough internal complexity to warrant its own boundary. This is not a license to nest arbitrarily — use the criteria below.

### Criteria — all 3 must be met

1. **≥3 hooks** specific to the sub-domain (not general feature hooks).
2. **≥5 components** that are only meaningful within the sub-domain (not shared across the feature).
3. **Own lifecycle or state machine** — the sub-domain has internal transitions (e.g. `draft → confirmed → reconciled`) distinct from the parent feature.

### Current cases

| Sub-folder | Feature | Meets criteria? | Notes |
|------------|---------|----------------|-------|
| `finance/bank-reconciliation/` | `finance` | ✅ | Own hooks, components, reconciliation state machine |
| `treasury/card-statements/` | `treasury` | ✅ | Card statement lifecycle separate from treasury core |
| `treasury/credit-lines/` | `treasury` | ✅ | Credit line approval workflow distinct |

### What a sub-folder MUST include

```
features/treasury/
├── card-statements/
│   ├── components/
│   ├── hooks/
│   ├── types/
│   └── index.ts          ← barrel explicit
├── credit-lines/
│   ├── components/
│   ├── hooks/
│   ├── types/
│   └── index.ts          ← barrel explicit
├── components/
├── hooks/
├── types/
└── index.ts              ← re-exports sub-folder barrels
```

The parent feature barrel re-exports the sub-folder barrels. Consumers always import from the parent barrel — never directly from `features/treasury/card-statements/index.ts`.

### What a sub-folder MUST NOT do

- Import from another sub-folder within the same feature (extract shared logic to parent `lib/` or `components/`).
- Have its own `api/` directory — API calls belong to the parent feature's `api/`. The sub-folder hooks import from the parent `api/`.
- Skip the parent barrel — all public symbols must flow through `features/[feature]/index.ts`.

## Aggregator pattern (read-only feature without root barrel)

A feature may aggregate other features for purely visual purposes. This is a legitimate pattern — not an illegal exception. It has strict rules.

### Criteria — all 5 must be met to qualify as an aggregator

1. **Has no backend entity of its own.** No `/api/<aggregator>/` endpoint; does not write to DB; has no state transitions.
2. **Consumes ≥2 source features** as data sources (via their barreled hooks/components).
3. **Defines no canonical states.** Any `status` it renders is read from the source entity; never duplicated.
4. **Has no root barrel `index.ts`.** Having one would imply "this feature owns something", contradicting criterion 1. Consumers import from barreled subfolders (`components/`, `types/`, `hooks/`, `utils/`).
5. **Tests:** cover only visual behavior + reacting to source changes. Business logic is tested in the source features.

### How to import from an aggregator

```ts
// From a page or another feature:
import { OrderHubPanel, OrderCard } from '@/features/orders/components'
import { getHubStatuses } from '@/features/orders/utils/status'
import type { Order } from '@/features/orders/types'
```

**This does NOT violate** the "import from barrel" rule — each subfolder (`components/`, `types/`, `utils/`) has its own `index.ts`. The rule is violated only if you import a concrete file bypassing the barrel (`from '@/features/orders/components/OrderCard'` ← prohibited).

### Current canonical case: `features/orders`

Visualization hub for SaleOrder + PurchaseOrder + WorkOrder.

| Component | Purpose |
|-----------|---------|
| `OrderHubPanel` | Full side panel with tabs (used by sales, purchasing) |
| `OrderHubIntegrated` | Internal hub with 5 phases (Origin → Production → Logistics → Billing → Treasury) |
| `OrderCard` | Summary card for an order |
| `OrderHeaderDashboard` | Header with status and totals |
| `GlobalHubPanel` | App-level singleton (mounted in root layout) |
| `OrderActionPanel` | Action panel for an order |
| `DocumentListModal` / `PaymentHistoryModal` | Related modals |
| `phases/*` | `OriginPhase`, `ProductionPhase`, `LogisticsPhase`, `BillingPhase`, `TreasuryPhase` |

Local hook: `useSaleOrderSearch()` — returns `{ orders, singleOrder, loading, fetchOrders, fetchSingleOrder }`. Not promoted to `/hooks/` because its utility is only within the aggregator.

Source features consumed:
- `features/sales` — SaleOrder data and actions
- `features/purchasing` — PurchaseOrder data and actions
- `features/production` — WorkOrder status

### What an aggregator must NOT do

- Define its own API or backend endpoint.
- Run mutations (any write goes to the source feature).
- Maintain server state (`useQuery`/`useMutation`) — that is the source feature's responsibility.
- Have a root `index.ts` (would falsely signal it "owns" something).

### When NOT to use the aggregator pattern (use something else)

| Case | Correct solution |
|------|-----------------|
| I need to write to multiple entities in a cross-domain transaction | Backend service in `workflow/services.py` + its own endpoint; on the frontend, a regular feature with barrel |
| I need a shared component between 2 features | Promote to `components/shared/` (standard promotion rule) |
| I need a dashboard with computed metrics | Backend endpoint `/api/dashboard/` + regular feature `features/dashboard` with full barrel |

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
