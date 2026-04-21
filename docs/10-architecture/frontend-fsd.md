---
layer: 10-architecture
doc: frontend-fsd
status: active
owner: frontend-team
last_review: 2026-04-21
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
│   └── shared/                # Promoted components ≥3 feature consumers
├── hooks/                     # Global hooks promoted from features
├── lib/
│   ├── api.ts                 # Axios instance — features/ and hooks/ only
│   ├── utils.ts               # Generic helpers (`cn`, formatters)
│   └── auth.ts                # JWT helpers
├── docs/architecture/         # Legacy — migrating to /docs/
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

## Special case: `features/orders`

Visualization hub. Aggregates SaleOrder + PurchaseOrder + WorkOrder. No backend entity. Reads canonical states from each source; never defines its own.

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
