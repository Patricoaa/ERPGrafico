---
layer: 20-contracts
doc: component-row-actions
status: active
owner: frontend-team
last_review: 2026-05-28
stability: contract-changes-require-ADR
preconditions:
  - component-contracts.md
  - component-decision-tree.md
  - list-modal-edit-pattern.md
  - module-layout-navigation.md
related_adrs:
  - ADR-0023 (registry expansion: annul, pay, deliver, receive)
---

# Contrato: Row & Card Actions

> Single source of truth for action buttons in **table rows**, **card grids** and **kanban cards**.
> Closes the gap left by `component-contracts.md §14` (factory `createActionsColumn`) by defining a
> closed registry of actions and the canonical visual / behavioural rules they must follow.

---

## 1. Surface map

| Surface | Renderer | Action registry |
|---------|----------|-----------------|
| Table row (DataTable) | `createActionsColumn<T>` + `DataCell.Action` / `DataCell.ActionMenu` | `ROW_ACTIONS` |
| Card grid (EntityCard) | `actions` prop on `<EntityCard>` (top-right corner) | `ROW_ACTIONS` |
| Kanban card | `CardActions` slot inside the card body | `ROW_ACTIONS` |

All three surfaces share the **same registry, the same icons, the same tooltips and the same
canonical order.** The only difference is the *renderer wrapper* (column factory vs. card actions prop).

> Never hand-roll an icon button for a CRUD action. If the action is in `ROW_ACTIONS`, use
> `DataCell.Action action="<key>"` or `<CardActions.Item action="<key>">`. If the action is
> module-specific (e.g. "Recalcular Stock"), still use the same renderer with a custom `icon` +
> `title`, so size/tooltip/variant remain identical.

---

## 2. Closed registry — `ROW_ACTIONS`

The registry lives in **`frontend/lib/row-actions.ts`** and is the only authoritative source for
the icon, label, variant and destructiveness of each CRUD-style action.

| key | icon (lucide) | label (es-CL) | intent | typical handler |
|------|----------------|----------------|--------|-----------------|
| `detail` | `Eye` | "Ver detalle" | read | `openEntity(label, id)` — entity drawer en modo `view` (ADR-0028) |
| `view` | `Eye` | "Ver" | read | inline read-only view (modal/drawer no-edit) |
| `hub` | `LayoutDashboard` | "Abrir HUB" | read | open `CollapsibleSheet` (HUB) |
| `history` | `History` | "Ver historial" | read | open activity/history drawer |
| `edit` | `Pencil` | "Editar" | write | navigate to `?selected={id}` (ADR-0020) |
| `duplicate` | `Copy` | "Duplicar" | write | POST `{ ...item, id: undefined }` |
| `pay` | `Banknote` | "Pagar" | write | open payment modal (treasury) — added in ADR-0023 |
| `deliver` | `Truck` | "Entregar" | write | open delivery modal (sales / logistics) — added in ADR-0023 |
| `receive` | `PackageCheck` | "Recibir" | write | open receipt modal (purchasing) — added in ADR-0023 |
| `report` | `FileText` | "Generar reporte" | read | open report/analytics panel |
| `download` | `Download` | "Descargar" | read | trigger file download |
| `print` | `Printer` | "Imprimir" | read | `react-to-print` |
| `share` | `Share2` | "Compartir" | read | copy link / open share sheet |
| `archive` | `Archive` | "Archivar" | write | soft-archive |
| `restore` | `ArchiveRestore` | "Restaurar" | write | reverse archive |
| `lock` | `Lock` | "Bloquear" | write | toggle lock |
| `unlock` | `Unlock` | "Desbloquear" | write | toggle lock |
| `toggle_active` | `Power` | "Activar/Desactivar" | write | toggle `is_active` flag |
| `post` | `CheckCircle` | "Confirmar" | write | confirm/approve a draft document |
| `reopen` | `LockOpen` | "Reabrir" | write | reopen a closed/cancelled state |
| `disburse` | `Send` | "Desembolsar" | write | loan / credit-line disbursement |
| `split` | `SplitSquareHorizontal` | "Distribuir" | write | split/distribute amounts across allocations |
| `annul` | `Ban` | "Anular" | destructive | open `ActionConfirmModal variant="destructive"` — **POSTED/PAID transactional docs** (invoice, order, payment); preserves the record for audit, creates reversal entries — added in ADR-0023 |
| `delete` | `Trash2` | "Eliminar" | destructive | open `ActionConfirmModal variant="destructive"` — **masters / config** (category, warehouse); removes the record |
| `reverse` | `RotateCcw` | "Reversar" | destructive | open `ActionConfirmModal variant="destructive"` — creates a reversal transaction |

Any addition to the registry **requires an ADR** (governance: changing a contract).
Module-specific actions (e.g. `"recalculate-stock"`, `"reissue-dte"`) are not added to the
registry — they are passed inline via `icon` + `title` props.

> **Nota:** `cancel` fue eliminado del registro. La anulación de DRAFT transactional docs se
> modela hoy con `annul` (que preserva el registro para auditoría). No existe `cancel` en
> `RowActionKey`.

### 2.1 Color rules

- Default colors come from the registry (read = `ghost`, write = `ghost`, destructive = `ghost`
  with `text-destructive` on hover). Never override `color` for actions already in the registry.
- Module-specific actions: only the semantic tokens `text-primary`, `text-success`,
  `text-warning`, `text-info`, `text-destructive`, `text-muted-foreground` are allowed (governance §2 —
  no raw Tailwind colors).

### 2.2 Tooltip rules

- Always present. Sourced from `ROW_ACTIONS[key].label`; override only with `title` for
  module-specific actions.
- Style: dark sidebar palette, 400ms delay, `text-[9px] font-black uppercase tracking-[0.2em]`
  (already enforced by `DataCell.Action`).
- Never duplicate the tooltip text as a visible label — icon-only is the rule for row/card
  actions.

---

## 3. Canonical order

When multiple actions are present, they MUST be rendered in this order (left → right in tables,
left → right or top → bottom in cards):

```
detail → view → hub → history → edit → duplicate → pay → deliver → receive →
  report → download → print → share → archive → restore → lock / unlock → toggle_active →
  post → reopen → disburse → split → annul → delete → reverse
```

Destructive verbs (`annul`, `delete`, `reverse`) are **always last**, in that order. `edit` is
the visual anchor — if present, it should be the first *write* action. Read actions (`detail`,
`view`, `hub`, `history`) come before any write action. Transactional workflow verbs (`pay`,
`deliver`, `receive`) sit between `duplicate` and the read-only export block
(`report`/`download`/`print`/`share`).

**`annul` vs `delete` vs `reverse` — when to use which:**

| Use `annul` for | Use `delete` for | Use `reverse` for |
|------------------|-----------------|------------------|
| Transactional docs that must remain in the audit trail (invoices, sale orders, payments, work orders, journal entries) | Masters / configuration entities with no legal trace requirement (categories, warehouses, tags, payment methods) | Posted transactions that need a counterpart reversal entry (e.g. reversing a mis-posted JE or movement) |
| Backend creates reversal entries (JE REVERSAL, StockMove reversal) | Backend hard-deletes (or soft-deletes via `deleted_at`) | Backend creates a full reversal transaction, preserving the original |

All destructive — all MUST open `ActionConfirmModal` with `variant="destructive"`.

The `<CardActions>` and `<DataCell.ActionGroup>` containers do not reorder children — the caller
is responsible for ordering. Lint rule (future ADR) will enforce ordering automatically.

---

## 4. Overflow rule — auto-detection via structured data

The `auto()` and `render()` methods on `createEntityActions` **automatically** choose the correct layout
based on the number of visible actions at runtime. The behavior is **unified across all surfaces**:

| # visible actions | Component | Visual |
|-------------------|-----------|--------|
| 0 | Empty cell / `null` | Nothing |
| 1 | `DataCell.ActionSingle` | ArrowRight icon, subtle at rest (`opacity-20`), fully visible on hover (`group-hover:opacity-100`) |
| 2+ | `DataCell.ActionMenu` | `MoreVertical` kebab, always visible, opens dropdown |

**How it works:**
- Action files define a `StructuredAction[]` with optional `visible` flags.
- `auto()` (DataTable) and `render()` (Cards/Kanban) filter `visible: false`, count remaining, and pick the right component.
- No manual decision needed — the system adapts per-row/card at runtime.

**DataTable (via `auto()`):**
- The actions column has no header label and a fixed width of 40px.
- Row containers have the `group` class for `group-hover` to work.
- `DataCell.ActionSingle` renders an `ArrowRight` icon with `opacity-20 group-hover:opacity-100`.
- `DataCell.ActionMenu` renders the `MoreVertical` kebab, always visible.

**Cards / Kanban (via `render()`):**
- Uses the same `ActionSingle` and `ActionMenu` components as DataTable.
- `EntityCard.Root` has the `group` class, so hover-reveal works automatically.
- Parent containers should have `group` class for `ActionSingle` hover-reveal.

---

## 5. Implementation contracts

### 5.1 Table — `auto()` with structured data (preferred)

```tsx
import { createEntityActions, type StructuredActions } from "@/components/shared"
import type { Product } from "@/features/inventory/types"

interface ProductActionsCtx {
  onEdit: (id: number) => void
  onArchive: (product: Product) => void
  onDelete: (product: Product) => void
}

// Define actions as structured data — visibility is explicit
export const productActions = createEntityActions<Product, ProductActionsCtx>(
  (item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item.id) },
    { action: item.is_active ? "archive" : "restore", onClick: () => ctx.onArchive(item) },
    // Only visible for non-active products with no stock:
    { action: "delete", onClick: () => ctx.onDelete(item), visible: !item.is_active && item.stock === 0 },
  ]
)

// Caller — auto() detects visible count per row:
// - 1 visible → ActionSingle (ArrowRight on hover)
// - 2+ visible → ActionMenu (kebab)
const columns = [ productActions.auto(actionsCtx) ]
```

**Auto-detection at runtime:**
- If a row has `is_active=true, stock=10` → 2 visible actions → kebab menu.
- If a row has `is_active=false, stock=0` → 3 visible actions → kebab menu.
- If a row has `is_active=true, stock=0` → only `edit` visible → ArrowRight.

**Conditional visibility patterns:**

```tsx
// Pattern 1: simple flag
{ action: "delete", onClick: () => ctx.onDelete(item), visible: !item.is_system }

// Pattern 2: status-based
{ action: "pay", onClick: () => ctx.onPay(item), visible: item.status === "PENDING" }

// Pattern 3: permission-based
{ action: "annul", onClick: () => ctx.onAnnul(item), visible: ctx.canDo('annul', item) }

// Pattern 4: disabled but always visible (dimmed in UI)
{ action: "lock", onClick: () => {}, disabled: true }
```

**Low-level alternative (JSX — still supported):**

```tsx
import { createActionsColumn, DataCell } from "@/components/shared"

const columns = [
  createActionsColumn<Product>({
    renderActions: (item) => (
      <DataCell.ActionSingle onClick={() => openSelected(item.id)} />
    ),
  }),
]
```

- `DataCell.Action action="<key>"` is the **preferred form**. It pulls icon + title + variant
  from `ROW_ACTIONS[key]`.
- The legacy form `DataCell.Action icon={Pencil} title="Editar"` remains supported for
  module-specific actions only.

### 5.2 Card / Kanban — `render()` + structured data

Actions are passed via the **`actions` prop** on `<EntityCard>`, which renders them in the
top-right corner (absolute positioned) with `stopPropagation` so they never trigger the card's
`onClick`. Use `createEntityActions().render(item, ctx)` which auto-converts structured data → JSX.

```tsx
import { EntityCard } from "@/components/shared"
import { myActions } from "./myActions"

// render() converts structured actions → ActionSingle (1) or ActionMenu (2+)
<EntityCard onClick={() => openSelected(item.id)} actions={myActions.render(item, ctx)}>
  <EntityCard.Header title={item.name} />
  <EntityCard.Body>…</EntityCard.Body>
</EntityCard>
```

The `render()` method works with both patterns:
- **Structured data** (array of `StructuredAction`) → converts to `DataCell.Action` icons.
- **JSX** (legacy ReactNode) → passes through unchanged.

`CardActions` is a thin wrapper around `DataCell.ActionGroup` + `DataCell.Action` /
`DataCell.ActionMenu` — same primitives, same a11y, same tooltips. The wrapper exists so a future
visual change (e.g. enlarging icons on touch devices) can be applied to card surfaces only.

### 5.3 Routing — `useEntityRouteActions`

The hook **`frontend/hooks/useEntityRouteActions.ts`** centralises the query-param convention.

| Param | Reader | Writer |
|--------|--------|--------|
| `?selected={id}` | `useSelectedEntity` (existing — ADR-0020) | `openSelected(id)` |
| `?detail={id}` | **deprecado** (ADR-0028) — preferir `openEntity(label, id)` con `mode='view'` | `openDetail(id)` |
| `?hub={id}` | callers wire to `CollapsibleSheet` | `openHub(id)` |

Mutually exclusive: opening any of the three closes the others. `clearActions()` removes all
three while preserving every other param (filters, pagination, viewMode, etc).

> Do not use `?view=` as a param — it is **reserved** for the table/card viewMode switch
> (see `useViewMode`).

### 5.4 Card `onClick` — navigation convention

The `<EntityCard>` component accepts an `onClick` prop that, when present, makes the card
keyboard-accessible (`role="button"`, `tabIndex={0}`, `cursor-pointer`).

**Convention:** `onClick` navigates to `?selected={id}` (ADR-0020) to open the entity's edit
drawer. This is the predominant pattern (~64% of clickable cards).

```tsx
<EntityCard onClick={() => openSelected(item.id)} actions={myActions.render(item, ctx)}>
  ...
</EntityCard>
```

The `actions` prop container calls `stopPropagation()` on click, so action buttons never trigger
the card's `onClick`.

Exceptions exist for entities where card-click has a different meaning (e.g. opening a wizard,
setting local modal state). These are evaluated case-by-case.

---

## 6. Anti-patterns

| Anti-pattern | Correct |
|--------------|---------|
| Hand-rolled `<Button variant="ghost"><Pencil /></Button>` in a table row | `DataCell.Action action="edit"` |
| `DataCell.Action icon={Edit2} title="Editar"` | `DataCell.Action action="edit"` — registry icon is `Pencil` |
| Using `.column(ctx)` when actions are defined as structured data | `.auto(ctx)` — auto-detects ActionSingle vs ActionMenu |
| Manual `DataCell.ActionSingle` / `DataCell.ActionMenu` in `renderActions` | Let `auto()` handle the decision based on visible count |
| `DataCell.Action action="edit"` as the sole action in a DataTable row | `auto()` renders `DataCell.ActionSingle` automatically |
| 2+ inline `DataCell.Action` icons in a DataTable row | `auto()` renders `DataCell.ActionMenu` automatically |
| Popover + custom button list for >2 row actions | `DataCell.ActionMenu items={[…]}` |
| Card with actions in `EntityCard.Footer` instead of the `actions` prop | Prop `actions` on `<EntityCard>` (top-right corner) — Footer is for metadata, not CRUD actions |
| Card with no `actions` prop despite having `createEntityActions` | Pass `actions={xxxActions.render(item, ctx)}` to `EntityCard.Header` |
| `delete` placed before `edit` | Canonical order: `delete` always last |
| `?id=42` / `?edit=42` / `?modal=42` to open the edit modal | `?selected=42` (ADR-0020) |
| `?view=42` as a detail/detail param | `openEntity(label, 42)` (ADR-0028) — `?view=` is the viewMode switch |
| Raw Tailwind colors on a module-specific action icon | Semantic tokens only |
| Skipping the tooltip "because the icon is obvious" | Tooltip is mandatory (a11y + consistency) |

---

## 7. Migration plan

**New code must use structured data + `auto()`.** The JSX pattern with `.column()` is
legacy and should only be used when maintaining existing code.

Migration path:
1. Add `StructuredAction[]` return to the render callback in each action file.
2. Callers change `.column(ctx)` → `.auto(ctx)`.
3. `.render(item, ctx)` auto-converts structured data → JSX for cards.

---

## 8. Cross-references

- Component-level overview: [component-contracts.md §14](./component-contracts.md)
- Decision tree (which renderer to pick): [component-decision-tree.md §1.5 (Row & Card Actions)](./component-decision-tree.md)
- Edit modal mechanism: [list-modal-edit-pattern.md](./list-modal-edit-pattern.md)
- Confirmation modal for destructive actions: [component-modal.md](./component-modal.md)
- Card container: [component-card.md](./component-card.md), `EntityCard` exports
- Hook implementation: [hook-contracts.md](./hook-contracts.md)
