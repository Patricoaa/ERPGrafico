---
layer: 20-contracts
doc: hook-contracts
status: active
owner: frontend-team
last_review: 2026-04-23
stability: contract-changes-require-ADR
---

# Hook Contracts

Public API of reusable hooks. Feature-local hooks live in `features/[x]/hooks/` and are NOT contracts (scoped to module). Promotion to `/hooks/` requires entry here.

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
const { isAvailable, insufficientItems, isValidating } = useStockValidation(lineItems)
```

| prop/return | type | notes |
|-------------|------|-------|
| input | `Array<{sku; qty}>` | line items being added |
| `isAvailable` | `boolean` | all items have stock |
| `insufficientItems` | `Array<{sku; available; requested}>` | only populated if `!isAvailable` |
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

## Feature-scoped hook examples (reference shape)

Do not import across features. These illustrate the canonical return shape.

| Hook | Returns |
|------|---------|
| `useSaleOrders()` | `{ orders, isLoading, createOrder, isCreating, updateOrder, isUpdating }` |
| `useInvoices(filters)` | `{ invoices, isLoading, refetch, isFetching }` |
| `useWorkOrderTransitions(id)` | `{ transitions, transition, isTransitioning }` |
| `useAccountingAccounts()` | `{ accounts, isLoading, isUpdating }` |
| `useTreasuryReconciliation(accountId)` | `{ lines, match, unmatch, isMatching }` |

## Forbidden

- Exposing `data`, `error`, `mutate` raw from TanStack.
- Multiple unrelated queries in one hook (split).
- Calling hooks conditionally (React rule).
- Importing `@/lib/api` from a component — must go through hook.
