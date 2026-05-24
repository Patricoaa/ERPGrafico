---
layer: 20-contracts
doc: hook-contracts
status: active
owner: frontend-team
last_review: 2026-05-13
stability: contract-changes-require-ADR
---

# Hook Contracts

Public API of reusable hooks. Feature-local hooks live in `features/[x]/hooks/` and are NOT contracts (scoped to module). Promotion to `/hooks/` requires entry here.

---

## Conventions (apply to all)

- Name: `use[Entity][Action]` — `useSaleOrders`, `useCreateInvoice`, `useStockValidation`.
- Return: **domain-named** properties. Never `data`, `mutate`, `error` raw.
- Errors: handled internally via `showApiError` toast. The `error` object is never exposed in return shape.
- `isError` (boolean) MAY be exposed when the component needs to branch UI on error state (e.g. render `EmptyState` instead of `Skeleton`). The raw `Error` object is never exposed.
- Loading flags: `isLoading` for initial fetch, `isFetching` for refetch, `isCreating` / `isUpdating` / `isDeleting` for mutations.

```ts
// ✅ template
type UseSaleOrdersReturn = {
  orders: SaleOrder[]
  isLoading: boolean
  isFetching: boolean
  createOrder: (input: SaleOrderInput) => Promise<SaleOrder>
  isCreating: boolean
  updateOrder: (id: string, patch: Partial<SaleOrderInput>) => Promise<SaleOrder>
  isUpdating: boolean
}
```

---

## Data-Fetching Contract (useQuery)

Every hook that fetches data MUST follow:

```ts
// ✅ Mandatory shape for all query hooks
useQuery({
  queryKey: DOMAIN_KEYS.list(filters),   // 1. Structured key from queryKeys.ts
  queryFn: ({ signal }) => api.get(..., { signal }),  // 2. Signal for cancellation
  staleTime: N * 60 * 1000,              // 3. staleTime — NEVER omitted
  enabled: !!requiredParam,             // 4. Guard when params may be undefined
})
```

### staleTime tiers

| Data category | staleTime | Examples |
|---|---|---|
| Static master data | 60 min | UoMs, banks, payment methods |
| Quasi-static catalogs | 15 min | Accounts, warehouses, attributes |
| Catalogs (user-editable) | 5–10 min | Products, BOMs, contacts, pricing rules |
| Configuration | 10 min | Settings panels, fiscal years, periods |
| Transactional | 2 min | Orders, invoices, journal entries, movements |
| Reports / aggregates | 5 min | Trial balance, budgets, statements |
| Real-time (POS) | 1 min | POS sessions |

### Forbidden patterns

```ts
// ❌ NEVER — useState + useEffect for data fetching
const [data, setData] = useState([])
useEffect(() => { api.get(...).then(setData) }, [])

// ❌ NEVER — module-level manual cache
let globalCache: Item[] | null = null

// ❌ NEVER — missing staleTime
useQuery({ queryKey: [...], queryFn: ... })   // staleTime absent

// ❌ NEVER — raw any in payloads
useMutation({ mutationFn: (payload: any) => ... })
```

---

## Mutation Contract (useMutation)

Every mutation hook MUST follow:

```ts
// ✅ Mandatory shape for all mutation hooks
useMutation({
  mutationFn: (payload: TypedPayload) => api.post(..., payload),
  onSuccess: () => {
    // 1. Mark local mutation BEFORE toast/invalidations so the entity bus
    //    filter `ignoreOwnActor` can suppress the self-echo broadcast.
    markLocalMutation()
    // 2. Domain-scoped invalidation — no .all unless justified.
    //    For factory keys: invalidate BOTH lists() AND details().
    queryClient.invalidateQueries({ queryKey: DOMAIN_KEYS.lists() })
    queryClient.invalidateQueries({ queryKey: DOMAIN_KEYS.details() })
    // 3. Cross-module invalidation when the entity is referenced elsewhere
    queryClient.invalidateQueries({ queryKey: RELATED_DOMAIN_KEYS.all })
    // 4. User feedback
    toast.success('...')
  },
  onError: (error: Error) => showApiError(error, 'Context message'),
})
```

**Rule 0 — `markLocalMutation()` is mandatory.** Every `onSuccess` MUST call `markLocalMutation()` obtained from `useRealtime()` ([features/realtime/RealtimeProvider.tsx:14](../../frontend/features/realtime/RealtimeProvider.tsx#L14)) **before** any toast or invalidation. This timestamp lets the entity-bus subscriber suppress the WebSocket echo of the mutation the user just performed locally — without it, the same client receives its own broadcast and double-invalidates, producing a visible refetch flash. See [ADR-0026](../10-architecture/adr/0026-entity-bus-realtime-invalidation.md) for the broadcast/echo model.

### invalidateQueries rules

**Rule 1 — Minimum scope:** Invalidate the narrowest key that covers the stale data.

```ts
// ❌ Too broad — invalids orders AND notes when only orders changed
queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })

// ✅ Correct — only the affected subtype
queryClient.invalidateQueries({ queryKey: [...SALES_KEYS.all, 'orders'] })
```

**Rule 2 — Cross-module:** When entity A is displayed inside entity B's views, mutating A must also invalidate B.

```ts
// ✅ Cross-module invalidation graph (established in Fase 5)
// Annulling an invoice → sales order billing badge changes
queryClient.invalidateQueries({ queryKey: INVOICES_QUERY_KEY })
queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })   // ← cross-module

// Deleting a journal entry → ledger, journal list, AND account balances
queryClient.invalidateQueries({ queryKey: [LEDGER_QUERY_KEY] })
queryClient.invalidateQueries({ queryKey: JOURNAL_ENTRIES_QUERY_KEY })
queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY })

// BOM delete → product has_bom flag changes
queryClient.invalidateQueries({ queryKey: BOMS_QUERY_KEY })
queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
```

**Rule 3 — No wrapper functions:** Expose `mutation.mutateAsync` directly. Never wrap it.

```ts
// ❌ Unnecessary wrapper
const deleteAccount = async (id: number) => {
  await deleteMutation.mutateAsync(id)
}
return { deleteAccount }

// ✅ Direct exposure
return { deleteAccount: deleteMutation.mutateAsync }
```

---

## queryKeys.ts — Per-Domain Architecture

Every feature domain MUST define its query keys in a dedicated `queryKeys.ts` file inside `hooks/`. This prevents circular imports when hooks need to cross-invalidate each other.

### When to use each variant

**Variant A — Flat constants** (simple domain, single list)
```ts
// features/inventory/hooks/queryKeys.ts
export const PRODUCTS_QUERY_KEY = ['products'] as const
export const BOMS_QUERY_KEY = ['boms'] as const
export const STOCK_MOVES_QUERY_KEY = ['inventory', 'stockMoves'] as const
```

**Variant B — Keyed factories** (complex domain with subtypes or detail views)
```ts
// features/finance/bank-reconciliation/hooks/queryKeys.ts
export const reconciliationKeys = {
  all: ['reconciliation'] as const,
  statements: () => [...reconciliationKeys.all, 'statements'] as const,
  statement: (id: number) => [...reconciliationKeys.statements(), id] as const,
  unreconciledLines: (statementId: number, params: Record<string, unknown> = {}) =>
    [...reconciliationKeys.all, 'unreconciled-lines', statementId, params] as const,
}
```

**Decision rule:** Use Variant B when the domain has sub-list types (e.g. `orders` + `notes`) or per-entity detail queries. Use Variant A for flat single-list domains.

### Status per domain

Snapshot 2026-05-23. Se actualiza al cerrar cada migración de feature: si añadís `queryKeys.ts` a una feature nueva, agregá la fila aquí en el mismo PR.

| Domain | queryKeys.ts | Variant | Notas |
|--------|-------------|---------|-------|
| `accounting` | ✅ Exists | B | |
| `billing` | ✅ Exists | A | Sólo 2 constantes (`INVOICES_QUERY_KEY`, `PURCHASE_INVOICES_QUERY_KEY`). Migrar a B cuando se añadan subtypes. |
| `contacts` | ✅ Exists | B | Patrón canónico de referencia |
| `finance/bank-reconciliation` | ✅ Exists | B | Único caso con `queryKeys.ts` en subfeature, no en root |
| `inventory` | ✅ Exists | B + A (legacy) | `PRODUCTS_KEYS` (B) coexiste con flats deprecadas como puente migratorio — ver header del archivo |
| `production` | ✅ Exists | B + A | `WORK_ORDERS_KEYS`/`BOMS_KEYS` (B) + flats para singletons (`PRODUCTION_METRICS_KEY`, `UOMS_KEY`) |
| `purchasing` | ✅ Exists | B | |
| `sales` | ✅ Exists | B | |
| `treasury` | ✅ Exists | B | |
| `orders` (aggregator) | ❌ N/A | — | Aggregator: no posee entidad propia ([frontend-fsd.md §Aggregator](../10-architecture/frontend-fsd.md#aggregator-pattern-read-only-feature-without-root-barrel)) |
| `settings` (cross-domain) | ❌ N/A | — | Muta entidades de otros dominios; usa los `KEYS` de cada uno |
| Resto (finance, pos, hr, tax, users, workflow, auth, …) | ⏳ Pendiente | — | Migrar siguiendo el [feature compliance checklist](#feature-compliance-checklist) |

---

## Global hooks (promoted)

### `useServerDate()` 🟢

Returns authoritative server-side date to avoid client clock drift in fiscal ops.

```ts
const { serverDate, isLoading } = useServerDate()
// serverDate: Date | undefined
```

Invalidated every 60s. Mandatory for folio, period, reconciliation, payroll inputs.

### `useStockValidation(items)` 🟢

```ts
const { checkAvailability, validateLine, getStockMessage, isValidating } = useStockValidation()
```

| prop/return | type | notes |
|-------------|------|-------|
| `checkAvailability` | `(lines: LineItem[]) => Promise<StockValidationResult>` | POST to backend |
| `validateLine` | `(product: Partial<Product>, qty: number) => boolean` | local pre-check |
| `getStockMessage` | `(product: Partial<Product>, qty: number) => string \| null` | human error message |
| `isValidating` | `boolean` | |

### `useFolioValidation(params)` 🟢

```ts
const { isValidFolio, suggestedNext, isChecking } = useFolioValidation({ documentType, folio })
```

Rejects gaps + duplicates per fiscal period.

### `useApiMutation<TInput, TOutput>(opts)` 🟢

Generic wrapper over TanStack `useMutation`. Applies JWT, error toast, success toast. Feature hooks build on top.

### `useRealtime()` 🟢

Surface from [features/realtime/RealtimeProvider.tsx](../../frontend/features/realtime/RealtimeProvider.tsx). Exposes `markLocalMutation: () => void` (timestamp para suprimir el self-echo del entity bus) y suscriptores a canales. Llamada obligatoria desde **todo `useMutation.onSuccess`** del proyecto — ver [Mutation Contract Rule 0](#mutation-contract-usemutation).

```ts
const { markLocalMutation } = useRealtime()
// dentro de onSuccess:
markLocalMutation()           // 1. siempre primero
queryClient.invalidateQueries({ queryKey: DOMAIN_KEYS.lists() })
toast.success('...')
```

Detalle del modelo broadcast/echo y `ignoreOwnActor` en [ADR-0026](../10-architecture/adr/0026-entity-bus-realtime-invalidation.md).

### `useAutoSaveForm<T>(opts)` 🟢

Centralized debounced autosave for `react-hook-form` instances. Used by **every settings panel** that edits a singleton or a row-of-collection. Returns `{ status, invalidReason, lastSavedAt, flush, retry }` — see full contract in [autosave-contract.md](./autosave-contract.md).

```ts
const { status, flush, retry } = useAutoSaveForm({
  form,
  onSave: async (values) => api.patch('/settings/...', values),
  debounceMs: 1000,
  validate: (v) => v.weights.sum === 100 || "Pesos deben sumar 100%",
})
```

States: `idle | dirty | invalid | saving | synced | error`. Pair with `<AutoSaveStatusBadge />` and `useUnsavedChangesGuard(status)`.

### `useUnsavedChangesGuard(status)` 🟢

Attaches a `beforeunload` warning while the autosave status is `dirty | saving | invalid`. Pass the status returned by `useAutoSaveForm`.

### `useSelectedEntity<T>(opts)` 🟢

Lee el query param `?selected=<id>` y fetchea la entidad desde el endpoint dado. Reutiliza cache de TanStack Query. Maneja 404 y 403 con toast y cleanup automático. Usado por listas para implementar el patrón deeplink → modal (ADR-0020).

```ts
const { entity, isLoading, clearSelection } = useSelectedEntity<Category>({
  endpoint: '/api/inventory/categories',
  paramName: 'selected',  // default — omitible
})
```

| prop/return | type | notes |
|-------------|------|-------|
| `endpoint` | `string` | Base API endpoint sin trailing slash ni id |
| `paramName` | `string?` | Nombre del param. Default: `'selected'` |
| `entity` | `T \| null` | Entidad fetcheada; null si param ausente, loading, o error |
| `isLoading` | `boolean` | true solo cuando hay id presente y se está fetching |
| `clearSelection` | `() => void` | `router.replace(pathname)` sin el param; preserva otros params |

Ver contrato completo: [list-modal-edit-pattern.md §2.3](./list-modal-edit-pattern.md#23-hook-useselectedentity).

### `useAllowedPaymentMethods(opts)` 🟢

```ts
const { methods, loading, error, refetch } = useAllowedPaymentMethods({
  terminalId?: number,
  operation?: 'sales' | 'purchases',  // default: 'sales'
  enabled?: boolean,                   // default: true
})
```

Declarative `useQuery` — `staleTime: 5 min`. Returns filtered `PaymentMethod[]` per terminal or operation context.

---

## Feature-scoped hook examples (reference shape)

Do not import across features except query key constants. These illustrate the canonical return shape.

| Hook | Returns |
|------|---------|
| `useSaleOrders()` | `{ orders, isLoading, createOrder, isCreating, updateOrder, isUpdating }` |
| `useInvoices(filters)` | `{ invoices, isLoading, refetch, annulInvoice, isAnnulling }` |
| `useWorkOrderTransitions(id)` | `{ transitions, transition, isTransitioning }` |
| `useAccounts()` | `{ accounts, isLoading, createAccount, updateAccount, deleteAccount }` |
| `useTreasuryReconciliation(accountId)` | `{ lines, match, unmatch, isMatching }` |
| `useContacts(filters)` | `{ contacts, isLoading, createContact, updateContact, deleteContact }` |

---

## Forbidden

- Exposing `data`, `error`, `mutate` raw from TanStack.
- Multiple unrelated queries in one hook (split).
- Calling hooks conditionally (React rule).
- Importing `@/lib/api` from a component — must go through hook.
- `useState` + `useEffect` for any data fetching — use `useQuery`.
- Omitting `staleTime` in any `useQuery` call.
- Using `any` in mutation payload types — use specific interfaces or `Record<string, unknown>`.
- Wrapping `mutateAsync` in a function that only calls it — expose directly.
- Defining query key literals inline in components — keys live in `queryKeys.ts`.
- Invalidating a domain's `.all` key when only a subtype changed — use the narrowest key.
- Cross-feature imports of hook implementations — only query key constants may be imported across feature boundaries.
- Omitting `markLocalMutation()` in a mutation's `onSuccess` — the entity bus relies on it to suppress self-echo.

---

## Mechanical enforcement

Este contrato se respalda con barreras automáticas en ESLint y `tsc`. No es opt-in: cada PR pasa por estas reglas en CI.

| Regla | Configurada en | Cubre | Severidad |
|---|---|---|---|
| `fsd/no-api-in-component` (custom) | [frontend/eslint-rules/fsd-no-api-in-component.mjs](../../frontend/eslint-rules/fsd-no-api-in-component.mjs) | `import … from '@/lib/api'` en `features/*/components/**` (invariante #5) | `warn` (sube a `error` al llegar a 0 violaciones) |
| `no-restricted-imports` | [frontend/eslint.config.mjs](../../frontend/eslint.config.mjs) | `useQuery`/`useMutation`/`useSuspenseQuery` directos en `features/*/components/**` (invariante #4) | `error` |
| `no-restricted-imports` | [frontend/eslint.config.mjs](../../frontend/eslint.config.mjs) | `@/features/*/{components,hooks,api,types}/*` — cross-feature sin barrel | `error` |
| `boundaries/dependencies` | [frontend/eslint.config.mjs](../../frontend/eslint.config.mjs) | `@/lib/api` en `components/shared/**` y `components/ui/**` | `error` |
| TypeScript `strict` + `noImplicitAny` | [frontend/tsconfig.json](../../frontend/tsconfig.json) | Zero `any` (invariante #1) | `error` |

> **Por qué `fsd/no-api-in-component` es una regla custom y no `no-restricted-imports`**: ESLint flat-config sobrescribe `no-restricted-imports` entre bloques que matchean los mismos archivos (las opciones no se mergean). Un segundo bloque con `no-restricted-imports` en `features/*/components/**` clobbearía la restricción `error` de tanstack ya existente. Una regla con nombre propio compone sin colisión y permite severidad independiente.

Métrica de progreso (correr antes de cualquier PR que toque la capa de datos):

```bash
cd frontend && npm run lint 2>&1 | grep -c "fsd/no-api-in-component"
# Debe ser ≤ al snapshot anterior. Aumentos requieren justificación en la PR.
```

Para añadir, ajustar o flexibilizar una de estas reglas, ver [§Handling contract deviations](#handling-contract-deviations).

---

## Canonical feature skeleton

Estructura objetivo para una feature con mutaciones. Referencia ejecutable: [`features/contacts/`](../../frontend/features/contacts/).

```
features/<feature>/
├── api/
│   └── <feature>Api.ts        ← funciones puras (list, get, create, update, delete)
├── hooks/
│   ├── queryKeys.ts            ← factory jerárquica
│   ├── use<Entity>.ts          ← hook principal con useQuery + useMutation
│   └── ... (hooks adicionales por sub-entidad)
├── components/
│   ├── <Entity>List.tsx        ← consume hook, NO api directo
│   ├── <Entity>Form.tsx        ← consume hook
│   └── <Entity>DetailClient.tsx ← consume hook
├── types.ts
└── index.ts                    ← barrel: exporta hooks y componentes públicos
```

### `queryKeys.ts` — esqueleto

```ts
import type { ProductFilters } from '../types'

export const PRODUCTS_KEYS = {
    all: ['products'] as const,
    lists: () => [...PRODUCTS_KEYS.all, 'list'] as const,
    list: (filters?: ProductFilters) => [...PRODUCTS_KEYS.lists(), { filters }] as const,
    details: () => [...PRODUCTS_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...PRODUCTS_KEYS.details(), id] as const,
}
```

Reglas:

- `all` siempre como const tupla — base para invalidación masiva.
- `lists()` y `details()` como prefijos invalidables (sin args).
- `list(filters)` y `detail(id)` con args específicos.
- Sub-recursos: agregar nodos derivados (`variants(productId)`, `lines(orderId)`).

### `api/<feature>Api.ts` — esqueleto

```ts
import api from '@/lib/api'
import type { Product, ProductFilters, ProductPayload } from '../types'

export const productsApi = {
    list: (filters?: ProductFilters) =>
        api.get<Product[]>('/inventory/products/', { params: filters }).then(r => r.data),
    get: (id: number) =>
        api.get<Product>(`/inventory/products/${id}/`).then(r => r.data),
    create: (payload: ProductPayload) =>
        api.post<Product>('/inventory/products/', payload).then(r => r.data),
    update: (id: number, payload: Partial<ProductPayload>) =>
        api.put<Product>(`/inventory/products/${id}/`, payload).then(r => r.data),
    remove: (id: number) =>
        api.delete(`/inventory/products/${id}/`).then(r => r.data),
}
```

**Esta es la única capa** que puede importar `@/lib/api`. Ningún componente, ningún hook fuera de `features/*/api/`.

### `hooks/useProducts.ts` — esqueleto completo

```ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productsApi } from '../api/productsApi'
import { PRODUCTS_KEYS } from './queryKeys'
import { useRealtime } from '@/features/realtime'
import type { ProductFilters, ProductPayload } from '../types'

export function useProducts({ filters }: { filters?: ProductFilters } = {}) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: products, isLoading, refetch } = useQuery({
        queryKey: PRODUCTS_KEYS.list(filters),
        queryFn: () => productsApi.list(filters),
        staleTime: 5 * 60 * 1000,            // tier "Catalogs (user-editable)"
    })

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: PRODUCTS_KEYS.lists() })
        queryClient.invalidateQueries({ queryKey: PRODUCTS_KEYS.details() })
    }

    const createMutation = useMutation({
        mutationFn: productsApi.create,
        onSuccess: () => {
            markLocalMutation()                // Rule 0 — antes del toast
            invalidate()
            toast.success('Producto creado')
        },
        onError: (e: Error) => toast.error(`Error al crear: ${e.message}`),
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: Partial<ProductPayload> }) =>
            productsApi.update(id, payload),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success('Producto actualizado')
        },
        onError: (e: Error) => toast.error(`Error al actualizar: ${e.message}`),
    })

    const deleteMutation = useMutation({
        mutationFn: productsApi.remove,
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success('Producto eliminado')
        },
        onError: (e: Error) => toast.error(`Error al eliminar: ${e.message}`),
    })

    return {
        products,
        isLoading,
        refetch,
        createProduct: createMutation.mutateAsync,   // Rule 3 — sin wrapper
        updateProduct: updateMutation.mutateAsync,
        deleteProduct: deleteMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
    }
}

export function useProduct(id: number | null) {
    return useQuery({
        queryKey: id ? PRODUCTS_KEYS.detail(id) : ['no-id'],
        queryFn: () => productsApi.get(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    })
}
```

### Componente — patrón obligatorio

```tsx
'use client'

import { useProducts } from '../hooks/useProducts'

export function ProductForm({ initialData, onSuccess }: Props) {
    const { createProduct, updateProduct, isCreating, isUpdating } = useProducts()

    async function onSubmit(data: ProductPayload) {
        if (initialData) {
            await updateProduct({ id: initialData.id, payload: data })
        } else {
            await createProduct(data)
        }
        onSuccess?.()
    }
    // ...
}
```

Cero `import api from '@/lib/api'`. Cero `useMutation` directo. Las toasts y la invalidación viven en el hook, no en el componente.

---

## Feature compliance checklist

Una feature está conforme con este contrato cuando cumple **todos** estos checks. Aplicar antes de mergear cualquier PR que toque la capa de datos:

- [ ] Existe `features/<feature>/hooks/queryKeys.ts` con factory jerárquica (Variant A o B según [§Decision rule](#when-to-use-each-variant)).
- [ ] Existe `features/<feature>/api/<feature>Api.ts`. **Solo este archivo importa `@/lib/api`** dentro de la feature.
- [ ] Existe `features/<feature>/hooks/use<Entity>.ts` por cada entidad mutable.
- [ ] Cada `useMutation.onSuccess` invalida `KEYS.lists()` Y `KEYS.details()` como mínimo. Para sub-entidades, también el padre. Cross-module según [Rule 2](#invalidatequeries-rules).
- [ ] Cada `useMutation.onSuccess` llama `markLocalMutation()` del `RealtimeProvider` antes del toast ([Rule 0](#mutation-contract-usemutation)).
- [ ] Cada `useQuery` declara `staleTime` explícito según [los tiers](#staletime-tiers).
- [ ] `mutateAsync` se expone directo, sin wrapper ([Rule 3](#invalidatequeries-rules)).
- [ ] `grep -r "from '@/lib/api'" features/<feature>/components/` → **0 resultados**.
- [ ] `grep -rE "useQuery\(|useMutation\(" features/<feature>/components/` → **0 resultados** (`useQueryClient` puntual permitido).
- [ ] `cd frontend && npm run type-check` → 0 errores.
- [ ] `cd frontend && npm run lint` → 0 nuevas violaciones de `fsd/no-api-in-component`.
- [ ] Tests existentes pasan (`npm run test -- features/<feature>`).
- [ ] Smoke manual: crear/editar/eliminar una entidad y verificar que la lista y cualquier panel de detalle abierto reflejan el cambio sin recargar.

---

## Handling contract deviations

Este contrato evoluciona. Features nuevas o refactors pueden desviarse del patrón canónico — el siguiente protocolo define cómo se detecta, clasifica y resuelve una desviación.

### Cómo detectar desviaciones

**Mecánicas** (CI las atrapa solas):

```bash
cd frontend && npm run lint -- --max-warnings 0     # bloquea cualquier nueva violación
cd frontend && npm run type-check                   # bloquea `any` escapados
```

**Auditoría periódica** (correr mensualmente o tras cualquier merge grande):

```bash
# 1. Violaciones de invariante #5 (api directo en componentes)
cd frontend && npm run lint 2>&1 | grep -c "fsd/no-api-in-component"

# 2. Violaciones de invariante #4 (useQuery/useMutation en componentes)
grep -rE "useQuery\(|useMutation\(" frontend/features/*/components/ | wc -l

# 3. Features sin queryKeys.ts
for f in frontend/features/*/; do
  fname=$(basename "$f")
  [ ! -f "${f}hooks/queryKeys.ts" ] && echo "FALTA: $fname"
done

# 4. Features sin api/ folder
for f in frontend/features/*/; do
  fname=$(basename "$f")
  [ ! -d "${f}api" ] && echo "FALTA api/: $fname"
done

# 5. Mutations que olvidan markLocalMutation
grep -rL "markLocalMutation" frontend/features/*/hooks/ | xargs grep -l "useMutation"
```

Cualquier número distinto del baseline anterior es una desviación. Si subió, hay que clasificarla.

### Clasificación de la desviación

| Tipo | Ejemplo | Acción |
|---|---|---|
| **A. Regresión** — el código viola un contrato vigente sin justificación | Componente nuevo importa `@/lib/api` en lugar de pasar por un hook | **Rechazar PR** o abrir issue. El código se ajusta al contrato. |
| **B. Excepción legítima** — el contrato no aplica a este caso y nunca aplicará | Una feature aggregator no debe tener `queryKeys.ts` propios | Documentar la excepción en este contrato. El código queda como está. |
| **C. Contrato desactualizado** — la realidad del proyecto cambió y el contrato no | El equipo decidió que todas las features usen Variant B y ya no se acepta Variant A | **Actualizar el contrato vía ADR** (si toca arquitectura) o vía edición directa con review (si es ajuste menor). Luego ajustar código que no cumpla. |
| **D. Nueva regla emergente** — un patrón se repite ≥3 veces y conviene contractualizarlo | 3 features han escrito el mismo helper de `useEntitySubscription` | Promover a contrato + posiblemente a `/hooks/` global. ADR si el patrón cambia arquitectura. |

### Procedimiento — paso a paso

1. **Identificar el tipo** (A/B/C/D) con la tabla anterior. Si dudás, asumir A.

2. **Para tipo A (regresión)**:
   - Devolver el PR con el link a la regla violada de este documento.
   - Si la regla violada todavía no tiene barrera mecánica, abrir issue para añadirla (modificar [frontend/eslint.config.mjs](../../frontend/eslint.config.mjs) o [frontend/eslint-rules/](../../frontend/eslint-rules/)).

3. **Para tipo B (excepción legítima)**:
   - Editar este contrato añadiendo la excepción explícitamente (qué, dónde, por qué).
   - Precedente: el patrón aggregator está documentado en [frontend-fsd.md §Aggregator pattern](../10-architecture/frontend-fsd.md#aggregator-pattern-read-only-feature-without-root-barrel) y se refleja en [§Status per domain](#status-per-domain).
   - Si la excepción aplica a una sola feature, dejar un comentario `// CONTRACT-EXCEPTION: hook-contracts.md#<anchor>` en el código.

4. **Para tipo C (contrato desactualizado)**:
   - Si el cambio es estructural (afecta dataflow, capas, naming convention): nueva ADR en [docs/10-architecture/adr/](../10-architecture/adr/). Numerar continuando la secuencia.
   - Si es un refinamiento menor (ajuste de tier de `staleTime`, regla de invalidación adicional): editar este contrato directamente con dos reviewers.
   - El frontmatter de este archivo declara `stability: contract-changes-require-ADR` — respetarlo para cambios que rompan consumidores.

5. **Para tipo D (nueva regla emergente)**:
   - Confirmar la repetición (≥3 usos con `grep`).
   - Promover según donde corresponda:
     - Hook reutilizable → [§Global hooks (promoted)](#global-hooks-promoted) + mover archivo a `frontend/hooks/`.
     - Patrón estructural → [frontend-fsd.md](../10-architecture/frontend-fsd.md) + ADR si redefine capas.
     - Patrón de componente → [component-contracts.md](./component-contracts.md).

6. **Después de cualquier cambio**: actualizar [§Status per domain](#status-per-domain) en el mismo PR para reflejar el nuevo estado.

### Cuándo escalar la severidad mecánica

`fsd/no-api-in-component` está en `warn` mientras quedan violaciones. Reglas para subir a `error`:

| Condición | Acción |
|---|---|
| Métrica `grep -c "fsd/no-api-in-component"` == 0 durante 2 semanas | Cambiar `"warn"` → `"error"` en [frontend/eslint.config.mjs](../../frontend/eslint.config.mjs). |
| Re-aparece una violación después del cambio | Aplicar el procedimiento (probablemente tipo A). NO bajar a `warn` para desbloquear el merge. |
| Excepción legítima requiere bypass | Usar `// eslint-disable-next-line fsd/no-api-in-component -- <razón + link a este contrato>` con justificación inline. Reviewer obligatorio. |

El mismo principio aplica a cualquier futura regla añadida bajo el patrón "warn durante migración → error tras compliance": empezar permisiva, escalar cuando el contador llega a 0.
