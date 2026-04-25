---
layer: 20-contracts
doc: component-selectors
status: active
owner: frontend-team
last_review: 2026-04-23
stability: beta
---

# Selector Components

Async entity-search comboboxes in `components/selectors/`. These components perform live backend searches and return an entity ID (or name) to a parent form.

## Key characteristics

- All use the `notched-field` CSS pattern — render inside `fieldset + legend`.
- Search is debounced (300–500ms) or fires on popover open.
- Internal state: they fetch their own initial value when `value` is pre-populated.
- They are NOT in `components/shared/` because they have direct feature-hook dependencies (each calls a feature-specific search hook).
- Import: `import { AccountSelector } from '@/components/selectors'`
21: 
22: ## Dropdown behavior
23: 
24: Entity selectors must adhere to the layout invariants defined in [component-contracts.md](./component-contracts.md#dropdown--popover-layout-invariants):
25: 
26: - **Width**: MUST match trigger width using `w-[var(--radix-popover-trigger-width)]`.
27: - **Position**: MUST use `popper` style, aligning the dropdown with the **bottom border** of the notched fieldset (avoiding the `item-aligned` covering behavior of standard selects).
28: 
29: ---

## Trigger display — patrón compacto

Todos los selectores usan un **trigger de una sola línea** cuando hay un ítem seleccionado. El display rico (icono con fondo + 2 líneas de texto) **no se usa** en el trigger — solo en las filas del dropdown.

```
// ✅ Trigger seleccionado — una línea
[icon 3.5] [texto principal truncate] [secundario shrink-0 hidden sm:inline]

// ❌ Trigger seleccionado — NO usar 2 líneas en el trigger
[icon-box]  [texto principal  ]
            [texto secundario ]
```

Esto garantiza que todos los campos del formulario tengan la misma altura (`min-h-[1.5rem]`), alineada con `LabeledInput`.

**Patrón JSX estándar para el trigger seleccionado:**

```tsx
<div className="flex items-center gap-1.5 min-w-0 flex-1">
  <SomeIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
  <span className="font-medium text-sm truncate">{entity.name}</span>
  <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">{entity.secondary}</span>
</div>
```

---

## When to use selectors vs plain `<select>`

| Scenario | Use |
|----------|-----|
| Entity set > 20 items or loaded from API | Selector component |
| Static enum (< 10 fixed options) | Shadcn `<Select>` |
| UoM choice (filtered by product) | `UoMSelector` |

---

## AccountSelector 🟡

Combobox for accounting accounts (Chart of Accounts). Popover + advanced modal search for large charts.

```tsx
<AccountSelector
  value={accountId}
  onChange={setAccountId}
  label="Cuenta contable"
  accountType="asset"
  error={fieldState.error?.message}
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `value` | `string \| number \| null` | ❌ | — | Controlled; account `id` |
| `onChange` | `(value: string \| null) => void` | ✅ | — | Returns `id.toString()` or `null` |
| `placeholder` | `string` | ❌ | `'Seleccionar cuenta...'` | |
| `accountType` | `string \| string[]` | ❌ | — | Filter by `account_type` field (`'asset' \| 'liability' \| 'equity' \| 'income' \| 'expense'`) |
| `showAll` | `boolean` | ❌ | `false` | `true`: include parent accounts. `false`: leaf accounts only |
| `isReconcilable` | `boolean` | ❌ | — | Filter reconcilable accounts (journal entry use) |
| `disabled` | `boolean` | ❌ | `false` | |
| `label` | `string` | ❌ | — | Notched legend text |
| `error` | `string` | ❌ | — | Error message below field |

Feature hook: `useAccountSearch` from `features/accounting`.

---

## ProductSelector 🟡

Combobox for inventory products. Popover + advanced modal. Shows price and stock status.

```tsx
<ProductSelector
  value={productId}
  onChange={setProductId}
  context="sale"
  restrictStock
  label="Producto"
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `value` | `string \| number \| null` | ❌ | — | Product `id` |
| `onChange` | `(value: string \| null) => void` | ✅ | — | |
| `placeholder` | `string` | ❌ | — | |
| `productType` | `string` | ❌ | — | Filter by `product_type` |
| `allowedTypes` | `string[]` | ❌ | — | Multiple type filter |
| `disabled` | `boolean` | ❌ | `false` | |
| `restrictStock` | `boolean` | ❌ | `false` | Warn when item has no stock |
| `excludeIds` | `(string \| number)[]` | ❌ | — | Exclude specific products |
| `context` | `'sale' \| 'purchase'` | ❌ | — | Adjusts price display |
| `excludeVariantTemplates` | `boolean` | ❌ | `false` | Hide variant parent templates |
| `onSelect` | `(product: Product) => void` | ❌ | — | Full product object on select (for price auto-fill) |
| `customFilter` | `(product: Product) => boolean` | ❌ | — | Additional client-side filter |
| `label` | `string` | ❌ | — | |
| `error` | `string` | ❌ | — | |

Feature hook: `useProductSearch` from `features/inventory`.

---

## AdvancedContactSelector 🟡

Combobox for customers/suppliers. Debounced search, RUT display. Lazy-loads `ContactModal` for quick contact creation.

```tsx
<AdvancedContactSelector
  value={contactId}
  onChange={setContactId}
  contactType="CUSTOMER"
  label="Cliente"
  onSelectContact={(c) => setContactData(c)}
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `value` | `string \| number \| null` | ❌ | — | Contact `id` |
| `onChange` | `(value: string \| null) => void` | ✅ | — | |
| `placeholder` | `string` | ❌ | `'Seleccionar contacto...'` | |
| `contactType` | `'CUSTOMER' \| 'SUPPLIER' \| 'BOTH' \| 'NONE'` | ❌ | — | Filter by contact type |
| `onSelectContact` | `(contact: Contact) => void` | ❌ | — | Full Contact object (for auto-fill) |
| `disabled` | `boolean` | ❌ | `false` | |
| `isPartnerOnly` | `boolean` | ❌ | `false` | Restrict to partner contacts only |
| `label` | `string` | ❌ | — | |
| `error` | `string` | ❌ | — | |
| `className` | `string` | ❌ | — | |

Feature hook: `useContactSearch` from `features/contacts`.

---

## AdvancedSaleOrderSelector 🟡

Combobox for sale orders. Debounced search, inline preview via `TransactionViewModal`.

```tsx
<AdvancedSaleOrderSelector
  value={orderId}
  onChange={setOrderId}
  label="Orden de venta"
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `value` | `string \| number \| null` | ❌ | — | SaleOrder `id` |
| `onChange` | `(value: string \| null) => void` | ✅ | — | |
| `placeholder` | `string` | ❌ | — | |
| `disabled` | `boolean` | ❌ | `false` | |
| `customFilter` | `(order: SaleOrder) => boolean` | ❌ | — | Client-side filter |
| `label` | `string` | ❌ | — | |
| `error` | `string` | ❌ | — | |
| `className` | `string` | ❌ | — | |

Feature hook: `useSaleOrderSearch` from `features/orders`.

---

## AdvancedWorkOrderSelector 🟡

Combobox for work orders. Debounced search, inline preview. Clear button built-in. Optional link (dashed border when empty).

```tsx
<AdvancedWorkOrderSelector
  value={workOrderId}
  onChange={setWorkOrderId}
  label="Orden de Trabajo"
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `value` | `string \| number \| null` | ❌ | — | WorkOrder `id` |
| `onChange` | `(value: string \| null) => void` | ✅ | — | Pass `null` to clear |
| `placeholder` | `string` | ❌ | `'Vincular a Orden de Trabajo (Opcional)...'` | |
| `disabled` | `boolean` | ❌ | `false` | |
| `label` | `string` | ❌ | — | |
| `error` | `string` | ❌ | — | |

Feature hook: `useWorkOrderSearch` from `features/production`.

---

## TreasuryAccountSelector 🟡

Combobox for treasury accounts (bank/cash). Filters by payment context.

```tsx
<TreasuryAccountSelector
  value={accountId}
  onChange={setAccountId}
  context="POS"
  paymentMethod="CASH"
  label="Cuenta de pago"
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `value` | `string \| number \| null` | ❌ | — | Account `id` |
| `onChange` | `(value: string \| null) => void` | ✅ | — | |
| `placeholder` | `string` | ❌ | — | |
| `disabled` | `boolean` | ❌ | `false` | |
| `context` | `PaymentContext` | ❌ | — | `'POS' \| 'STANDARD' \| ...` — see `useTreasuryAccounts` |
| `terminalId` | `number` | ❌ | — | Filter accounts linked to specific terminal |
| `paymentMethod` | `'CASH' \| 'CARD' \| 'TRANSFER'` | ❌ | — | Filter by payment method type |
| `type` | `'BANK' \| 'CASH'` | ❌ | — | Legacy filter (prefer `context`) |
| `excludeId` | `number` | ❌ | — | Exclude specific account (e.g. avoid self-transfer) |
| `onSelect` | `(account: TreasuryAccount) => void` | ❌ | — | Full account object on select |

Global hook: `useTreasuryAccounts` from `/hooks/`.

---

## UserSelector 🟡

Combobox for system users. Debounced search by name.

```tsx
<UserSelector
  value={userId}
  onChange={setUserId}
  label="Responsable"
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `value` | `number \| null` | ❌ | — | User `id` (integer, not UUID) |
| `onChange` | `(value: number \| null) => void` | ✅ | — | |
| `placeholder` | `string` | ❌ | `'Seleccionar usuario...'` | |
| `disabled` | `boolean` | ❌ | `false` | |
| `label` | `string` | ❌ | — | |
| `error` | `string` | ❌ | — | |

Feature hook: `useUserSearch` from `features/users`.

---

## GroupSelector 🟡

Combobox for user groups/roles. Value is group **name** (string), not id.

```tsx
<GroupSelector
  value={groupName}
  onChange={setGroupName}
  label="Grupo"
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `value` | `string \| null` | ❌ | — | Group **name** string |
| `onChange` | `(value: string \| null) => void` | ✅ | — | |
| `placeholder` | `string` | ❌ | `'Seleccionar grupo...'` | |
| `disabled` | `boolean` | ❌ | `false` | |
| `label` | `string` | ❌ | — | |
| `error` | `string` | ❌ | — | |

Feature hook: `useGroupSearch` from `features/users`.

---

## UoMSelector 🟡

Dropdown (not combobox) for Unit of Measure. Filters allowed UoMs by product + context. Requires caller to pass the `uoms` array.

```tsx
<UoMSelector
  product={selectedProduct}
  context="sale"
  value={uomId}
  onChange={setUomId}
  uoms={uoms}
  label="Unidad de medida"
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `product` | `Product \| null` | ❌ | — | Drives filtering by `allowed_sale_uoms` / `uom` |
| `categoryId` | `number` | ❌ | — | Alternative filter when product not available |
| `context` | `'sale' \| 'purchase' \| 'bom' \| 'stock'` | ❌ | — | Determines which UoMs are allowed |
| `value` | `string` | ✅ | — | UoM `id` as string |
| `onChange` | `(value: string) => void` | ✅ | — | |
| `uoms` | `UoM[]` | ✅ | — | Full UoM list — caller fetches from backend |
| `showConversionHint` | `boolean` | ❌ | `false` | Shows conversion ratio tooltip |
| `disabled` | `boolean` | ❌ | `false` | |
| `label` | `string` | ❌ | — | |
| `error` | `string` | ❌ | — | |
| `quantity` | `number` | ❌ | — | For conversion hint display |
| `variant` | `'inline' \| 'standalone'` | ❌ | `'standalone'` | `inline`: no label wrapper |
| `className` | `string` | ❌ | — | |

No feature hook — caller provides `uoms` list.

---

## Forbidden patterns

- Do NOT use `<Select>` from shadcn for entity fields with >20 options or dynamic data.
- Do NOT call feature hooks directly in a component that needs a selector — use the selector component.
- Do NOT put selector components inside `components/shared/` — they belong in `components/selectors/` because of feature-hook coupling.
- Do NOT create a new selector ad-hoc in a feature — promote to `components/selectors/` if needed in ≥2 features.
