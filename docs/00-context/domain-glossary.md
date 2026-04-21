---
layer: 00-context
doc: domain-glossary
status: active
owner: core-team
last_review: 2026-04-21
---

# Domain Glossary

Definitive vocabulary. When a term appears in code or docs, use this meaning — do not redefine.

## Orders family

| Term | Definition | Backend entity |
|------|------------|----------------|
| **SaleOrder** | Commitment to deliver goods/services to customer | `sales.SaleOrder` |
| **PurchaseOrder** | Commitment to acquire goods/services from supplier | `purchasing.PurchaseOrder` |
| **WorkOrder** | Production job on shop floor, linked to SaleOrder | `production.WorkOrder` |
| **Order hub** | Frontend aggregate view over the three above — NOT a backend entity | `features/orders` only |

## Financial

| Term | Definition |
|------|------------|
| **Folio** | Fiscal sequential number on invoices/receipts. Validated for gaps |
| **Period** | Fiscal period (month/year). Closed periods reject new entries |
| **Reconciliation** | Match bank statement lines with internal transactions |
| **Journal entry** | Double-entry accounting record (debit = credit) |

## Production

| Term | Definition |
|------|------------|
| **Route** | Sequence of operations to produce an item |
| **Operation** | Single step on route (e.g. "cut", "print", "bind") |
| **Machine** | Physical resource executing operations |

## Workflow

| Term | Definition |
|------|------------|
| **State machine** | Defined in `workflow` app, governs entity transitions |
| **Transition** | Named edge between states, may require permissions |
| **Approval** | Transition gated by user role check |

## Frontend-specific

| Term | Definition |
|------|------------|
| **Feature** | Self-contained module under `features/[name]/` |
| **Barrel** | `features/[name]/index.ts` — only public entry point |
| **Contract** | Signed API (component props, hook return, endpoint schema) |
| **Shared component** | Promoted to `/components/shared/`, reused ≥3 modules |

## Ambiguity flags

Terms NOT to use (use canonical left column instead):

| Avoid | Use |
|-------|-----|
| "Invoice order" | SaleOrder or Invoice (distinct) |
| "Job" | WorkOrder (if shop floor) or Celery task (if async code) |
| "Status" (bare) | Entity-specific state, see [state-map](../20-contracts/state-map.md) |
| "Client" | Customer (business) or frontend (code) — disambiguate |
