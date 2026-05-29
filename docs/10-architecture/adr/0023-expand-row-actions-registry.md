---
id: 0023
title: Expand ROW_ACTIONS registry with transactional verbs (annul, pay, deliver, receive)
status: Accepted
date: 2026-05-16
author: frontend-team
---

# ADR-0023 — Expand ROW_ACTIONS registry with transactional verbs

## Context

The closed registry `ROW_ACTIONS` (`frontend/lib/row-actions.ts`), defined in
`component-row-actions.md`, is the single source of truth for icon, label,
intent and color of every CRUD-style action that appears in a `DataTable` row, an `EntityCard`
footer or a Kanban card. The initial registry covered 13 generic verbs:
`view, detail, hub, edit, duplicate, download, print, share, archive, restore, lock, unlock, delete`.

A subsequent audit of the codebase (see `component-row-actions.md` §7 migration plan) surfaced
**recurrent transactional verbs that appear in 3 or more modules** but are not in the registry,
each implemented ad-hoc with different lucide icons and Spanish labels:

| Verb | Modules observed | Icons seen in code |
|------|------------------|--------------------|
| "Anular" / "Void" | billing (SalesInvoices, PurchaseInvoices), sales (orders ActionCategory), production (WorkOrderWizard) | `Ban`, `X`, `Trash2` |
| "Pagar" / "Registrar Pago" | treasury (PaymentModal), sales-orders (TreasuryPhase), billing (ActionCategory) | `DollarSign`, `CreditCard`, `Banknote` |
| "Entregar" / "Despachar" | sales (DeliveryModal), sales-orders (LogisticsPhase) | `Truck`, `Send` |
| "Recibir" | purchasing (ReceiptModal), inventory (StockMove), sales-orders | `Package`, `PackageCheck`, `Inbox` |

The icon and tooltip divergence between modules breaks the visual consistency goal of the
registry. Worse, two of these (`annul`, `delete`) are *destructive* but were sometimes wired
without `ActionConfirmModal`.

Excluded from this expansion (single-module or workflow-specific — kept as inline
`icon` + `title` overrides for now): `complete-folio`, `create-credit-note`, `reissue-dte`,
`recalculate-distribution`, `lock-session`, `approve`, `reject`. They will be reconsidered in a
later ADR if adoption widens.

## Decision

Expand `ROW_ACTIONS` with four transactional verbs:

| key | icon (lucide) | label (es-CL) | intent | destructive? |
|------|---------------|---------------|--------|--------------|
| `annul` | `Ban` | "Anular" | destructive | **yes** — requires `ActionConfirmModal variant="destructive"` |
| `pay` | `Banknote` | "Pagar" | write | no |
| `deliver` | `Truck` | "Entregar" | write | no |
| `receive` | `PackageCheck` | "Recibir" | write | no |

The canonical order is extended accordingly:

```
view → detail → hub → edit → duplicate → pay → deliver → receive →
  download → print → share → archive → restore → lock/unlock → annul → delete
```

Rationale for placement:

- `pay`, `deliver`, `receive` slot between `duplicate` (data write) and `download` (read-only
  exports) — they are the most common *forward workflow* actions and should sit close to `edit`.
- `annul` slots immediately before `delete`. Both are destructive; `annul` preserves the record
  (legal/audit trail) while `delete` removes it. Convention: prefer `annul` for transactional
  documents (invoices, orders), reserve `delete` for masters (categories, warehouses).

Destructive intent for `annul` is enforced by the registry (`intent: "destructive"`) — the
existing `DataCell.ActionMenu` auto-detection applies destructive styling and, by contract, the
caller MUST wire `ActionConfirmModal` exactly as for `delete`.

## Consequences

**Positive**

- Eliminates icon drift across billing/sales/purchasing for the same logical action.
- The `action="<key>"` shorthand becomes usable in 4 more high-traffic modules without inline
  `icon`/`title` props.
- Pairs `annul` with `delete` under the same destructive contract, eliminating the audited
  cases where "Anular" was wired without confirmation.

**Negative**

- Four new symbols in the registry surface; future contributors must learn the verbs.
- Existing call-sites with hand-rolled `<Ban>` / `<Truck>` icons become legacy and should be
  migrated in the next refactor pass (non-breaking — old form still works).

**Neutral**

- The registry remains closed: adding more verbs still requires an ADR.

## Alternatives considered

- **Leave them ad-hoc** — rejected. The audit showed 3+ modules with divergent icons for the same
  verb; that is exactly the problem the registry was created to solve.
- **Add a much broader set (approve, reject, send-email, complete-folio, etc.)** — rejected for
  now. Premature: those verbs only appear in 1-2 modules each. Adding them risks accreting
  module-specific verbs into a registry meant to stay tight. Re-evaluate per verb when ≥3
  modules adopt it.
- **Use a tag/intent system instead of fixed keys** — rejected. The registry's value is the
  pre-decided icon/label/color triplet; a tag system pushes those decisions back to call-sites
  and reintroduces drift.

## References

- Registry: [frontend/lib/row-actions.ts](../../../frontend/lib/row-actions.ts)
- Contract: [docs/20-contracts/component-row-actions.md](../../20-contracts/component-row-actions.md)
- Decision tree: [docs/20-contracts/component-decision-tree.md §1.5](../../20-contracts/component-decision-tree.md)
- Renderer: `DataCell.Action`, `DataCell.ActionMenu` in
  [frontend/components/shared/DataTableCells.tsx](../../../frontend/components/shared/DataTableCells.tsx)
- Card surface: `CardActions` in
  [frontend/components/shared/CardActions.tsx](../../../frontend/components/shared/CardActions.tsx)
- Confirmation contract (mandatory for destructive actions):
  [docs/20-contracts/component-modal.md](../../20-contracts/component-modal.md)
