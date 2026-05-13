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
    // 1. Domain-scoped invalidation — no .all unless justified
    queryClient.invalidateQueries({ queryKey: DOMAIN_KEYS.list() })
    // 2. Cross-module invalidation when the entity is referenced elsewhere
    queryClient.invalidateQueries({ queryKey: RELATED_DOMAIN_KEYS.all })
    // 3. User feedback
    toast.success('...')
  },
  onError: (error: Error) => showApiError(error, 'Context message'),
})
```

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

| Domain | queryKeys.ts | Variant |
|--------|-------------|---------|
| `finance/bank-reconciliation` | ✅ Exists | B |
| `inventory` | ✅ Exists | A |
| `sales` | ✅ Exists | B |
| `purchasing` | ✅ Exists | B |
| `contacts` | ✅ Exists | B |
| `accounting` | ✅ Exists | B |
| `treasury` | ✅ Exists | B |
| `billing` | ✅ Exists | A |
| `production` | ✅ Exists | A |

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
