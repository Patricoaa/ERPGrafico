---
layer: 20-contracts
doc: component-selectors
status: active
owner: frontend-team
last_review: 2026-05-28
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

## Dropdown behavior

Entity selectors must adhere to the layout invariants defined in [component-contracts.md](./component-contracts.md#dropdown--popover-layout-invariants):

- **Width**: MUST match trigger width using `w-[var(--radix-popover-trigger-width)]`.
- **Position**: MUST use `popper` style, aligning the dropdown with the **bottom border** of the notched fieldset (avoiding the `item-aligned` covering behavior of standard selects).

---

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
  <span className="text-sm text-foreground truncate">{entity.name}</span>
  <span className="text-3xs text-muted-foreground shrink-0 hidden sm:inline">{entity.secondary}</span>
</div>
```

> **Nota de contrato (N3):** El valor seleccionado usa `text-sm text-foreground` (peso normal), no `font-medium`. El texto secundario usa `text-3xs` (token) en vez de `text-[10px]`.

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
| `placeholder` | `string` | ❌ | `'Seleccionar...'` | Default canónico (R6) |
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
| `placeholder` | `string` | ❌ | `'Seleccionar...'` | Default canónico (R6) |
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

Combobox for customers/suppliers. Debounced search, RUT display. Lazy-loads `ContactDrawer` for quick contact creation.

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
| `placeholder` | `string` | ❌ | `'Seleccionar...'` | Default canónico (R6) |
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

Combobox for sale orders. Debounced search, inline preview via the entity drawer (`openEntity('sales.saleorder', id)` — see [component-entity-drawers.md](./component-entity-drawers.md)).

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
| `placeholder` | `string` | ❌ | `'Seleccionar...'` | Default canónico (R6) |
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
| `placeholder` | `string` | ❌ | `'Seleccionar...'` | Default canónico (R6) |
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
| `placeholder` | `string` | ❌ | `'Seleccionar...'` | Default canónico (R6) |
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
| `placeholder` | `string` | ❌ | `'Seleccionar...'` | Default canónico (R6) |
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
| `placeholder` | `string` | ❌ | `'Seleccionar...'` | Default canónico (R6) |
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

---

## ProductGridPicker 🟢

Rich catalog picker with card grid, category filter, and search. Lives in `@/components/selectors/ProductGridPicker` (relocated and renamed by [ADR-0076](../10-architecture/adr/0076-productselector-grid-picker-relocation.md); the single-value dropdown is `ProductSelector` above). Use for full-catalog browsing; **not** for simple form fields or narrow popovers (requires ≥40vh height).

```tsx
<ProductGridPicker
  products={products}
  categories={categories}
  searchTerm={search}
  onSearchChange={setSearch}
  selectedCategoryId={categoryId}
  onSelectCategory={setCategoryId}
  onProductClick={handleSelect}
  isProductDisabled={isPOSProductDisabled}
  priceRenderer={(p) => <MoneyDisplay value={p.cost_price} />}
/>
```

| prop | type | required | notes |
|------|------|----------|-------|
| `products` | `BaseProduct[]` | ✅ | |
| `categories` | `ProductCategory[]` | ✅ | |
| `searchTerm` | `string` | ✅ | |
| `onSearchChange` | `(value: string) => void` | ✅ | |
| `onSearchEnter` | `() => void` | ❌ | |
| `selectedCategoryId` | `number \| null` | ✅ | |
| `onSelectCategory` | `(id: number \| null) => void` | ✅ | |
| `onProductClick` | `(product: BaseProduct) => void` | ✅ | |
| `onToggleFavorite` | `(productId: number) => void` | ❌ | |
| `isProductDisabled` | `(product: BaseProduct) => boolean` | ❌ | inject business rules |
| `limits` | `Record<string, number \| undefined>` | ❌ | branch stock override keyed `prod_<id>`; replaces `qty_available`, never adds to it |
| `priceRenderer` | `(product: BaseProduct) => ReactNode` | ❌ | replaces the price amount; returning `null` hides the whole price block |
| `priceLabel` | `string` | ❌ | caption above the price; default `"Venta c/IVA"` (calculator passes `"Costo"`) |
| `selectedProductIds` | `Set<number>` | ❌ | CMYK ribbon + check + `aria-pressed` on those cards |

**Related subcomponents:** `VariantSelectorModal` (variant selection via `useVariants` hook), `ProductGrid` (pure virtualized grid — use standalone if you need a custom layout), `ProductCard` (the card itself, see below).

### Card anatomy ([ADR-0092](../10-architecture/adr/0092-productgrid-card-anatomy.md), [ADR-0094](../10-architecture/adr/0094-card-anatomy-kit-and-radius.md))

One anatomy for every context (POS, calculator, production); only the price and availability sources change. **Implemented via `CardSurface` + `cardAnatomy` tokens**; radius `rounded-sm` (8px) — see ADR-0094 exception.

```
┌─────────────────────────┐ ← ribbon-cmyk: always when selected, on hover/focus otherwise
│ [Categoría]        (♡)  │   icon strip (photo when `image_thumbnail`/`image` exist), 88 px
│        ⬚                │
│ [⧉ 4 gramajes]      (✓) │   variant chip (templates) · selected check
├─────────────────────────┤
│ PAP-001              🔒 │   mono code · lock when unavailable
│ Papel couché mate 150 g │   name, 2 lines max
│ ▢ 1.240 pliegos disp.   │   availability line (icon + text, never colour alone)
│ Venta c/IVA · desde     │
│ $571 / pliego         › │   price c/IVA + unit · action glyph  + › –
                               (dynamic pricing: "Precio dinámico" replaces the amount)
└─────────────────────────┘
```

- What the card says lives in `product-card-model.ts` (`getProductCardModel`, pure, unit-tested): availability by product type, action glyph (`+` add, `›` configure for variants / dynamic price, `–` unavailable) and price kind (`fixed` / `from` / `pending`). `ProductCard.tsx` only draws it.
- Price is **c/IVA** (`PricingUtils.netToGross`). Templates show `min_variant_price` as "desde"; dynamic-pricing products show "Precio dinámico" **in place of** the amount.
- Variant hints (`variants_count`, `variant_axis_label`, `min_variant_price`) come from `ProductListSerializer`, read from the `variants` prefetch of `list_products` (no N+1; pinned by `inventory/tests/test_product_list_card_fields.py`).
- Unavailable (disabled by the caller, or a template with no active variants): whole card at 50 % opacity on a washed `bg-muted/40`, grey name/price/availability (never red), lock, `–`, `cursor-not-allowed`, no ribbon, no hover; the reason is the availability text ("Sin existencias", "Sin variantes"). The favourite stays clickable.
- Loading: `CardSkeleton variant="product"` mirrors the same strip + rows to avoid CLS.

**⚠️ VirtuosoGrid constraint:** The parent container **must** have a defined height (`flex-1 min-h-0` or fixed px). A zero-height container renders nothing.

## CategorySelector 🟢

Combobox para categorías de producto. Usa `SearchablePopover` con soporte para crear categoría inline.

```tsx
<CategorySelector
  value={categoryId}
  onChange={setCategoryId}
  label="Categoría"
  showPlusButton={true}
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `value` | `string \| number \| null` | ❌ | — | Category `id` |
| `onChange` | `(value: string \| null) => void` | ✅ | — | Returns `id.toString()` or `null` |
| `placeholder` | `string` | ❌ | `'Seleccionar...'` | Default canónico (R6) |
| `disabled` | `boolean` | ❌ | — | |
| `label` | `string` | ❌ | — | |
| `error` | `string` | ❌ | — | |
| `required` | `boolean` | ❌ | — | |
| `className` | `string` | ❌ | — | |
| `showPlusButton` | `boolean` | ❌ | `true` | Abre `CategoryDrawer` para crear inline |
| `excludeId` | `number \| string` | ❌ | — | Excluir una categoría (ej. evitar self-parent) |
| `allowNone` | `boolean` | ❌ | `false` | Agrega opción "Ninguno" |
| `noneLabel` | `string` | ❌ | `'Ninguno'` | Texto de la opción vacía |
| `icon` | `ReactNode` | ❌ | — | Ícono personalizado en el trigger |

Feature hook: `useCategories` de `features/inventory`.

---

## WarehouseSelector 🟢

Combobox para bodegas. Muestra nombre y código.

```tsx
<WarehouseSelector
  value={warehouseId}
  onChange={setWarehouseId}
  label="Bodega"
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `value` | `string \| number \| null` | ❌ | — | Warehouse `id` |
| `onChange` | `(value: string \| null) => void` | ✅ | — | |
| `placeholder` | `string` | ❌ | `'Seleccionar...'` | Default canónico (R6) |
| `disabled` | `boolean` | ❌ | — | |
| `label` | `string` | ❌ | — | |
| `error` | `string` | ❌ | — | |
| `required` | `boolean` | ❌ | — | |
| `className` | `string` | ❌ | — | |
| `icon` | `ReactNode` | ❌ | — | Ícono personalizado en el trigger |

Feature hook: `useWarehouses` de `features/inventory`.

---

## ProductTypeSelector 🟢

Dropdown para tipo de producto (`STORABLE | CONSUMABLE | MANUFACTURABLE | SERVICE | SUBSCRIPTION`). Usa Shadcn `<Select>` (no popover) porque es un enum estático de 5 opciones.

```tsx
<ProductTypeSelector
  value={productType}
  onChange={setProductType}
  label="Tipo de Producto"
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `value` | `string \| null` | ❌ | — | Uno de los 5 IDs del enum |
| `onChange` | `(value: string) => void` | ✅ | — | |
| `disabled` | `boolean` | ❌ | — | |
| `label` | `string` | ❌ | `'Tipo de Producto'` | |
| `required` | `boolean` | ❌ | — | |
| `error` | `string` | ❌ | — | |
| `lockedType` | `string` | ❌ | — | Fuerza un tipo y deshabilita el selector |

Sin hook externo — opciones son estáticas en el componente.

---

## SourceDocumentSelector 🟢

Selector de documento origen (GFK). Usa `useUniversalSearch` con debounce para buscar cualquier tipo de entidad.

```tsx
<SourceDocumentSelector
  value={sourceDoc}
  onChange={setSourceDoc}
  label="Documento Origen"
  allowedLabels={['sales.saleorder', 'purchases.purchaseorder']}
/>
```

```ts
// Tipo de valor
interface SourceDocument {
  content_type_id: number
  object_id: number
  display: string
  label: string  // 'app.model'
  icon: string
}
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `value` | `SourceDocument \| null` | ❌ | — | Documento seleccionado |
| `onChange` | `(value: SourceDocument \| null) => void` | ✅ | — | |
| `disabled` | `boolean` | ❌ | `false` | |
| `label` | `string` | ❌ | — | |
| `error` | `string` | ❌ | — | |
| `className` | `string` | ❌ | — | |
| `allowedLabels` | `string[]` | ❌ | — | Filtrar por tipo de entidad (`'app.model'`) |

Cuando el documento seleccionado tiene drawer registrado, el texto se convierte en link que abre el drawer con `openEntity`. Hook: `useUniversalSearch` de `features/search`.

---

## Forbidden patterns

- Do NOT use `<Select>` from shadcn for entity fields with >20 options or dynamic data.
- Do NOT call feature hooks directly in a component that needs a selector — use the selector component.
- Do NOT put selector components inside `components/shared/` — they belong in `components/selectors/` because of feature-hook coupling.
- Do NOT create a new selector ad-hoc in a feature — promote to `components/selectors/` if needed in ≥2 features.
