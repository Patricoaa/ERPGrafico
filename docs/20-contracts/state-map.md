---
layer: 20-contracts
doc: state-map
status: active
owner: core-team
last_review: 2026-04-21
stability: contract-changes-require-ADR
---

# Entity State Map

Single source of truth for every entity state. `StatusBadge` variants must match. `BUSINESS_STATES.md` is DEPRECATED.

## Conventions

- State identifiers: `snake_case` in backend + API + frontend unions.
- Every state maps to a semantic color token (`text-*-foreground` + `bg-*-muted`).
- No raw Tailwind color — always token.

## SaleOrder

| State | Token | Transitions allowed to |
|-------|-------|-----------------------|
| `draft` | `neutral` | `confirmed`, `cancelled` |
| `confirmed` | `info` | `in_production`, `cancelled` |
| `in_production` | `primary` | `ready_to_ship`, `cancelled` |
| `ready_to_ship` | `accent` | `shipped`, `cancelled` |
| `shipped` | `success` | `delivered` |
| `delivered` | `success` | `invoiced`, `returned` |
| `invoiced` | `success` | `closed` |
| `returned` | `warning` | `closed` |
| `closed` | `muted` | — |
| `cancelled` | `destructive` | — |

## PurchaseOrder

| State | Token | Next |
|-------|-------|------|
| `draft` | `neutral` | `sent`, `cancelled` |
| `sent` | `info` | `received_partial`, `received_full`, `cancelled` |
| `received_partial` | `warning` | `received_full`, `cancelled` |
| `received_full` | `success` | `reconciled`, `disputed` |
| `reconciled` | `success` | `closed` |
| `disputed` | `destructive` | `reconciled`, `cancelled` |
| `closed` | `muted` | — |
| `cancelled` | `destructive` | — |

## WorkOrder

| State | Token | Next |
|-------|-------|------|
| `queued` | `neutral` | `in_progress`, `cancelled` |
| `in_progress` | `primary` | `paused`, `completed`, `failed` |
| `paused` | `warning` | `in_progress`, `cancelled` |
| `completed` | `success` | `qa_passed`, `qa_failed` |
| `qa_passed` | `success` | `closed` |
| `qa_failed` | `destructive` | `in_progress` (rework) |
| `failed` | `destructive` | — |
| `closed` | `muted` | — |
| `cancelled` | `destructive` | — |

## Invoice

| State | Token | Next |
|-------|-------|------|
| `draft` | `neutral` | `issued`, `cancelled` |
| `issued` | `info` | `paid_partial`, `paid`, `overdue`, `cancelled` |
| `paid_partial` | `warning` | `paid`, `overdue` |
| `overdue` | `destructive` | `paid_partial`, `paid` |
| `paid` | `success` | — |
| `cancelled` | `destructive` | — |

## Payment

| State | Token |
|-------|-------|
| `pending` | `neutral` |
| `confirmed` | `success` |
| `rejected` | `destructive` |
| `reversed` | `warning` |

## Reconciliation (bank)

| State | Token |
|-------|-------|
| `unmatched` | `warning` |
| `matched` | `success` |
| `disputed` | `destructive` |
| `ignored` | `muted` |

## Workflow transition invariants

- Transitions forbidden outside table above are rejected with HTTP 409.
- Every transition emits a `workflow.Transition` row (audit).
- Some transitions require permission (e.g. `qa_passed` requires role `qa`).

## Frontend enforcement

```ts
// features/sales/types/state.ts
export const SALE_ORDER_STATES = [
  'draft','confirmed','in_production','ready_to_ship','shipped',
  'delivered','invoiced','returned','closed','cancelled'
] as const
export type SaleOrderState = typeof SALE_ORDER_STATES[number]
```

Backend mirror: enum in `sales/models.py` `SaleOrder.Status` TextChoices. If diverged → bug. Test coverage required.
