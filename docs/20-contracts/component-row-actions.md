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
| Card grid (EntityCard) | `CardActions` slot inside `<EntityCard.Footer>` | `ROW_ACTIONS` |
| Kanban card | `CardActions` slot inside the card body | `ROW_ACTIONS` |

All three surfaces share the **same registry, the same icons, the same tooltips and the same
canonical order.** The only difference is the *renderer wrapper* (column factory vs. footer slot).

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
| `detail` | `FileText` | "Ver detalle" | read | `openEntity(label, id)` — entity drawer en modo `view` (ADR-0028) |
| `hub` | `LayoutDashboard` | "Abrir HUB" | read | open `CollapsibleSheet` (HUB) |
| `edit` | `Pencil` | "Editar" | write | navigate to `?selected={id}` (ADR-0020) |
| `duplicate` | `Copy` | "Duplicar" | write | POST `{ ...item, id: undefined }` |
| `pay` | `Banknote` | "Pagar" | write | open payment modal (treasury) — added in ADR-0023 |
| `deliver` | `Truck` | "Entregar" | write | open delivery modal (sales / logistics) — added in ADR-0023 |
| `receive` | `PackageCheck` | "Recibir" | write | open receipt modal (purchasing) — added in ADR-0023 |
| `download` | `Download` | "Descargar" | read | trigger file download |
| `print` | `Printer` | "Imprimir" | read | `react-to-print` |
| `share` | `Share2` | "Compartir" | read | copy link / open share sheet |
| `archive` | `Archive` | "Archivar" | write | soft-archive |
| `restore` | `ArchiveRestore` | "Restaurar" | write | reverse archive |
| `lock` | `Lock` | "Bloquear" | write | toggle lock |
| `unlock` | `Unlock` | "Desbloquear" | write | toggle lock |
| `cancel` | `Trash2` | "Cancelar" | destructive | open `ActionConfirmModal variant="destructive"` — **DRAFT transactional docs**; no reversals, marks status=CANCELLED, deletes JE if DRAFT |
| `annul` | `Ban` | "Anular" | destructive | open `ActionConfirmModal variant="destructive"` — **POSTED/PAID transactional docs** (invoice, order, payment); preserves the record for audit, creates reversal entries — added in ADR-0023 |
| `delete` | `Trash2` | "Eliminar" | destructive | open `ActionConfirmModal variant="destructive"` — **masters / config** (category, warehouse); removes the record |

Any addition to the registry **requires an ADR** (governance: changing a contract).
Module-specific actions (e.g. `"recalculate-stock"`, `"reissue-dte"`) are not added to the
registry — they are passed inline via `icon` + `title` props.

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
detail → hub → edit → duplicate → pay → deliver → receive →
  download → print → share → archive → restore → lock / unlock → cancel → annul → delete
```

`cancel`, `annul` and `delete` are **always last**, in that order. `edit` is the visual anchor — if
present, it should be the first *write* action. Read actions (`detail`, `hub`) come
before any write action. Transactional workflow verbs (`pay`, `deliver`, `receive`) sit between
`duplicate` and the read-only export block (`download`/`print`/`share`).

**`cancel` vs `annul` vs `delete` — when to use which:**

| Use `cancel` for | Use `annul` for | Use `delete` for |
|------------------|-----------------|------------------|
| DRAFT transactional docs where the entire document tree is DRAFT — no reversals needed | Posted/confirmed transactional docs that must remain in the audit trail (invoices, sale orders, payments, work orders, journal entries) | Masters / configuration entities with no legal trace requirement (categories, warehouses, tags, payment methods) |
| Backend marks `status=CANCELLED`, deletes DRAFT Journal Entries (no reversal) | Backend creates reversal entries (JE REVERSAL, StockMove reversal) | Backend hard-deletes (or soft-deletes via `deleted_at`) |

Both are destructive — both MUST open `ActionConfirmModal` with `variant="destructive"`.

The `<CardActions>` and `<DataCell.ActionGroup>` containers do not reorder children — the caller
is responsible for ordering. Lint rule (future ADR) will enforce ordering automatically.

---

## 4. Overflow rule — when to use `ActionMenu`

| # of actions in the row/card | Layout |
|------------------------------|--------|
| 1 – 3                        | All inline, no kebab. |
| 4                            | 3 inline + 1 in kebab, **or** all 4 inline if the table is wide enough. Caller decides. |
| 5 +                          | Mandatory: keep the top **2 read actions** + `edit` inline (canonical primaries), move the rest into the kebab via `DataCell.ActionMenu`. |

The kebab itself uses the icon `MoreVertical` (lucide) and is always the **last** element of the
`ActionGroup` / `CardActions` row.

Anti-pattern: dropping `delete` into a hidden kebab when the row has only 3 actions — destructive
actions must be visible (or one tap away inside a kebab that is itself visible).

---

## 5. Implementation contracts

### 5.1 Table — `createActionsColumn` + `DataCell.Action` / `DataCell.ActionMenu`

```tsx
import { createActionsColumn, DataCell } from "@/components/shared"
import { ROW_ACTIONS } from "@/lib/row-actions"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"

const { openSelected, openDetail, openHub } = useEntityRouteActions()

const columns = [
  // ...data columns,
  createActionsColumn<Product>({
    renderActions: (item) => (
      <>
        <DataCell.Action action="detail" onClick={() => openDetail(item.id)} />
        <DataCell.Action action="edit"   onClick={() => openSelected(item.id)} />
        <DataCell.ActionMenu
          items={[
            { action: "duplicate", onClick: () => duplicate(item) },
            { action: "archive",   onClick: () => archive(item) },
            { separator: true },
            { action: "delete",    onClick: () => confirmDelete(item) },
          ]}
        />
      </>
    ),
  }),
]
```

- `DataCell.Action action="<key>"` is the **preferred form**. It pulls icon + title + variant
  from `ROW_ACTIONS[key]`.
- The legacy form `DataCell.Action icon={Pencil} title="Editar"` remains supported for
  module-specific actions only.

### 5.2 Card / Kanban — `CardActions`

```tsx
import { EntityCard, CardActions } from "@/components/shared"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"

const { openSelected, openHub } = useEntityRouteActions()

<EntityCard onClick={() => openSelected(item.id)}>
  <EntityCard.Header title={item.name} />
  <EntityCard.Body>…</EntityCard.Body>
  <EntityCard.Footer>
    <CardActions>
      <CardActions.Item action="hub"  onClick={() => openHub(item.id)} />
      <CardActions.Item action="edit" onClick={() => openSelected(item.id)} />
      <CardActions.Menu
        items={[
          { action: "duplicate", onClick: () => duplicate(item) },
          { separator: true },
          { action: "delete",    onClick: () => confirmDelete(item) },
        ]}
      />
    </CardActions>
  </EntityCard.Footer>
</EntityCard>
```

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

---

## 6. Anti-patterns

| Anti-pattern | Correct |
|--------------|---------|
| Hand-rolled `<Button variant="ghost"><Pencil /></Button>` in a table row | `DataCell.Action action="edit"` |
| `DataCell.Action icon={Edit2} title="Editar"` | `DataCell.Action action="edit"` — registry icon is `Pencil` |
| Popover + custom button list for >2 row actions | `DataCell.ActionMenu items={[…]}` |
| Card with a single hidden `Pencil` reachable only on hover | Explicit `CardActions` row with at minimum `edit` + `delete` visible |
| `delete` placed before `edit` | Canonical order: `delete` always last |
| `?id=42` / `?edit=42` / `?modal=42` to open the edit modal | `?selected=42` (ADR-0020) |
| `?view=42` as a detail/detail param | `openEntity(label, 42)` (ADR-0028) — `?view=` is the viewMode switch |
| Raw Tailwind colors on a module-specific action icon | Semantic tokens only |
| Skipping the tooltip "because the icon is obvious" | Tooltip is mandatory (a11y + consistency) |

---

## 7. Migration plan

Existing call-sites using the **legacy** form (`DataCell.Action icon={Pencil} title="Editar"`)
continue to work — they are not a contract violation, but the preferred form going forward is
`DataCell.Action action="edit"`. The next refactor pass will rewrite them. New code must use the
`action="<key>"` shorthand whenever the action exists in the registry.

---

## 8. Cross-references

- Component-level overview: [component-contracts.md §14](./component-contracts.md)
- Decision tree (which renderer to pick): [component-decision-tree.md §1.5 (Row & Card Actions)](./component-decision-tree.md)
- Edit modal mechanism: [list-modal-edit-pattern.md](./list-modal-edit-pattern.md)
- Confirmation modal for destructive actions: [component-modal.md](./component-modal.md)
- Card container: [component-card.md](./component-card.md), `EntityCard` exports
- Hook implementation: [hook-contracts.md](./hook-contracts.md)
